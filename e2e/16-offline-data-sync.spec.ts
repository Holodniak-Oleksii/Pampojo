import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('sync');
const IP_RANGE = '198.18.16';
// On CI each API call takes 1-5 s, and a sync waits for several of them in a row.
const NETWORK_TIMEOUT = 30_000;

let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${IP_RANGE}.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, IP_RANGE);
});

async function signUp(page: Page): Promise<string> {
  const email = `e2e-${PREFIX}-${randomUUID()}@example.com`;
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  await completeOnboardingViaApi(page);
  return email;
}

async function createWorkout(page: Page, name: string): Promise<string> {
  const search = await page.request.get('/api/v1/exercises?q=barbell%20bench%20press&limit=1');
  const [bench] = ((await search.json()) as { items: { id: string }[] }).items;
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name,
      exercises: [
        {
          id: randomUUID(),
          exerciseId: bench!.id,
          targetSets: 1,
          targetRepsMin: 8,
          targetRepsMax: 8,
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  return id;
}

/** Outbox entries of every Pampojo database in this page, read straight from IndexedDB. */
function outboxCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases())
      .map((db) => db.name ?? '')
      .filter((name) => name.startsWith('pampojo-'));
    let total = 0;
    for (const name of names) {
      total += await new Promise<number>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction('outbox').objectStore('outbox').count();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result);
          };
        };
      });
    }
    return total;
  });
}

async function openToday(page: Page) {
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'Preparing your data for the gym' })).toBeHidden({
    timeout: NETWORK_TIMEOUT,
  });
}

test.describe('offline data and sync', () => {
  test.use({ locale: 'en-US' });
  test.slow();

  test('a fresh device downloads its data before the app opens (AC10)', async ({ page }) => {
    await signUp(page);
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/v1/sync/pull**', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/today');
    await expect(
      page.getByRole('heading', { name: 'Preparing your data for the gym' }),
    ).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await expect(
      page.getByRole('listitem').filter({ hasText: 'History for 30 days' }),
    ).toBeVisible();
    release();
    await expect(page.getByRole('heading', { name: 'Preparing your data for the gym' })).toBeHidden(
      {
        timeout: NETWORK_TIMEOUT,
      },
    );
  });

  test('sets logged offline reach the server once the network is back (AC1, AC2)', async ({
    page,
    context,
  }, testInfo) => {
    await signUp(page);
    await createWorkout(page, 'Offline Day');
    await openToday(page);
    const start =
      testInfo.project.name === 'mobile'
        ? page
            .getByRole('navigation', { name: 'Main navigation' })
            .last()
            .getByRole('button', { name: 'Start workout' })
        : page.getByRole('complementary').getByRole('button', { name: 'Start workout' });
    await start.click();
    await page
      .getByRole('dialog', { name: 'Choose workout' })
      .getByRole('button', { name: /Offline Day/ })
      .click();
    await page.waitForURL('**/session/*', { timeout: NETWORK_TIMEOUT });
    const sessionId = page.url().split('/session/')[1]!;
    await expect.poll(() => outboxCount(page), { timeout: NETWORK_TIMEOUT }).toBe(0);

    await context.setOffline(true);
    await page.getByRole('textbox', { name: 'Set 1, weight' }).fill('60');
    await page.getByRole('textbox', { name: 'Set 1, reps' }).fill('8');
    await page.getByRole('button', { name: 'Check set 1', exact: true }).click();
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await expect.poll(() => outboxCount(page)).toBeGreaterThan(0);

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => outboxCount(page), { timeout: NETWORK_TIMEOUT }).toBe(0);
    const session = (await (await page.request.get(`/api/v1/sessions/${sessionId}`)).json()) as {
      status: string;
      setLogs: { weightKg: number; reps: number }[];
    };
    expect(session.status).toBe('completed');
    expect(session.setLogs.map((set) => [set.weightKg, set.reps])).toEqual([[60, 8]]);
  });

  test('a measurement added offline syncs when the network is back (AC12)', async ({
    page,
    context,
  }) => {
    await signUp(page);
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Add measurement' }).first()).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add measurement' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Add measurement' });
    await sheet.getByRole('textbox', { name: 'Waist' }).fill('85');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => outboxCount(page)).toBeGreaterThan(0);

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => outboxCount(page), { timeout: NETWORK_TIMEOUT }).toBe(0);
    const { items } = (await (await page.request.get('/api/v1/measurements')).json()) as {
      items: { type: string; value: number }[];
    };
    expect(items.filter((item) => item.type === 'waist').map((item) => item.value)).toEqual([85]);
  });

  test('a workout changed on one device shows on the other after its next pull (AC5)', async ({
    page,
    browser,
  }) => {
    const email = await signUp(page);
    const workoutId = await createWorkout(page, 'Shared Day');
    const other = await browser.newContext({ locale: 'en-US' });
    const second = await other.newPage();
    await second.goto('/login');
    await second.locator('input[type="email"]').fill(email);
    await second.locator('input[type="password"]').fill(PASSWORD);
    await second.locator('button[type="submit"]').click();
    await second.waitForURL('**/today', { timeout: NETWORK_TIMEOUT });
    await second.goto('/library');
    await expect(second.getByText('Shared Day')).toBeVisible({ timeout: NETWORK_TIMEOUT });

    const detail = (await (await page.request.get(`/api/v1/workouts/${workoutId}`)).json()) as {
      exercises: { id: string; exerciseId: string }[];
    };
    const renamed = await page.request.put(`/api/v1/workouts/${workoutId}`, {
      data: {
        name: 'Renamed Day',
        exercises: detail.exercises.map((item) => ({ id: item.id, exerciseId: item.exerciseId })),
      },
    });
    expect(renamed.ok()).toBe(true);
    await second.reload();
    await expect(second.getByText('Renamed Day')).toBeVisible({ timeout: NETWORK_TIMEOUT });

    expect((await page.request.delete(`/api/v1/workouts/${workoutId}`)).ok()).toBe(true);
    await second.reload();
    await expect(second.getByText('Renamed Day')).toBeHidden({ timeout: NETWORK_TIMEOUT });
    await other.close();
  });
});
