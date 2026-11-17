import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi, ONBOARDING_BODY } from './helpers/onboarding';
import { insertCompletedSessions, insertPastRule } from './helpers/plan';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('history');
const IP_RANGE = '198.18.12';

let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${IP_RANGE}.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, IP_RANGE);
});

/** Today in the profile time zone the onboarding helper sets. */
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ONBOARDING_BODY.timeZone }).format(new Date());

function shift(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Noon of a date in the profile zone, which is never more than 14 hours from UTC. */
const noonOf = (date: string) => new Date(`${date}T12:00:00Z`);

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
  const search = await page.request.get('/api/v1/exercises?q=plank&limit=1');
  const [plank] = ((await search.json()) as { items: { id: string }[] }).items;
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name,
      exercises: [
        { id: randomUUID(), exerciseId: plank!.id, targetSets: 1, targetDurationSec: 30 },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  return id;
}

const overflow = (page: Page) =>
  page.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width);

// On CI each API call takes 1-5 s, and a start or a page load waits for several of them in a row.
const NETWORK_TIMEOUT = 20_000;

test.describe('history and adherence', () => {
  test.use({ locale: 'en-US' });
  test.slow();

  test('a missed day is made up from the dialog and then shows as done late (AC4, AC6, AC7)', async ({
    page,
  }) => {
    const email = await signUp(page);
    const workoutId = await createWorkout(page, 'Push Day');
    const missed = shift(today(), -1);
    await insertPastRule(email, workoutId, missed);

    await page.goto(`/calendar?date=${missed}`);
    await expect(page.getByText('Missed', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Make up' })).toBeVisible();

    await page.getByRole('button', { name: 'Start workout' }).first().click();
    await page
      .getByRole('dialog')
      .last()
      .getByRole('button', { name: /Push Day/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog', { name: /^Make up .*'s Push Day\?$/ });
    await expect(dialog).toBeVisible({ timeout: NETWORK_TIMEOUT });
    const put = page.waitForRequest(
      (request) => request.method() === 'PUT' && /\/api\/v1\/sessions\/[^/]+$/.test(request.url()),
    );
    await dialog.getByRole('button', { name: 'Yes, make it up' }).click();
    expect((await put).postDataJSON()).toMatchObject({ scheduledFor: missed });
    await page.waitForURL('**/session/**');

    // A make-up finished on another device: the calendar shows the day as done late.
    await insertCompletedSessions(email, workoutId, [
      { startedAt: new Date(), scheduledFor: missed },
    ]);
    await page.goto(`/calendar?date=${missed}`);
    const row = page.getByRole('link', { name: /Push Day.*Done late/ }).first();
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute('href', /\/session\//);
  });

  test('the history list loads older workouts as it scrolls (AC5)', async ({ page }) => {
    const email = await signUp(page);
    const workoutId = await createWorkout(page, 'Push Day');
    await insertCompletedSessions(
      email,
      workoutId,
      Array.from({ length: 25 }, (_, index) => ({
        startedAt: noonOf(shift(today(), -(index + 1))),
        name: `Workout ${index + 1}`,
      })),
    );
    await page.goto('/calendar?view=list');
    const rows = page.getByRole('link', { name: /Workout \d+/ });
    await expect(rows).toHaveCount(20, { timeout: NETWORK_TIMEOUT });
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows).toHaveCount(25, { timeout: NETWORK_TIMEOUT });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('history in Ukrainian and dark', () => {
  test.use({ locale: 'uk-UA', colorScheme: 'dark' });

  test('calendar, list and Today fit the screen (AC10, AC12)', async ({ page, context }) => {
    await context.addCookies([{ name: 'lang', value: 'uk', url: 'http://localhost:3000' }]);
    const email = await signUp(page);
    const workoutId = await createWorkout(page, 'Ноги');
    await insertPastRule(email, workoutId, shift(today(), -2));
    await insertCompletedSessions(email, workoutId, [
      { startedAt: noonOf(shift(today(), -2)), scheduledFor: shift(today(), -2) },
    ]);

    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Цей тиждень' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Останнє тренування' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: 'Дотримання плану' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.goto('/calendar?view=list');
    await expect(page.getByText('Вчасно').first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
