import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('pwa');
const IP_RANGE = '198.18.15';

// The service worker exists only in production builds.
test.skip(
  !process.env.CI,
  'needs a production build: pnpm build && CI=1 pnpm exec playwright test e2e/15-pwa-shell.spec.ts',
);
test.use({ serviceWorkers: 'allow', locale: 'en-US' });

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

/** Waits until a service worker controls the page and its precache is ready. */
async function controlled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
    }
  });
}

test.describe('PWA shell', () => {
  test('the manifest and icons are valid and a service worker controls the page (AC1)', async ({
    page,
    request,
  }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Pampojo',
      short_name: 'Pampojo',
      start_url: '/today',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ECE9E4',
      theme_color: '#ECE9E4',
    });
    expect(manifest.icons).toHaveLength(4);
    await page.goto('/');
    for (const icon of manifest.icons as { src: string; sizes: string; purpose: string }[]) {
      const response = await request.get(icon.src);
      expect(response.headers()['content-type']).toBe('image/png');
      const width = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        return image.naturalWidth;
      }, icon.src);
      expect(`${width}x${width}`).toBe(icon.sizes);
    }
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      /manifest\.webmanifest/,
    );
    await controlled(page);
    expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  });

  test('visited pages open offline and others show the offline page (AC2)', async ({
    page,
    context,
  }) => {
    await signUp(page);
    await page.goto('/today');
    await controlled(page);
    // The first load ran before the worker took over; load once more so the page is cached.
    await page.reload();
    // Offline before the first download ends, the app shows "The first start needs internet".
    await expect(page.getByText(/^Good (morning|afternoon|evening)/)).toBeVisible();

    await context.setOffline(true);
    await page.goto('/today');
    await expect(page.getByText(/^Good (morning|afternoon|evening)/)).toBeVisible();
    // The app loads its main pages in the background, so the never-visited page is a nested one.
    await page.goto('/profile/gym');
    await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await context.setOffline(false);
  });

  test('a new version waits for the next launch without reloading (AC3)', async ({ page }) => {
    await page.goto('/');
    await controlled(page);
    await page.evaluate(() => {
      (window as unknown as { __marker: number }).__marker = 1;
    });
    const activeBefore = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).active?.scriptURL,
    );
    // A changed script URL is an update to the same registration, like a new deploy's worker.
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js?v=next', {
        scope: '/',
        type: 'module',
      });
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting?.state ?? null;
        }),
      )
      .toBe('installed');
    expect(
      await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL),
    ).toBe(activeBefore);
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
      1,
    );
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
  });

  test('logging out deletes the cached pages (AC5)', async ({ page }) => {
    await signUp(page);
    await page.goto('/today');
    await controlled(page);
    await page.reload();
    await expect.poll(() => page.evaluate(() => caches.has('pampojo-pages'))).toBe(true);

    await page.goto('/profile');
    await page.getByRole('main').getByRole('button', { name: 'Log out' }).click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Log out' });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForURL((url) => !url.pathname.startsWith('/profile'));
    expect(await page.evaluate(() => caches.has('pampojo-pages'))).toBe(false);
  });
});
