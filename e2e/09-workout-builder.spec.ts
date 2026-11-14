import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('workouts');
const IP_RANGE = '198.18.9';

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

async function createWorkoutViaApi(page: Page, name: string, exerciseIds: string[]) {
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name,
      exercises: exerciseIds.map((exercise) => ({ id: randomUUID(), exerciseId: exercise })),
    },
  });
  expect(response.ok()).toBe(true);
  return id;
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

const rows = (page: Page) =>
  page.getByRole('region', { name: 'Exercises' }).getByRole('button', { name: /^Drag / });
const rowNames = async (page: Page) =>
  (await rows(page).all()).map(async (row) =>
    (await row.getAttribute('aria-label'))?.replace('Drag ', ''),
  );

async function names(page: Page) {
  return Promise.all(await rowNames(page));
}

async function dragTo(page: Page, source: Locator, target: Locator, below = false) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('No box');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  const y = below ? to.y + to.height * 0.8 : to.y + to.height * 0.2;
  await page.mouse.move(to.x + to.width / 2, y, { steps: 12 });
  await page.mouse.up();
  // dnd-kit swallows a click in the same moment as the drop; a person never clicks that fast.
  await page.waitForTimeout(300);
}

test.describe('workout builder', () => {
  test.use({ locale: 'en-US' });

  test('creates a workout with three exercises and reopens it (AC1, AC3, AC6, AC9)', async ({
    page,
  }, testInfo) => {
    await signUp(page);
    await page.goto('/library/workouts');
    await expect(page.getByRole('heading', { name: 'No workouts yet' })).toBeVisible();
    await page.getByRole('link', { name: 'Create workout' }).last().click();
    await page.waitForURL('**/library/workouts/new');
    await page.getByRole('textbox', { name: 'Name' }).fill('Push Day');

    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Add exercises' }).click();
      const picker = page.getByRole('dialog', { name: 'Add exercises' });
      await picker.getByRole('searchbox').fill('bench press');
      await picker
        .getByRole('button', { name: /^Bench Press/ })
        .first()
        .click();
      await picker.getByRole('searchbox').fill('plank');
      await picker
        .getByRole('button', { name: /^Plank/ })
        .first()
        .click();
      await picker.getByRole('searchbox').fill('bench press');
      // Picks survive a new search; the same exercise may be added again later.
      await picker.getByRole('button', { name: 'Add 2 exercises' }).click();
      await page.getByRole('button', { name: 'Add exercises' }).click();
      await picker.getByRole('searchbox').fill('bench press');
      await picker
        .getByRole('button', { name: /^Bench Press/ })
        .first()
        .click();
      await picker.getByRole('button', { name: 'Add 1 exercise' }).click();
    } else {
      const catalog = page.getByRole('region', { name: 'Catalog' });
      for (const [q, name] of [
        ['bench press', 'Bench Press'],
        ['plank', 'Plank'],
        ['bench press', 'Bench Press'],
      ]) {
        await catalog.getByRole('searchbox').fill(q!);
        await catalog
          .getByRole('button', { name: `Add ${name}`, exact: true })
          .first()
          .click();
      }
    }
    await expect.poll(() => names(page)).toEqual(['Bench Press', 'Plank', 'Bench Press']);

    await page
      .getByRole('button', { name: /^Bench Press/ })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: 'Bench Press' });
    await expect(sheet.getByRole('textbox', { name: 'Sets' })).toHaveValue('3');
    await expect(sheet.getByRole('textbox', { name: 'Weight, kg' })).toHaveValue('');
    await sheet.getByRole('textbox', { name: 'Weight, kg' }).fill('80');
    await sheet.getByRole('textbox', { name: 'Note' }).fill('Pause at the bottom');
    await sheet.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: /^Plank/ }).click();
    const plank = page.getByRole('dialog', { name: 'Plank' });
    await expect(plank.getByRole('textbox', { name: 'Weight, kg' })).toHaveCount(0);
    await plank.getByRole('textbox', { name: 'Duration, s' }).fill('45');
    await plank.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('**/library/workouts');
    await expect(page.getByText('Workout saved')).toBeVisible();
    const card = page.getByRole('link', { name: /Push Day/ });
    await expect(card).toContainText('3 exercises');

    await card.click();
    await expect.poll(() => names(page)).toEqual(['Bench Press', 'Plank', 'Bench Press']);
    await expect(page.getByRole('button', { name: /^Bench Press/ }).first()).toContainText(
      '3 × 8–12, 80 kg',
    );
    await expect(page.getByRole('button', { name: /^Bench Press/ }).first()).toContainText(
      'Pause at the bottom',
    );
    await expect(page.getByRole('button', { name: /^Plank/ })).toContainText('3 × 45 s');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('a new workout left without saving is not listed (AC1, AC7)', async ({ page }) => {
    await signUp(page);
    await page.goto('/library/workouts/new');
    await page.getByRole('textbox', { name: 'Name' }).fill('Draft');
    await page.getByRole('link', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await page.waitForURL('**/library/workouts');
    await expect(page.getByRole('heading', { name: 'No workouts yet' })).toBeVisible();
  });

  test('desktop: drags to reorder and drops a catalog exercise in place (AC2, AC8)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop drag');
    await signUp(page);
    const [bench, plank] = [await exerciseId(page, 'bench press'), await exerciseId(page, 'plank')];
    const id = await createWorkoutViaApi(page, 'Order', [bench, plank]);
    await page.goto(`/library/workouts/${id}`);
    await expect.poll(() => names(page)).toEqual(['Bench Press', 'Plank']);

    await dragTo(page, rows(page).nth(0), rows(page).nth(1), true);
    await expect.poll(() => names(page)).toEqual(['Plank', 'Bench Press']);

    const catalog = page.getByRole('region', { name: 'Catalog' });
    await catalog.getByRole('searchbox').fill('push-up');
    const source = catalog
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: 'Add Push-Up', exact: true }) })
      .first();
    await dragTo(page, source, rows(page).nth(1));
    await expect.poll(() => names(page)).toEqual(['Plank', 'Push-Up', 'Bench Press']);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('**/library/workouts');
    await page.goto(`/library/workouts/${id}`);
    await expect.poll(() => names(page)).toEqual(['Plank', 'Push-Up', 'Bench Press']);
  });

  test('mobile: drags to reorder by touch (AC2)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch drag');
    await signUp(page);
    const [bench, plank] = [await exerciseId(page, 'bench press'), await exerciseId(page, 'plank')];
    const id = await createWorkoutViaApi(page, 'Order', [bench, plank]);
    await page.goto(`/library/workouts/${id}`);
    await expect.poll(() => names(page)).toEqual(['Bench Press', 'Plank']);
    await dragTo(page, rows(page).nth(0), rows(page).nth(1), true);
    await expect.poll(() => names(page)).toEqual(['Plank', 'Bench Press']);
  });

  test('duplicates and deletes a workout (AC11)', async ({ page }) => {
    await signUp(page);
    await createWorkoutViaApi(page, 'Push Day', [await exerciseId(page, 'bench press')]);
    await page.goto('/library/workouts');
    await page.getByRole('button', { name: 'Actions for Push Day' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForURL(/\/library\/workouts\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Push Day (copy)');

    await page.goto('/library/workouts');
    await page.getByRole('button', { name: 'Actions for Push Day (copy)' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete "Push Day (copy)"?' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('link', { name: /Push Day \(copy\)/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^Push Day/ })).toHaveCount(1);
  });

  test('is read-only offline (AC12)', async ({ page, context }) => {
    await signUp(page);
    const id = await createWorkoutViaApi(page, 'Push Day', [await exerciseId(page, 'bench press')]);
    await page.goto('/library/workouts');
    await expect(page.getByRole('link', { name: /Push Day/ })).toBeVisible();
    await page.goto(`/library/workouts/${id}`);
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Push Day');

    await context.setOffline(true);
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(page.getByText('Needs internet')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await context.setOffline(false);
  });

  test('deleting an own exercise empties the workout that used it (AC13)', async ({ page }) => {
    await signUp(page);
    const own = randomUUID();
    const created = await page.request.put(`/api/v1/exercises/${own}`, {
      data: {
        name: `Band pull ${own.slice(0, 6)}`,
        primaryMuscles: ['shoulders'],
        equipment: ['band'],
        trackingType: 'reps',
      },
    });
    expect(created.ok()).toBe(true);
    await createWorkoutViaApi(page, 'Bands', [own]);

    await page.goto(`/library/exercises/${own}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('It will also be removed from these workouts:')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Bands' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL('**/library/exercises');

    await page.goto('/library/workouts');
    const card = page.getByRole('link', { name: /Bands/ });
    await expect(card).toContainText('0 exercises');
    await expect(card).toContainText('Add exercises');
  });
});

for (const locale of ['en-US', 'uk-UA'] as const) {
  test.describe(`no horizontal scroll in ${locale}`, () => {
    test.use({ locale });

    test('list, editor, sheet and picker fit the viewport (AC15)', async ({ page }, testInfo) => {
      await signUp(page);
      const id = await createWorkoutViaApi(page, 'A rather long workout name for layout checks', [
        await exerciseId(page, 'bench press'),
      ]);
      await page.goto('/library/workouts');
      await page.waitForLoadState('networkidle');
      expect(await overflow(page), 'list').toBeLessThanOrEqual(0);
      await page.goto(`/library/workouts/${id}`);
      await page.waitForLoadState('networkidle');
      expect(await overflow(page), 'editor').toBeLessThanOrEqual(0);
      await page
        .getByRole('button', { name: /^(Bench Press|Жим штанги лежачи)/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await overflow(page), 'sheet').toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      if (testInfo.project.name === 'mobile') {
        await page.getByRole('button', { name: /^(Add exercises|Додати вправи)$/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        expect(await overflow(page), 'picker').toBeLessThanOrEqual(0);
      }
    });
  });
}
