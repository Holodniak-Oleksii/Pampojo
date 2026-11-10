import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

// Relies on the seeded system catalog (`pnpm db:seed`, run by CI after migrations).
const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('catalog');
const IP_RANGE = '198.18.6';

let ipCounter = 0;
// Each test gets its own client IP so the sign-in rate limit never spans tests.
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `${IP_RANGE}.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, IP_RANGE);
});

async function signUp(page: Page, { onboard = true } = {}) {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(`e2e-${PREFIX}-${randomUUID()}@example.com`);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  if (onboard) await completeOnboardingViaApi(page);
}

const results = (page: Page) => page.getByRole('region', { name: /^(Exercises|Вправи)$/ });
const filters = (page: Page) => page.getByRole('search', { name: /^(Filters|Фільтри)$/ });
const items = (page: Page) => results(page).getByRole('link');
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('exercise catalog in English', () => {
  test.use({ locale: 'en-US' });

  test('groups the catalog by muscle and finds Bench Press by English and Ukrainian search', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/library/exercises');
    await expect(page).toHaveTitle('Exercises · Pampojo');

    await expect(results(page).getByRole('heading', { level: 2 }).first()).toHaveText('Chest');
    await expect(items(page).first()).toContainText('Bench Press');

    await filters(page).getByRole('searchbox', { name: 'Search exercises' }).fill('bench');
    await expect(page).toHaveURL(/q=bench/);
    await expect(items(page).first()).toContainText('Bench Press');
    await expect(results(page).getByRole('heading', { level: 2 })).toHaveCount(0);

    await filters(page).getByRole('searchbox').fill('жим');
    await expect(items(page).first()).toBeVisible();
    await expect(items(page).filter({ hasText: /^Bench Press/ })).toHaveCount(1);
  });

  test('combines muscle chips with equipment, keeps them in the URL and clears them', async ({
    page,
  }, testInfo) => {
    await signUp(page);
    await page.goto('/library/exercises');
    const total = await items(page).count();

    await filters(page).getByRole('button', { name: 'Triceps', exact: true }).click();
    await expect(page).toHaveURL(/muscle=triceps/);
    if (testInfo.project.name === 'mobile') {
      await filters(page).getByRole('button', { name: 'Equipment' }).click();
      await page.getByRole('menuitemcheckbox', { name: 'Cable' }).click();
      await page.keyboard.press('Escape');
    } else {
      // The checked state follows the URL, which Next.js applies in a transition after the click.
      await filters(page).getByRole('checkbox', { name: 'Cable' }).click();
      await expect(filters(page).getByRole('checkbox', { name: 'Cable' })).toBeChecked();
    }
    await expect(page).toHaveURL(/muscle=triceps&equipment=cable/);
    await expect(items(page).first()).toContainText('Pushdown');
    for (const item of await items(page).all()) await expect(item).toContainText('Cable');

    await page.reload();
    await expect(
      filters(page).getByRole('button', { name: 'Triceps', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(items(page).first()).toContainText('Pushdown');

    await filters(page).getByRole('searchbox').fill('zzzz-no-such-exercise');
    await expect(page.getByRole('heading', { name: 'No exercises found' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/library\/exercises$/);
    await expect(filters(page).getByRole('searchbox')).toHaveValue('');
    await expect(items(page)).toHaveCount(total);
  });

  test('loads more exercises when scrolled to the end', async ({ page }) => {
    await signUp(page);
    await page.goto('/library/exercises');
    await expect(items(page)).toHaveCount(30);

    await page.getByRole('button', { name: 'Show more' }).scrollIntoViewIfNeeded();
    await expect.poll(() => items(page).count()).toBeGreaterThan(30);
  });

  test('opens details, returns with Back and with the back link to the same list', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/library/exercises?muscle=chest');
    await items(page)
      .filter({ hasText: /^Bench Press/ })
      .click();
    await page.waitForURL(/\/library\/exercises\/[0-9a-f-]{36}$/);

    await expect(page.getByRole('heading', { level: 1, name: 'Bench Press' })).toBeVisible();
    await expect(page).toHaveTitle('Bench Press · Pampojo');
    await expect(page.getByRole('heading', { name: 'How to do it' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Common mistakes' })).toBeVisible();
    for (const term of ['Primary', 'Equipment', 'Movement', 'Type', 'Sides', 'Tracking', 'Level']) {
      await expect(page.getByRole('term').filter({ hasText: term })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Exercises', exact: true })).toHaveAttribute(
      'href',
      '/library/exercises?muscle=chest',
    );
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.goBack();
    await expect(page).toHaveURL(/\/library\/exercises\?muscle=chest$/);
    await expect(filters(page).getByRole('button', { name: 'Chest', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await items(page).first().click();
    await page.waitForURL(/\/library\/exercises\/[0-9a-f-]{36}$/);
    await page.getByRole('link', { name: 'Exercises', exact: true }).click();
    await expect(page).toHaveURL(/\/library\/exercises\?muscle=chest$/);
  });

  test('shows the not-found state for unknown and invalid ids', async ({ page }) => {
    await signUp(page);
    for (const id of [randomUUID(), 'not-a-uuid']) {
      await page.goto(`/library/exercises/${id}`);
      await expect(page.getByRole('heading', { name: 'Exercise not found' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to exercises' })).toHaveAttribute(
        'href',
        '/library/exercises',
      );
    }
  });

  test('keeps the list and shows the offline notice when the connection drops', async ({
    page,
    context,
  }) => {
    await signUp(page);
    await page.goto('/library/exercises');
    await expect(items(page).first()).toContainText('Bench Press');

    await context.setOffline(true);
    await filters(page).getByRole('button', { name: 'Neck', exact: true }).click();

    await expect(
      page.getByText("You're offline. Connect to the internet to load exercises."),
    ).toBeVisible();
    await expect(items(page).first()).toContainText('Bench Press');
    await context.setOffline(false);
  });

  test('sends a user without a profile from /today and /profile to onboarding', async ({
    page,
  }) => {
    await signUp(page, { onboard: false });
    for (const route of ['/today', '/profile']) {
      await page.goto(route);
      await page.waitForURL('**/onboarding');
    }
  });
});

test.describe('exercise catalog layout', () => {
  for (const locale of ['en-US', 'uk-UA']) {
    test.describe(locale, () => {
      test.use({ locale });

      test('fits the viewport with tall rows on mobile and a side column on desktop', async ({
        page,
      }, testInfo) => {
        await signUp(page);
        await page.goto('/library/exercises');
        await expect(items(page).first()).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);

        if (testInfo.project.name === 'mobile') {
          expect((await items(page).first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
        } else {
          const side = await filters(page).boundingBox();
          const [first, second] = [
            await items(page).nth(0).boundingBox(),
            await items(page).nth(1).boundingBox(),
          ];
          expect((side?.x ?? 0) + (side?.width ?? 0)).toBeLessThanOrEqual(first?.x ?? 0);
          expect(Math.round(first?.y ?? 0)).toBe(Math.round(second?.y ?? -1));
        }
      });
    });
  }

  test.describe('Ukrainian content', () => {
    test.use({ locale: 'uk-UA' });

    test('shows catalog text and labels in Ukrainian', async ({ page }) => {
      await signUp(page);
      await page.goto('/library/exercises');
      await expect(page).toHaveTitle('Вправи · Pampojo');
      await expect(results(page).getByRole('heading', { level: 2 }).first()).toHaveText('Груди');
      await expect(items(page).first()).toContainText('Жим штанги лежачи');
      await expect(
        filters(page).getByRole('button', { name: 'Трицепс', exact: true }),
      ).toBeVisible();

      await items(page).first().click();
      await page.waitForURL(/\/library\/exercises\/[0-9a-f-]{36}$/);
      await expect(page.getByRole('heading', { name: 'Як виконувати' })).toBeVisible();
      await expect(page.getByRole('term').filter({ hasText: 'Обладнання' })).toBeVisible();
    });
  });
});
