import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { catalogFilters, closeCatalogFilters } from './helpers/catalog';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('gym');
const IP_RANGE = '198.18.8';

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

async function saveGymViaApi(page: Page, equipment: string[]) {
  const response = await page.request.put('/api/v1/me/gym', { data: { equipment } });
  expect(response.ok()).toBe(true);
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const filters = (page: Page) => page.getByRole('search', { name: 'Filters' });

test.describe('gym profile', () => {
  test.use({ locale: 'en-US' });

  test('first visit saves the whole gym, then autosaves changes', async ({ page }, testInfo) => {
    await signUp(page);

    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Set up your gym' })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Set up your gym' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Gym equipment/ })).toContainText('Not set up');

    await page.getByRole('link', { name: 'Set up', exact: true }).click();
    await page.waitForURL('**/profile/gym');
    await expect(page).toHaveTitle('My gym | Pampojo');
    await expect(page.getByRole('button', { pressed: true })).toHaveCount(38);
    const save = page.getByRole('button', { name: 'Save my gym' });
    // The save button sits at the end of the list on every width (DECISIONS 2026-11-14).
    if (testInfo.project.name === 'mobile') await expect(save).not.toBeInViewport();
    await save.scrollIntoViewIfNeeded();
    await expect(save).toBeInViewport();
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    if (testInfo.project.name === 'desktop') {
      const groups = ['Free weights', 'Benches and racks', 'Machines', 'Cables', 'Other'];
      const xs = new Set<number>();
      for (const name of groups) {
        const box = await page.getByRole('region', { name }).boundingBox();
        if (box) xs.add(Math.round(box.x));
      }
      expect(xs.size).toBe(2);
    }

    await chip(page, 'Barbell').click();
    await save.click();
    await expect(page.getByText('Gym saved')).toBeVisible();
    await expect(save).toHaveCount(0);

    await page.reload();
    await expect(chip(page, 'Barbell')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page, 'Dumbbells')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Save my gym' })).toHaveCount(0);

    await chip(page, 'Dumbbells').click();
    await page
      .getByRole('region', { name: 'Cables' })
      .getByRole('button', { name: 'Clear all' })
      .click();
    await expect(page.getByRole('status').filter({ hasText: /^Sav/ })).toHaveText('Saved');
    await page.reload();
    await expect(chip(page, 'Dumbbells')).toHaveAttribute('aria-pressed', 'false');
    await expect(chip(page, 'Cable station')).toHaveAttribute('aria-pressed', 'false');

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Set up your gym' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Gym equipment/ })).toContainText('33 of 38');
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Set up your gym' })).toHaveCount(0);
  });

  test('the catalog chip shows only what a dumbbells and flat bench gym allows', async ({
    page,
  }) => {
    await signUp(page);
    await page.goto('/library/exercises');
    const panel = await catalogFilters(page);
    await expect(panel.getByRole('button', { name: 'Mine', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Available in my gym' })).toHaveCount(0);
    await closeCatalogFilters(page);

    await saveGymViaApi(page, ['dumbbells', 'flat_bench']);
    await page.goto('/library/exercises?q=squat');
    await (await catalogFilters(page)).getByRole('button', { name: 'Available in my gym' }).click();
    await expect(page).toHaveURL(/gym=1/);
    await closeCatalogFilters(page);
    const results = page.getByRole('region', { name: 'Exercises' });
    await expect(results.getByRole('link', { name: /Goblet Squat/ })).toBeVisible();
    await expect(results.getByRole('link', { name: /^Back Squat/ })).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.reload();
    await expect(
      (await catalogFilters(page)).getByRole('button', { name: 'Available in my gym' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await closeCatalogFilters(page);
    await filters(page).getByRole('searchbox').fill('bench press');
    await expect(results.getByRole('link', { name: /Dumbbell Bench Press/ })).toBeVisible();
    await expect(results.getByRole('link', { name: /^Bench Press/ })).toHaveCount(0);

    await results.getByRole('link', { name: /Dumbbell Bench Press/ }).click();
    const gymRow = page.getByRole('definition').filter({ has: page.getByRole('listitem') });
    await expect(gymRow.getByRole('listitem')).toHaveText([
      'Dumbbells',
      'Flat bench or Adjustable bench',
    ]);
  });

  test('offline, the gym controls are disabled with a hint', async ({ page, context }) => {
    await signUp(page);
    await saveGymViaApi(page, ['dumbbells']);
    await page.goto('/profile/gym');
    await expect(chip(page, 'Dumbbells')).toHaveAttribute('aria-pressed', 'true');

    await context.setOffline(true);
    await expect(page.getByText('Needs internet')).toBeVisible();
    await expect(chip(page, 'Dumbbells')).toBeDisabled();
    await expect(
      page.getByRole('region', { name: 'Machines' }).getByRole('button', { name: 'Select all' }),
    ).toBeDisabled();
    await context.setOffline(false);
  });
});
