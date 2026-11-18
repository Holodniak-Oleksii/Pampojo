import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';
import { insertCompletedSessionWithSets } from './helpers/plan';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('progress');
const IP_RANGE = '198.18.13';
// On CI each API call takes 1-5 s, and a start or a page load waits for several of them in a row.
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

async function benchWorkout(page: Page): Promise<{ workoutId: string; bench: string }> {
  const search = await page.request.get('/api/v1/exercises?q=barbell%20bench%20press&limit=1');
  const [item] = ((await search.json()) as { items: { id: string }[] }).items;
  const bench = item!.id;
  const workoutId = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${workoutId}`, {
    data: {
      name: 'Push Day',
      exercises: [
        { id: randomUUID(), exerciseId: bench, targetSets: 1, targetRepsMin: 3, targetRepsMax: 5 },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  return { workoutId, bench };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

const overflow = (page: Page) =>
  page.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width);

test.describe('strength progress', () => {
  test.use({ locale: 'en-US' });
  test.slow();

  test('a heavier set is a new record in the summary and on /progress (AC2)', async ({
    page,
  }, testInfo) => {
    const email = await signUp(page);
    const { workoutId, bench } = await benchWorkout(page);
    await insertCompletedSessionWithSets(email, workoutId, {
      startedAt: daysAgo(9),
      sets: [{ exerciseId: bench, weightKg: 80, reps: 8 }],
    });
    await insertCompletedSessionWithSets(email, workoutId, {
      startedAt: daysAgo(2),
      sets: [{ exerciseId: bench, weightKg: 85, reps: 5 }],
    });

    await page.goto('/today');
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
      .getByRole('button', { name: /Push Day/ })
      .click();
    await page.waitForURL('**/session/*', { timeout: NETWORK_TIMEOUT });
    const sessionId = page.url().split('/session/')[1]!;

    await page.getByRole('textbox', { name: 'Set 1, weight' }).fill('90');
    await page.getByRole('textbox', { name: 'Set 1, reps' }).fill('3');
    await page.getByRole('button', { name: 'Check set 1', exact: true }).click();
    await page.getByRole('button', { name: 'Finish', exact: true }).click();

    const records = page.getByRole('region', { name: 'New records' });
    await expect(records).toBeVisible({ timeout: NETWORK_TIMEOUT });
    await expect(records.getByText('Heaviest weight')).toBeVisible();
    await expect(records.getByText('90 kg')).toBeVisible();

    // The finish reaches the server through the outbox; then /progress shows the record.
    await expect
      .poll(async () => (await page.request.get(`/api/v1/sessions/${sessionId}`)).json(), {
        timeout: NETWORK_TIMEOUT,
      })
      .toMatchObject({ status: 'completed' });
    await page.goto(`/progress?exercise=${bench}`);
    const row = page.getByRole('link', { name: /Heaviest weight/ });
    await expect(row).toBeVisible({ timeout: NETWORK_TIMEOUT });
    await expect(row).toContainText('90 kg');
    await expect(row).toHaveAttribute('href', `/session/${sessionId}`);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('a new user sees the empty state (AC5)', async ({ page }) => {
    await signUp(page);
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'No progress yet' })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await expect(page.getByRole('button', { name: 'Start workout' }).last()).toBeVisible();
  });
});

test.describe('progress in Ukrainian and dark', () => {
  test.use({ locale: 'uk-UA', colorScheme: 'dark' });
  test.slow();

  test('the screen fits with no horizontal scroll (AC11)', async ({ page, context }) => {
    await context.addCookies([{ name: 'lang', value: 'uk', url: 'http://localhost:3000' }]);
    const email = await signUp(page);
    const { workoutId, bench } = await benchWorkout(page);
    for (const [days, weightKg] of [
      [30, 80],
      [16, 82.5],
      [2, 87.5],
    ] as const) {
      await insertCompletedSessionWithSets(email, workoutId, {
        startedAt: daysAgo(days),
        sets: [{ exerciseId: bench, weightKg, reps: 5 }],
      });
    }
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Рекорди' })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await expect(page.getByRole('img', { name: /^Оцінка 1ПМ, / })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
