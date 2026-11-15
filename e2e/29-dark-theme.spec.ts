import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('theme');
const IP_RANGE = '198.18.29';
const DARK_BG = 'rgb(30, 28, 26)';
const LIGHT_BG = 'rgb(236, 233, 228)';

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

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));
const background = (page: Page) =>
  page.locator('body').evaluate((node) => getComputedStyle(node).backgroundColor);

test.describe('dark theme', () => {
  test.use({ locale: 'en-US' });

  test('follows the system theme, live, on the landing, auth and app (AC1, AC8)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const path of ['/', '/login']) {
      await page.goto(path);
      expect(await isDark(page)).toBe(true);
      expect(await background(page)).toBe(DARK_BG);
    }
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#1E1C1A');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
      'dark',
    );

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => isDark(page)).toBe(false);
    expect(await background(page)).toBe(LIGHT_BG);

    await signUp(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/today');
    expect(await background(page)).toBe(DARK_BG);
  });

  test('the Profile switch overrides the system, survives reload and log out, and shows in the footer (AC2)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await signUp(page);
    await page.goto('/profile');
    await page
      .getByRole('radiogroup', { name: 'Theme' })
      .getByRole('radio', { name: 'Dark' })
      .click();
    expect(await isDark(page)).toBe(true);
    await page.reload();
    expect(await isDark(page)).toBe(true);
    await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    expect(await isDark(page)).toBe(true);
    await expect(
      page.getByRole('contentinfo').getByRole('radio', { name: 'Dark' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  test('the landing footer switch sets the theme, and other tabs follow (AC3, AC7)', async ({
    page,
    context,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const other = await context.newPage();
    await other.emulateMedia({ colorScheme: 'dark' });
    await other.goto('/login');
    expect(await isDark(other)).toBe(true);

    await page.getByRole('contentinfo').getByRole('radio', { name: 'Light' }).click();
    expect(await isDark(page)).toBe(false);
    await expect.poll(() => isDark(other)).toBe(false);
  });

  test('sets the theme before hydration (AC4)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pampojo:theme', 'dark'));
    await page.route('**/_next/static/chunks/**', (route) => route.abort());
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    expect(await isDark(page)).toBe(true);
  });

  test('the session follows the app theme (AC5)', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await signUp(page);
    await page.evaluate(() => localStorage.setItem('pampojo:theme', 'light'));
    const response = await page.request.get('/api/v1/exercises?q=plank&limit=1');
    const exercise = ((await response.json()) as { items: { id: string }[] }).items[0]!.id;
    await page.request.put(`/api/v1/workouts/${randomUUID()}`, {
      data: { name: 'Theme Day', exercises: [{ id: randomUUID(), exerciseId: exercise }] },
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
      .getByRole('dialog')
      .getByRole('button', { name: /Theme Day/ })
      .click();
    await page.waitForURL('**/session/*');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await background(page)).toBe(LIGHT_BG);
  });
});
