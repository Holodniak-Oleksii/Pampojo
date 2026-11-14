import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('shell');
const SHELL_ROUTES = [
  '/today',
  '/calendar',
  '/library/workouts',
  '/library/exercises',
  '/progress',
  '/profile',
];

let ipCounter = 0;
let testIp = '';
// Each test gets its own client IP so the 10-per-minute sign-in limit never spans tests.
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  testIp = `198.18.0.${octet}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, '198.18.0');
});

const newEmail = () => `e2e-${PREFIX}-${randomUUID()}@example.com`;

async function signUp(page: Page, { onboard = true } = {}) {
  const email = newEmail();
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  if (onboard) await completeOnboardingViaApi(page);
  return email;
}

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('app shell in English', () => {
  test.use({ locale: 'en-US' });

  test('mobile shows the bottom bar on every shell route', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone layout');
    await signUp(page);

    for (const route of SHELL_ROUTES) {
      await page.goto(route);
      await expect(mainNav(page)).toBeVisible();
      await expect(mainNav(page).getByRole('link')).toHaveCount(4);
      await expect(mainNav(page).getByRole('button', { name: 'Start workout' })).toBeVisible();
      for (const link of await mainNav(page).getByRole('link').all()) {
        expect(await link.innerText()).toBe('');
      }
      await expect(page.getByRole('complementary')).toBeHidden();
      await expect(page.getByRole('banner').getByRole('status')).toBeVisible();
    }
  });

  test('desktop shows the sidebar on every shell route', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop layout');
    await signUp(page);

    for (const route of SHELL_ROUTES) {
      await page.goto(route);
      const sidebar = page.getByRole('complementary');
      await expect(sidebar).toBeVisible();
      await expect(sidebar.getByRole('button', { name: 'Start workout' })).toBeVisible();
      await expect(sidebar.getByRole('navigation').getByRole('link')).toHaveText([
        'Today',
        'Calendar',
        'Library',
        'Progress',
        'Profile',
      ]);
      await expect(mainNav(page)).toHaveCount(1);
      await expect(page.getByRole('banner').getByRole('status')).toBeVisible();
    }
  });

  test('the breakpoint switches the navigation and which title is shown', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'resizes a desktop window');
    await signUp(page);
    await page.goto('/calendar');

    const measure = async () => (await page.getByRole('banner').boundingBox())?.height;
    // One visible title per screen: the top bar label on phones, the page heading on desktop.
    const topBarLabel = page.getByRole('banner').getByText('Calendar', { exact: true });
    const heading = page.getByRole('heading', { level: 1, name: 'Calendar' });
    const headingHeight = async () => (await heading.boundingBox())?.height ?? 0;

    await page.setViewportSize({ width: 1023, height: 900 });
    await expect(page.getByRole('complementary')).toBeHidden();
    await expect(mainNav(page).getByRole('button', { name: 'Start workout' })).toBeVisible();
    const narrow = await measure();
    await expect(topBarLabel).toBeVisible();
    expect(await headingHeight()).toBeLessThanOrEqual(1);
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('complementary')).toBeVisible();
    await expect(mainNav(page)).toHaveCount(1);
    await expect(page.getByRole('complementary').getByRole('navigation')).toBeVisible();
    expect(await measure()).toEqual(narrow);
    await expect(topBarLabel).toBeHidden();
    expect(await headingHeight()).toBeGreaterThan(20);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('keyboard reaches the sidebar in visual order with a focus ring', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'sidebar');
    await signUp(page);
    await page.goto('/library/exercises');

    const sidebar = page.getByRole('complementary');
    // Start from the wordmark: in dev the Next.js indicator takes the first Tab stop.
    await sidebar.getByRole('link', { name: 'Pampojo, Today' }).focus();
    const order = [
      sidebar.getByRole('button', { name: 'Start workout' }),
      ...['Today', 'Calendar', 'Library', 'Progress', 'Profile'].map((name) =>
        sidebar.getByRole('link', { name, exact: true }),
      ),
    ];
    for (const target of order) {
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
      const ring = await target.evaluate((element) => getComputedStyle(element).boxShadow);
      expect(ring).not.toBe('none');
    }
    await expect(sidebar.getByRole('link', { name: 'Library' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the app icon or wordmark leads to Today', async ({ page }) => {
    await signUp(page);
    await page.goto('/calendar');

    await page.getByRole('link', { name: 'Pampojo, Today' }).locator('visible=true').click();
    await page.waitForURL('**/today');
  });

  test('the status pill follows the connection', async ({ page, context }) => {
    await signUp(page);
    await page.goto('/today');
    const pill = page.getByRole('banner').getByRole('status');

    await expect(pill).toHaveText('Online');
    await context.setOffline(true);
    await expect(pill).toHaveText('Offline');
    await context.setOffline(false);
    await expect(pill).toHaveText('Online');
  });

  test('Start opens the Choose workout sheet', async ({ page }, testInfo) => {
    await signUp(page);
    await page.goto('/progress');

    const start = page.getByRole('button', { name: 'Start workout' }).locator('visible=true');
    await start.click();
    const dialog = page.getByRole('dialog', { name: 'Choose workout' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('No workouts yet')).toBeVisible();
    await expect(dialog.getByText('Create a workout to start a session.')).toBeVisible();

    // Poll until the slide-in animation has settled.
    const edge = async () => {
      const box = await dialog.boundingBox();
      return testInfo.project.name === 'mobile'
        ? Math.round((box?.y ?? 0) + (box?.height ?? 0))
        : Math.round((box?.x ?? 0) + (box?.width ?? 0));
    };
    const viewport = page.viewportSize();
    await expect
      .poll(edge)
      .toBe(testInfo.project.name === 'mobile' ? viewport?.height : viewport?.width);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(start).toBeFocused();

    await start.click();
    await dialog.getByRole('link', { name: 'Create workout' }).click();
    await page.waitForURL('**/library/workouts');
    await expect(dialog).toBeHidden();
  });

  test('Today greets the user and offers to create a workout', async ({ page }) => {
    await signUp(page);
    await page.goto('/today');

    await expect(page.getByText(/^Good (morning|afternoon|evening), John Smith\. /)).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'No workouts yet' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('img', { name: 'Fox' })).toHaveCount(0);
    await expect(page.getByText(/Signed in as/)).toHaveCount(0);
    await page.getByRole('link', { name: 'Create your first workout' }).click();
    await page.waitForURL('**/library/workouts');
  });

  test('placeholder sections show their empty states', async ({ page }) => {
    await signUp(page);

    const sections = [
      ['/calendar', 'Calendar', 'Nothing scheduled yet'],
      ['/progress', 'Progress', 'No progress yet'],
      ['/library/workouts', 'Library', 'No workouts yet'],
    ] as const;
    for (const [route, title, empty] of sections) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: empty })).toBeVisible();
    }
    await page.goto('/calendar');
    await expect(page.getByText('Your planned and past workouts will show up here.')).toBeVisible();
    await page.goto('/progress');
    await expect(page.getByText('Finish a workout to see your strength charts.')).toBeVisible();

    await page.goto('/library');
    await page.waitForURL('**/library/workouts');
    await expect(page.getByText('Workout builder is coming soon.')).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Library' });
    await expect(tabs.getByRole('link', { name: 'Workouts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await tabs.getByRole('link', { name: 'Exercises' }).click();
    await page.waitForURL('**/library/exercises');
    await expect(tabs.getByRole('link', { name: 'Exercises' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('new routes are protected', async ({ page, browser }) => {
    const anonymous = await browser.newPage({ extraHTTPHeaders: { 'x-forwarded-for': testIp } });
    for (const route of [
      '/calendar',
      '/library',
      '/library/workouts',
      '/library/exercises',
      '/progress',
    ]) {
      await anonymous.goto(route);
      await anonymous.waitForURL('**/login**');
      expect(new URL(anonymous.url()).searchParams.get('next')).toBe(route);
    }
    await anonymous.close();

    await signUp(page, { onboard: false });
    for (const route of ['/calendar', '/library', '/library/exercises', '/progress']) {
      await page.goto(route);
      await page.waitForURL('**/onboarding');
    }
  });

  test('the language switch on /profile persists after a new sign-in', async ({ page }) => {
    const email = await signUp(page);
    await page.goto('/profile');

    await page.getByRole('button', { name: 'Language: English' }).click();
    await page.getByRole('menuitemradio', { name: 'Українська' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Профіль' })).toBeVisible();

    await page.getByRole('button', { name: 'Вийти' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/today');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Профіль' })).toBeVisible();
  });

  test('content clears the bottom bar and its Play diamond, and the viewport allows safe areas', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'bottom bar');
    await signUp(page);
    await page.goto('/profile');
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      const last = document.querySelector('main')?.lastElementChild;
      const bar = [...document.querySelectorAll('nav')].find(
        (nav) => getComputedStyle(nav).position === 'fixed',
      );
      const play = bar?.querySelector('button');
      const top = Math.min(
        bar?.getBoundingClientRect().top ?? 0,
        play?.getBoundingClientRect().top ?? Infinity,
      );
      return top - (last?.getBoundingClientRect().bottom ?? 0);
    });
    expect(gap).toBeGreaterThanOrEqual(0);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      'content',
      /viewport-fit=cover/,
    );
  });
});

for (const [locale, title] of [
  ['en-US', 'Calendar'],
  ['uk-UA', 'Календар'],
] as const) {
  test.describe(`shell layout in ${locale}`, () => {
    test.use({ locale });

    test('no horizontal scroll on shell routes', async ({ page }) => {
      await signUp(page);
      for (const route of SHELL_ROUTES) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(0);
      }
      await page.goto('/calendar');
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  });
}
