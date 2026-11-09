import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('onb');

let ipCounter = 0;
let testIp = '';
// Each test gets its own client IP so the 10-per-minute sign-in limit never spans tests.
test.beforeEach(async ({ context }, testInfo) => {
  ipCounter += 1;
  const octet = ((testInfo.workerIndex * 50 + ipCounter) % 250) + 1;
  testIp = `192.0.2.${octet}`;
  await context.setExtraHTTPHeaders({ 'x-forwarded-for': testIp });
});

test.afterAll(async () => {
  await deleteE2eUsers(PREFIX, '192.0.2');
});

const newEmail = () => `e2e-${PREFIX}-${randomUUID()}@example.com`;

async function signUp(page: Page, email = newEmail()) {
  await page.goto('/signup');
  await page.getByLabel(/Email/).fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/onboarding');
  return email;
}

async function logIn(page: Page, email: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('onboarding and profile in English', () => {
  test.use({ locale: 'en-US' });

  test('a new user completes onboarding and edits the profile', async ({ page }) => {
    await signUp(page);

    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByLabel('Name').fill('John Smith');
    await page.getByRole('radio', { name: 'Owl' }).check({ force: true });
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'A bit about you' })).toBeVisible();
    await page.getByText('Male', { exact: true }).click();
    await page.getByLabel('DD').fill('15');
    await page.getByLabel('MM').fill('05');
    await page.getByLabel('YYYY').fill('1990');

    await page.reload();
    await expect(page.getByText('Step 2 of 3')).toBeVisible();
    await expect(page.getByLabel('YYYY')).toHaveValue('1990');
    await expect(page.getByRole('radio', { name: 'Male', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Height and weight' })).toBeVisible();
    await page.getByLabel('Height').fill('180');
    await page.getByLabel('Weight').fill('79,8');
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL('**/today');

    const profile = await (await page.request.get('/api/v1/me/profile')).json();
    expect(profile).toMatchObject({
      displayName: 'John Smith',
      avatarEmoji: 'owl',
      sex: 'male',
      birthDate: '1990-05-15',
      heightCm: 180,
      latestWeightKg: 79.8,
      unitSystem: 'metric',
    });

    await page.goto('/onboarding');
    await page.waitForURL('**/today');

    await page.getByRole('link', { name: 'Profile' }).click();
    await page.waitForURL('**/profile');
    await expect(page.getByText('John Smith')).toBeVisible();
    await expect(page.getByText('180 cm')).toBeVisible();
    await expect(page.getByText('79.8 kg')).toBeVisible();

    await page.getByRole('button', { name: 'Edit profile' }).click();
    const sheet = page.getByRole('dialog', { name: 'Edit profile' });
    await sheet.getByLabel('Name').fill('Jane Doe');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await expect(page.getByText('Jane Doe')).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('users without onboarding are sent to it; others are sent away from it', async ({
    page,
    browser,
  }) => {
    const email = await signUp(page);

    for (const route of ['/today', '/profile']) {
      await page.goto(route);
      await page.waitForURL('**/onboarding');
    }

    const fresh = await browser.newPage({
      locale: 'en-US',
      extraHTTPHeaders: { 'x-forwarded-for': testIp },
    });
    await fresh.goto('/login?next=%2Fprofile');
    await logIn(fresh, email);
    await fresh.waitForURL('**/onboarding');
    await fresh.close();

    await completeOnboardingViaApi(page);
    await page.goto('/onboarding');
    await page.waitForURL('**/today');
  });

  test('without a session, onboarding and profile ask to log in', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  });

  test('log out from the onboarding header clears the draft', async ({ page }) => {
    const email = await signUp(page);
    await page.getByLabel('Name').fill('John');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/login');
    await logIn(page, email);
    await page.waitForURL('**/onboarding');
    await expect(page.getByText('Step 1 of 3')).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('');
  });

  test('offline blocks Finish but not the first steps', async ({ page, context }) => {
    await signUp(page);
    await context.setOffline(true);

    await page.getByLabel('Name').fill('John');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Female', { exact: true }).click();
    await page.getByLabel('DD').fill('01');
    await page.getByLabel('MM').fill('01');
    await page.getByLabel('YYYY').fill('1995');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText("You're offline. Connect to the internet to save.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Finish' })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
  });

  test('the /today placeholder links to the profile and has no log out', async ({ page }) => {
    await signUp(page);
    await completeOnboardingViaApi(page);
    await page.goto('/today');

    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
  });
});

async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        'main button, main input, main a, main label:has(input[type="radio"])',
      ),
    ]
      .filter((element) => {
        if (element.matches('input[type="radio"]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.outerHTML.slice(0, 80)),
  );
}

// Each swatch's selection ring reaches 4px outside it, so neighbours need at least 8px between them.
async function overlappingSwatches(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const group = [...document.querySelectorAll('fieldset')].find((fieldset) =>
      fieldset.querySelector('input[name$="avatar-color"]'),
    );
    const boxes = [...(group?.querySelectorAll('label') ?? [])].map((label) =>
      label.getBoundingClientRect(),
    );
    const clashes: string[] = [];
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b, j) => {
        const gapX = Math.max(a.left, b.left) - Math.min(a.right, b.right);
        const gapY = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
        if (gapX < 8 && gapY < 8) clashes.push(`${i}-${i + j + 1}`);
      }),
    );
    return clashes;
  });
}

for (const [locale, copy] of [
  ['en-US', { step1: 'What should we call you?', profile: 'Profile' }],
  ['uk-UA', { step1: 'Як до тебе звертатися?', profile: 'Профіль' }],
] as const) {
  test.describe(`layout in ${locale}`, () => {
    test.use({ locale });

    test('onboarding and profile fit the viewport', async ({ page }, testInfo) => {
      await signUp(page);
      await expect(page.getByRole('heading', { level: 1, name: copy.step1 })).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect(await smallTargets(page)).toEqual([]);
      expect(await overlappingSwatches(page)).toEqual([]);

      const submit = page.locator('button[type="submit"]');
      const box = await submit.boundingBox();
      const viewport = page.viewportSize();
      if (testInfo.project.name === 'mobile') {
        expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeGreaterThan(
          (viewport?.height ?? 0) - 120,
        );
      } else {
        const card = await page.locator('main > div').boundingBox();
        expect(card?.width).toBeLessThanOrEqual(480);
      }

      await completeOnboardingViaApi(page);
      await page.goto('/profile');
      await expect(page.getByRole('heading', { level: 1, name: copy.profile })).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      expect(await smallTargets(page)).toEqual([]);
    });
  });
}
