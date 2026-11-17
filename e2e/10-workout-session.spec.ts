import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('session');
const IP_RANGE = '198.18.10';

let ipCounter = 0;
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${IP_RANGE}.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, IP_RANGE);
});

async function signUp(page: Page) {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(`e2e-${PREFIX}-${randomUUID()}@example.com`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  await completeOnboardingViaApi(page);
}

async function exerciseId(page: Page, q: string): Promise<string> {
  const response = await page.request.get(`/api/v1/exercises?q=${encodeURIComponent(q)}&limit=1`);
  const [item] = ((await response.json()) as { items: { id: string }[] }).items;
  if (!item) throw new Error(`No exercise for ${q}`);
  return item.id;
}

async function createWorkout(page: Page, name: string) {
  const id = randomUUID();
  const bench = await exerciseId(page, 'barbell bench press');
  const plank = await exerciseId(page, 'plank');
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name,
      exercises: [
        {
          id: randomUUID(),
          exerciseId: bench,
          targetSets: 2,
          targetRepsMin: 8,
          targetRepsMax: 10,
          targetWeightKg: 60,
        },
        { id: randomUUID(), exerciseId: plank, targetSets: 1, targetDurationSec: 30 },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  return { id, bench, plank };
}

async function startFromSheet(page: Page, name: string, mobile: boolean) {
  await page.goto('/today');
  const start = mobile
    ? page
        .getByRole('navigation', { name: 'Main navigation' })
        .last()
        .getByRole('button', { name: 'Start workout' })
    : page.getByRole('complementary').getByRole('button', { name: 'Start workout' });
  await start.click();
  await page
    .getByRole('dialog', { name: 'Choose workout' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
  await page.waitForURL('**/session/*');
  return page.url().split('/session/')[1]!;
}

test.describe('workout session', () => {
  test.use({ locale: 'en-US', colorScheme: 'dark' });
  test('discards a workout after confirming (AC9)', async ({ page }, testInfo) => {
    // On CI each API call can take 1-5 s, and the outbox sends the PUT and the PATCH in turn.
    test.slow();
    await signUp(page);
    await createWorkout(page, 'Discard Day');
    const sessionId = await startFromSheet(page, 'Discard Day', testInfo.project.name === 'mobile');
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Discard workout' }).click();
    await page
      .getByRole('dialog', { name: 'Discard this workout?' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.waitForURL('**/today');
    await expect
      .poll(async () => (await page.request.get(`/api/v1/sessions/${sessionId}`)).status(), {
        timeout: 20_000,
      })
      .toBe(404);
  });

  test.describe('in Ukrainian', () => {
    test.use({ locale: 'uk-UA' });

    test('the set controls and the rest bar fit the screen (AC16)', async ({
      page,
      context,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'The 390px phone is the tight case');
      await context.addCookies([{ name: 'lang', value: 'uk', url: 'http://localhost:3000' }]);
      await signUp(page);
      await createWorkout(page, 'Fit Day');
      await page.goto('/today');
      const start = page
        .getByRole('navigation', { name: 'Головна навігація' })
        .last()
        .getByRole('button', { name: 'Почати тренування' });
      await start.click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /Fit Day/ })
        .click();
      await page.waitForURL('**/session/*');
      await page.getByRole('button', { name: 'Позначити підхід 1', exact: true }).click();

      const width = page.viewportSize()!.width;
      for (const name of [
        'Додати підхід',
        'Прибрати підхід',
        'Плюс 15 секунд',
        'Пропустити відпочинок',
      ]) {
        const box = await page
          .getByRole('button', { name, exact: true })
          .filter({ visible: true })
          .first()
          .boundingBox();
        expect(box, name).not.toBeNull();
        expect(box!.x + box!.width, name).toBeLessThanOrEqual(width);
      }
      expect(await page.evaluate(() => innerWidth)).toBe(width);
    });
  });
});
