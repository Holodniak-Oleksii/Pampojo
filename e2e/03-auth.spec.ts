import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers } from './helpers/db';

const PASSWORD = 'Password123!';

let ipCounter = 0;
// Each test gets its own client IP so the 10-per-minute sign-in limit never spans tests.
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${octet}` });
});

test.afterAll(async () => {
  await deleteE2eUsers();
});

const newEmail = () => `e2e-${randomUUID()}@example.com`;

async function signUp(page: Page, email = newEmail()) {
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/today');
  return email;
}

async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const path = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};

test.describe('auth in English', () => {
  test.use({ locale: 'en-US' });

  test('sign up lands on /today and / redirects there', async ({ page }) => {
    const email = await signUp(page);

    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/today$/);
  });

  test('signed-in users are sent from /login and /signup to /today', async ({ page }) => {
    await signUp(page);

    for (const route of ['/login', '/signup']) {
      await page.goto(route);
      await page.waitForURL('**/today');
    }
  });

  test('log out ends the session', async ({ page, context }) => {
    await signUp(page);
    const cookies = await context.cookies();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Your workouts. Even offline.' }),
    ).toBeVisible();

    await context.addCookies(cookies);
    await page.goto('/today');
    await expect(page).toHaveURL(/\/login\?next=%2Ftoday$/);
  });

  test('protected routes redirect to login and come back', async ({ page, browser }) => {
    const email = await signUp(page);
    const fresh = await browser.newPage({ locale: 'en-US' });

    await fresh.goto('/today');
    expect(path(fresh)).toBe('/login?next=%2Ftoday');
    await logIn(fresh, email);
    await fresh.waitForURL('**/today');
    await fresh.close();
  });

  test('ignores an unsafe next', async ({ page, browser }) => {
    const email = await signUp(page);
    const fresh = await browser.newPage({ locale: 'en-US' });

    await fresh.goto('/login?next=https%3A%2F%2Fevil.example');
    await logIn(fresh, email);
    await fresh.waitForURL('**/today');
    expect(new URL(fresh.url()).origin).toBe(new URL(page.url()).origin);
    await fresh.close();
  });

  test('wrong credentials show one generic error', async ({ page, browser }) => {
    const email = await signUp(page);
    const fresh = await browser.newPage({ locale: 'en-US' });

    await fresh.goto('/login');
    await logIn(fresh, email, 'not-the-password');
    await expect(fresh.getByText('Wrong email or password')).toBeVisible();
    await logIn(fresh, newEmail(), 'not-the-password');
    await expect(fresh.getByText('Wrong email or password')).toBeVisible();
    await fresh.close();
  });

  test('an existing email cannot sign up again', async ({ page, browser }) => {
    const email = await signUp(page);
    const fresh = await browser.newPage({ locale: 'en-US' });

    await fresh.goto('/signup');
    await fresh.getByLabel('Email').fill(email);
    await fresh.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await fresh.getByRole('button', { name: 'Create account' }).click();
    await expect(
      fresh.getByText('An account with this email already exists. Log in instead.'),
    ).toBeVisible();
    await fresh.close();
  });

  test('shows the Google conflict error from the callback', async ({ page }) => {
    await page.goto('/login?error=account_not_linked');

    await expect(
      page.getByText('This email is registered with a password. Log in with your password.'),
    ).toBeVisible();
  });

  test('offline shows a notice and disables submit', async ({ page, context }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled();

    await context.setOffline(true);
    await expect(
      page.getByText("You're offline. Connect to the internet to log in."),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByText("You're offline. Connect to the internet to log in.")).toBeHidden();
  });
});

for (const [locale, copy] of [
  [
    'en-US',
    {
      login: 'Welcome back',
      signup: 'Create your account',
      tab: 'Sign up',
      today: "You're signed in",
    },
  ],
  [
    'uk-UA',
    { login: 'З поверненням', signup: 'Створи акаунт', tab: 'Реєстрація', today: 'Ти в акаунті' },
  ],
] as const) {
  test.describe(`auth pages in ${locale}`, () => {
    test.use({ locale });

    test('render their copy without horizontal scroll', async ({ page }) => {
      for (const [route, title] of [
        ['/login', copy.login],
        ['/signup', copy.signup],
      ] as const) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        await expect(page.getByRole('link', { name: copy.tab })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      }

      await page.goto('/signup');
      await page.getByLabel(/Email/).fill(newEmail());
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('**/today');
      await expect(page.getByRole('heading', { level: 1, name: copy.today })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
