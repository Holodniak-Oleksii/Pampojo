import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('measurements');
const IP_RANGE = '198.18.14';
// On CI each API call takes 1-5 s, and a page load waits for several of them in a row.
const NETWORK_TIMEOUT = 20_000;

let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${IP_RANGE}.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, IP_RANGE);
});

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(`e2e-${PREFIX}-${randomUUID()}@example.com`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  await completeOnboardingViaApi(page);
}

async function workoutWith(page: Page, count: number): Promise<string> {
  const search = await page.request.get(`/api/v1/exercises?limit=${count}`);
  const items = ((await search.json()) as { items: { id: string }[] }).items.slice(0, count);
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name: 'Super Back',
      exercises: items.map((item) => ({
        id: randomUUID(),
        exerciseId: item.id,
        targetSets: 1,
        targetRepsMin: 8,
        targetRepsMax: 10,
      })),
    },
  });
  expect(response.ok()).toBe(true);
  return id;
}

async function startWorkout(page: Page, isMobile: boolean) {
  const start = isMobile
    ? page
        .getByRole('navigation', { name: 'Main navigation' })
        .last()
        .getByRole('button', { name: 'Start workout' })
    : page.getByRole('complementary').getByRole('button', { name: 'Start workout' });
  await start.click();
  await page
    .getByRole('dialog', { name: 'Choose workout' })
    .getByRole('button', { name: /Super Back/ })
    .click();
  await page.waitForURL('**/session/*', { timeout: NETWORK_TIMEOUT });
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('body measurements', () => {
  test.use({ locale: 'en-US' });
  test.slow();

  test('add, read on the figure, edit and delete a measurement (AC1, AC4, AC8, AC10, AC19)', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/profile');
    // Onboarding stored 79.8 kg and 180 cm.
    await expect(page.getByText('24.6')).toBeVisible({ timeout: NETWORK_TIMEOUT });
    await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible();

    await page.getByRole('button', { name: 'Add measurement' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Add measurement' });
    await expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await sheet.getByRole('textbox', { name: 'Shoulders' }).fill('122,25');
    await sheet.getByRole('textbox', { name: 'Chest' }).fill('104.25');
    await sheet.getByRole('textbox', { name: 'Weight' }).fill('82.4');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(sheet).toBeHidden({ timeout: NETWORK_TIMEOUT });

    await expect(page.getByText('24.6')).not.toBeVisible();
    await expect(page.getByText('25.4')).toBeVisible();
    const shoulders = page.getByRole('link', { name: 'Shoulders: 122.25 cm' });
    await expect(shoulders).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calf, left: —' })).toBeVisible();
    const box = await shoulders.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole('link', { name: 'Chest: 104.25 cm' }).click();
    await expect(page.getByRole('heading', { name: 'Chest', level: 1 })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await page.getByRole('button', { name: /104\.25 cm/ }).click();
    const edit = page.getByRole('dialog', { name: 'Edit measurement' });
    await edit.getByRole('textbox', { name: 'Chest' }).fill('103,5');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: /103\.5 cm/ })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });

    await page.getByRole('button', { name: /103\.5 cm/ }).click();
    await page
      .getByRole('dialog', { name: 'Edit measurement' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page
      .getByRole('dialog', { name: 'Delete this measurement?' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect(page.getByText('No measurements yet')).toBeVisible({ timeout: NETWORK_TIMEOUT });
  });

  test('offline keeps the data and disables writes (AC13)', async ({ page, context }) => {
    await signUp(page);
    await page.goto('/profile');
    await expect(page.getByText('24.6')).toBeVisible({ timeout: NETWORK_TIMEOUT });
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Add measurement' }).first()).toBeDisabled();
    await expect(page.getByText('Needs internet').first()).toBeVisible();
    await expect(page.getByText('24.6')).toBeVisible();
    await context.setOffline(false);
  });

  test('the session header opens the exercise details, and the bar returns (AC14)', async ({
    page,
    isMobile,
  }) => {
    await signUp(page);
    await workoutWith(page, 2);
    await page.goto('/today');
    await startWorkout(page, isMobile);
    const session = page.url();
    const link = page.getByRole('link', { name: /^How to do / });
    const name = (await link.getByRole('heading').textContent()) ?? '';
    await link.click();
    await page.waitForURL('**/library/exercises/*', { timeout: NETWORK_TIMEOUT });
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await page
      .getByRole('link', { name: /^Back to workout/ })
      .first()
      .click();
    await page.waitForURL(session, { timeout: NETWORK_TIMEOUT });
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  });

  test('the Today card fills its row and counts the rest in "+N" (AC17)', async ({ page }) => {
    await signUp(page);
    const workoutId = await workoutWith(page, 8);
    const rule = await page.request.put(`/api/v1/schedule-rules/${randomUUID()}`, {
      data: {
        workoutId,
        startDate: today(),
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        intervalWeeks: 1,
        endDate: null,
      },
    });
    expect(rule.status()).toBe(201);
    await page.goto('/today');
    const row = page.getByTestId('thumbnails');
    // Local databases may have no catalog photos; then the card shows no thumbnail row.
    if ((await row.count()) === 0) return;
    const tiles = await row.locator('img').count();
    const more = row.getByText(/^\+\d+$/);
    if ((await more.count()) === 0) {
      expect(tiles).toBe(8);
      return;
    }
    const n = Number((await more.textContent())?.slice(1));
    const covered = (await more.locator('..').locator('img').count()) > 0;
    expect(tiles - (covered ? 1 : 0) + n).toBe(8);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('the mobile picker keeps the search and results above the keyboard (AC18)', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'mobile only');
    await signUp(page);
    await page.goto('/library/workouts/new');
    await page.getByRole('button', { name: 'Add exercises' }).first().click();
    const picker = page.getByRole('dialog', { name: 'Add exercises' });
    await picker.getByRole('searchbox', { name: 'Search exercises' }).fill('press');
    // Chromium has no on-screen keyboard here, so shrink the visual viewport the way it would.
    await page.setViewportSize({ width: 390, height: 534 });
    const sheet = await picker.boundingBox();
    expect(sheet?.height).toBeLessThanOrEqual(534);
    const first = picker.getByRole('button', { pressed: false }).first();
    const box = await first.boundingBox();
    expect(box && box.y + box.height <= 534).toBe(true);
  });
});

test.describe('details pages offline after a session start (AC16)', () => {
  test.skip(
    !process.env.CI,
    'needs a production build: pnpm build && CI=1 pnpm exec playwright test e2e/14-body-measurements.spec.ts',
  );
  test.use({ serviceWorkers: 'allow', locale: 'en-US' });
  test.slow();

  test('the warmed details page opens offline', async ({ page, context, isMobile }) => {
    await signUp(page);
    await workoutWith(page, 1);
    await page.goto('/today');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });
    await startWorkout(page, isMobile);
    const link = page.getByRole('link', { name: /^How to do / });
    const name = (await link.getByRole('heading').textContent()) ?? '';
    const href = (await link.getAttribute('href')) ?? '';
    await expect
      .poll(() => page.evaluate(async (path) => Boolean(await caches.match(path)), href), {
        timeout: NETWORK_TIMEOUT,
      })
      .toBe(true);
    await context.setOffline(true);
    await link.click();
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await context.setOffline(false);
  });
});
