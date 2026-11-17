import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi, ONBOARDING_BODY } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('plan');
const IP_RANGE = '198.18.11';

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

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(`e2e-${PREFIX}-${randomUUID()}@example.com`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  await completeOnboardingViaApi(page);
}

async function createWorkout(page: Page, name: string) {
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

async function createRule(page: Page, workoutId: string, weekdays = [1, 2, 3, 4, 5, 6, 7]) {
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/schedule-rules/${id}`, {
    data: { workoutId, startDate: today(), weekdays, intervalWeeks: 1, endDate: null },
  });
  expect(response.status()).toBe(201);
  return id;
}

async function rules(page: Page) {
  const response = await page.request.get('/api/v1/schedule-rules');
  return (
    (await response.json()) as {
      items: { id: string; startDate: string; endDate: string | null; intervalWeeks: number }[];
    }
  ).items;
}

// A phone zooms out to fit wide content, which grows innerWidth too, so compare with the screen.
const overflow = (page: Page) =>
  page.evaluate(() => Math.max(document.documentElement.scrollWidth, innerWidth) - screen.width);

test.describe('calendar plan', () => {
  test.use({ locale: 'en-US' });

  test('schedules from the form, shows the markers and links a start from today (AC1, AC4, AC10)', async ({
    page,
  }) => {
    await signUp(page);
    await createWorkout(page, 'Push Day');
    await page.goto('/calendar');
    await expect(page.getByText('Nothing planned on this day.')).toBeVisible();
    await page.getByRole('button', { name: 'Schedule workout' }).first().click();

    const form = page.getByRole('dialog', { name: 'Schedule workout' });
    await expect(form.getByLabel('Workout')).toHaveValue(/.+/);
    await expect(form.getByLabel('Start date')).toHaveValue(today());
    await form.getByText('After', { exact: true }).click();
    await form.getByLabel('Number of workouts').fill('3');
    await expect(form.getByText(/^Last: /)).toBeVisible();
    await form.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(form).toBeHidden();

    const [rule] = await rules(page);
    // One weekday, three times: the end is two weeks after the start.
    expect(rule).toMatchObject({ startDate: today(), endDate: shift(today(), 14) });
    // Markers on today's weekday only, up to the end date.
    await expect(page.getByRole('gridcell', { name: /, planned/ }).first()).toBeVisible();
    const marked = await page
      .getByRole('gridcell', { name: /, planned/ })
      .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('data-date')));
    const expected = [today(), shift(today(), 7), shift(today(), 14)];
    expect(marked.every((date) => expected.includes(date ?? ''))).toBe(true);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForURL('**/session/*');
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/v1/sessions?scheduledFor=${today()}`);
        return ((await response.json()) as { items: unknown[] }).items.length;
      })
      .toBe(1);
  });
  test('stays readable but read-only offline (AC9)', async ({ page, context }) => {
    await signUp(page);
    const workoutId = await createWorkout(page, 'Push Day');
    await createRule(page, workoutId);
    await page.goto('/calendar');
    await expect(page.getByRole('button', { name: 'Actions for Push Day' })).toBeEnabled();

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText('Needs internet to change the schedule.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule workout' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Actions for Push Day' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
    await context.setOffline(false);
  });
});

test.describe('calendar plan in Ukrainian, dark', () => {
  test.use({ locale: 'uk-UA', colorScheme: 'dark' });

  test('fits the screen on the calendar, Today and the sheet (AC10)', async ({ page, context }) => {
    await context.addCookies([{ name: 'lang', value: 'uk', url: 'http://localhost:3000' }]);
    await signUp(page);
    const workoutId = await createWorkout(page, 'Руки й плечі');
    await createRule(page, workoutId);

    await page.goto('/calendar');
    await expect(page.getByRole('heading', { name: /^Сьогодні, / })).toBeVisible();
    await expect(page.getByText('Щодня')).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Запланувати тренування' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Запланувати тренування' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Сьогодні за планом' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
