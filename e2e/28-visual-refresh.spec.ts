import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { catalogFilters, closeCatalogFilters } from './helpers/catalog';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('refresh');
const IP_RANGE = '198.18.28';
const CARD = 'rgb(248, 247, 244)';
const ACCENT = 'rgb(236, 132, 71)';
const FOREGROUND = 'rgb(36, 34, 31)';

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

const style = (locator: Locator, property: string) =>
  locator.evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('visual refresh', () => {
  test.use({ locale: 'en-US' });

  test('controls are 4px, cards 6px, sheets 8px on top, and cards have no shadow', async ({
    page,
  }, testInfo) => {
    await signUp(page);

    await page.goto('/today');
    const create = page.getByRole('link', { name: 'Create your first workout' });
    await expect(create).toBeVisible();
    expect(await style(create, 'border-radius')).toBe('4px');
    expect(await style(page.getByRole('banner').getByRole('status'), 'border-radius')).toBe('4px');
    const todayCard = page.getByRole('region', { name: 'No workouts yet' });
    expect(await style(todayCard, 'box-shadow')).toBe('none');

    await page.goto('/library/exercises');
    expect(
      await style(page.getByRole('searchbox', { name: 'Search exercises' }), 'border-radius'),
    ).toBe('4px');
    const chip = (await catalogFilters(page))
      .getByRole('group', { name: 'Muscles' })
      .getByRole('button')
      .first();
    expect(await style(chip, 'border-radius')).toBe('4px');
    await closeCatalogFilters(page);
    const section = page.getByRole('region', { name: 'Exercises' }).getByRole('list').first();
    await expect(section).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      expect(await style(section, 'border-radius')).toBe('6px');
    } else {
      const card = section.getByRole('link').first();
      expect(await style(card, 'border-radius')).toBe('6px');
      expect(await style(card, 'box-shadow')).not.toContain('rgba(36, 34, 31, 0.12)');
    }
    expect(await style(section, 'box-shadow')).toBe('none');

    await page.goto('/profile');
    const row = page.getByRole('link', { name: /Gym equipment/ });
    expect(await style(row, 'box-shadow')).toBe('none');

    if (testInfo.project.name === 'mobile') {
      await page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('button', { name: 'Start workout' })
        .click();
    } else {
      await page.getByRole('complementary').getByRole('button', { name: 'Start workout' }).click();
    }
    const sheet = page.getByRole('dialog', { name: 'Choose workout' });
    await expect(sheet).toBeVisible();
    // On desktop the same sheet slides in from the side, square against the window edge.
    const top = testInfo.project.name === 'mobile' ? '8px' : '0px';
    expect(await style(sheet, 'border-top-left-radius')).toBe(top);
    expect(await style(sheet, 'border-top-right-radius')).toBe(top);
  });

  test('mobile: the Play diamond starts a workout and the active section is the accent', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'bottom bar');
    await signUp(page);
    await page.goto('/library/exercises');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const play = nav.getByRole('button', { name: 'Start workout' });
    const box = await play.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await style(play, 'rotate')).toBe('45deg');
    expect(await style(nav.getByRole('link', { name: 'Library' }), 'color')).toBe(ACCENT);
    await expect(nav.getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await play.tap();
    await expect(page.getByRole('dialog', { name: 'Choose workout' })).toBeVisible();
  });

  test('desktop: the active sidebar row is a card with a diamond marker', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'sidebar');
    await signUp(page);
    await page.goto('/library/exercises');

    const sidebar = page.getByRole('complementary');
    const active = sidebar.getByRole('link', { name: 'Library' });
    await expect(active).toHaveAttribute('aria-current', 'page');
    expect(await style(active, 'background-color')).toBe(CARD);
    await expect(active.locator('[data-variant]')).toHaveCount(1);
    await expect(
      sidebar.getByRole('link', { name: 'Calendar' }).locator('[data-variant]'),
    ).toHaveCount(0);
  });

  test('buttons press in 120ms, the sheet slides in 240ms, and reduced motion turns it off', async ({
    page,
  }, testInfo) => {
    await signUp(page);
    await page.goto('/today');
    const create = page.getByRole('link', { name: 'Create your first workout' });
    expect(await style(create, 'transition-duration')).toContain('0.12s');

    const openSheet = async () => {
      const start =
        testInfo.project.name === 'mobile'
          ? page
              .getByRole('navigation', { name: 'Main navigation' })
              .getByRole('button', { name: 'Start workout' })
          : page.getByRole('complementary').getByRole('button', { name: 'Start workout' });
      await start.click();
      const sheet = page.getByRole('dialog', { name: 'Choose workout' });
      await expect(sheet).toBeVisible();
      return sheet;
    };

    const sheet = await openSheet();
    expect(await style(sheet, 'animation-duration')).toBe('0.24s');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await openSheet();
    expect(parseFloat(await style(reduced, 'animation-duration'))).toBeLessThanOrEqual(0.01);
  });

  test('keyboard focus on a muscle chip shows a dark ring', async ({ page }) => {
    await signUp(page);
    await page.goto('/library/exercises');
    const chip = (await catalogFilters(page))
      .getByRole('group', { name: 'Muscles' })
      .getByRole('button')
      .first();
    await expect(chip).toBeVisible();

    for (let presses = 0; presses < 80; presses++) {
      await page.keyboard.press('Tab');
      if (await chip.evaluate((node) => node === document.activeElement)) break;
    }
    await expect(chip).toBeFocused();
    expect(await style(chip, 'box-shadow')).toContain(FOREGROUND);
  });
});

for (const locale of ['en-US', 'uk-UA'] as const) {
  test.describe(`no horizontal scroll in ${locale}`, () => {
    test.use({ locale });

    test('public and signed-in pages fit the viewport', async ({ page }) => {
      test.slow();
      for (const route of ['/', '/login', '/signup']) {
        await page.goto(route);
        expect(await overflow(page), route).toBeLessThanOrEqual(0);
      }
      await page.goto('/signup');
      await page.locator('input[type="email"]').fill(`e2e-${PREFIX}-${randomUUID()}@example.com`);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('**/onboarding');
      expect(await overflow(page), '/onboarding').toBeLessThanOrEqual(0);
      await completeOnboardingViaApi(page);

      const response = await page.request.get('/api/v1/exercises?q=bench&limit=1');
      const [exercise] = ((await response.json()) as { items: { id: string }[] }).items;
      const routes = [
        '/today',
        '/library/exercises',
        `/library/exercises/${exercise?.id}`,
        '/library/exercises/new',
        '/profile',
        '/profile/gym',
      ];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        expect(await overflow(page), route).toBeLessThanOrEqual(0);
      }
    });
  });
}
