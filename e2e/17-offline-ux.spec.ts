import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('offux');
const IP_RANGE = '198.18.17';
// On CI each API call takes 1-5 s, and a sync waits for several of them in a row.
const NETWORK_TIMEOUT = 30_000;

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

async function createWorkout(page: Page, name: string) {
  const search = await page.request.get('/api/v1/exercises?q=barbell%20bench%20press&limit=1');
  const [bench] = ((await search.json()) as { items: { id: string }[] }).items;
  const id = randomUUID();
  const response = await page.request.put(`/api/v1/workouts/${id}`, {
    data: {
      name,
      exercises: [
        {
          id: randomUUID(),
          exerciseId: bench!.id,
          targetSets: 1,
          targetRepsMin: 8,
          targetRepsMax: 8,
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  return { id, exerciseId: bench!.id };
}

async function openReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Preparing your data for the gym' })).toBeHidden({
    timeout: NETWORK_TIMEOUT,
  });
}

/**
 * Opens `path` once the waiting service worker with `version` is active. It activates only when no
 * page of the app is open, so each try closes the page and waits on a blank one.
 */
async function relaunchOn(context: BrowserContext, path: string, version: string): Promise<Page> {
  let page: Page | undefined;
  await expect(async () => {
    await page?.close();
    const idle = await context.newPage();
    await idle.waitForTimeout(500);
    page = await context.newPage();
    await idle.close();
    await page.goto(path);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
      ),
    ).toContain(`version=${version}`);
  }).toPass({ timeout: NETWORK_TIMEOUT });
  return page!;
}

test.describe('offline UX', () => {
  test.use({ locale: 'en-US' });
  test.slow();

  test('the pill shows offline, the count, and blocked controls answer with a toast (AC1, AC4)', async ({
    page,
    context,
  }, testInfo) => {
    await signUp(page);
    await openReady(page, '/library/workouts');
    const pill = page.getByRole('banner').getByRole('status');
    await expect(pill).toHaveText('Online');

    await context.setOffline(true);
    await expect(pill).toContainText('Offline', { timeout: 2000 });
    const create =
      testInfo.project.name === 'mobile'
        ? page.getByRole('link', { name: 'Create workout. Needs internet' }).first()
        : page.getByRole('link', { name: 'Create workout. Needs internet' }).last();
    await expect(create).toBeDisabled();
    await create.click({ force: true });
    await expect(page.locator('[data-sonner-toast]')).toHaveText('Needs internet');
    await expect(page).toHaveURL(/\/library\/workouts$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page
      .getByRole('banner')
      .getByRole('button', { name: /Open sync/ })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Sync' });
    await expect(sheet.getByRole('button', { name: 'Sync now. Needs internet' })).toBeDisabled();
    await context.setOffline(false);
  });

  test('a measurement added offline shows in the pill count (AC1, AC5)', async ({
    page,
    context,
  }) => {
    await signUp(page);
    await openReady(page, '/profile');
    await expect(page.getByRole('heading', { name: 'No measurements yet' })).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Add measurement' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Add measurement' });
    await sheet.getByLabel('Weight').fill('80');
    await sheet.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('banner').getByTestId('pending-badge')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Log out. Needs internet' })).toBeDisabled();

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('banner').getByTestId('pending-badge')).toHaveCount(0, {
      timeout: NETWORK_TIMEOUT,
    });
  });
});

test.describe('offline pages on the installed app', () => {
  // The service worker exists only in production builds.
  test.skip(
    !process.env.CI,
    'needs a production build: pnpm build && CI=1 pnpm exec playwright test e2e/17-offline-ux.spec.ts',
  );
  test.use({ locale: 'en-US', serviceWorkers: 'allow' });
  test.slow();

  test('workout, exercise and measurement pages open offline with no visit (AC6, AC9)', async ({
    page,
    context,
  }) => {
    await signUp(page);
    const workout = await createWorkout(page, 'Offline Day');
    await openReady(page, '/today');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });
    const exercisePath = `/library/exercises/${workout.exerciseId}`;
    await expect
      .poll(
        () =>
          page.evaluate(async () =>
            (await (await caches.open('pampojo-pages')).keys()).map(
              (request) => new URL(request.url).pathname,
            ),
          ),
        { timeout: NETWORK_TIMEOUT },
      )
      .toEqual(
        expect.arrayContaining([
          `/library/workouts/${workout.id}`,
          exercisePath,
          '/profile/measurements/waist',
        ]),
      );
    // The images load after the pages, so wait for them before the network goes away.
    await expect
      .poll(
        () =>
          page.evaluate(async () => (await (await caches.open('pampojo-images')).keys()).length),
        { timeout: NETWORK_TIMEOUT },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto(`/library/workouts/${workout.id}`);
    await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue('Offline Day');
    await page.goto(exercisePath);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Bench Press/);
    await page.goto('/profile/measurements/waist');
    await expect(page.getByRole('heading', { name: 'No connection' })).toHaveCount(0);
    await page.goto(exercisePath);
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.images].some((image) => image.complete && image.naturalWidth > 0),
        ),
      )
      .toBe(true);
    await context.setOffline(false);
  });

  test('the first launch after an update opens the pages and a new workout offline', async ({
    page,
    context,
  }, testInfo) => {
    await signUp(page);
    const workout = await createWorkout(page, 'Update Day');
    await openReady(page, '/today');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });
    await expect
      .poll(
        () =>
          page.evaluate(async () =>
            (await (await caches.open('pampojo-pages')).keys()).map(
              (request) => new URL(request.url).pathname,
            ),
          ),
        { timeout: NETWORK_TIMEOUT },
      )
      .toEqual(
        expect.arrayContaining([
          `/library/workouts/${workout.id}`,
          '/session/00000000-0000-0000-0000-000000000000',
        ]),
      );

    // A new script URL makes the browser install a new version, as after a deploy.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/sw.js?version=next');
      await new Promise<void>((resolve) => {
        const check = () => (registration.waiting ? resolve() : setTimeout(check, 200));
        check();
      });
    });

    await context.setOffline(true);
    await page.close();
    const next = await relaunchOn(context, '/today', 'next');

    const start =
      testInfo.project.name === 'mobile'
        ? next
            .getByRole('navigation', { name: 'Main navigation' })
            .last()
            .getByRole('button', { name: 'Start workout' })
        : next.getByRole('complementary').getByRole('button', { name: 'Start workout' });
    await start.click();
    await next
      .getByRole('dialog', { name: 'Choose workout' })
      .getByRole('button', { name: /Update Day/ })
      .click();
    await next.waitForURL('**/session/*');
    await next.reload();
    await expect(next.getByRole('textbox', { name: 'Set 1, weight' })).toBeVisible();
    await next.goto(`/library/workouts/${workout.id}`);
    await expect(next.getByRole('textbox', { name: 'Name' })).toHaveValue('Update Day');
    await context.setOffline(false);
  });

  test('a logout during an update drops the pages staged before it', async ({ page, context }) => {
    await signUp(page);
    await openReady(page, '/today');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/sw.js?version=logout');
      await new Promise<void>((resolve) => {
        const check = () => (registration.waiting ? resolve() : setTimeout(check, 200));
        check();
      });
      // As logout does, then a staging request that ends after it stores one more page.
      await (
        await caches.open('pampojo-meta')
      ).put('/pampojo/pages-reset', new Response(String(Date.now())));
      await caches.delete('pampojo-pages');
      await caches.delete('pampojo-pages-next');
      await (await caches.open('pampojo-pages-next')).put('/today', new Response('late page'));
    });

    await page.close();
    const next = await relaunchOn(context, '/offline', 'logout');
    const late = await next.evaluate(async () => {
      const cached = await caches.match('/today', { cacheName: 'pampojo-pages' });
      return cached ? await cached.text() : null;
    });
    expect(late).not.toBe('late page');
  });

  test('a language switch leaves no cached page in the old language', async ({ page }) => {
    await signUp(page);
    await openReady(page, '/profile');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
        );
      }
    });
    const cachedLanguages = () =>
      page.evaluate(async () => {
        const cache = await caches.open('pampojo-pages');
        const languages = new Set<string>();
        for (const request of await cache.keys()) {
          const html = await (await cache.match(request))!.text();
          languages.add(/<html[^>]* lang="([a-z]+)"/.exec(html)?.[1] ?? '?');
        }
        return [...languages];
      });
    // A warm-up that ran during the switch is replaced by the next one.
    await expect.poll(cachedLanguages, { timeout: 2 * NETWORK_TIMEOUT }).toEqual(['en']);
    await expect
      .poll(
        () => page.evaluate(async () => (await (await caches.open('pampojo-pages')).keys()).length),
        { timeout: NETWORK_TIMEOUT },
      )
      .toBeGreaterThan(5);

    // The cached copy wins when the network is slow, so it must not keep the old language.
    await page.getByRole('button', { name: /^Language/ }).click();
    await page.getByRole('menuitemradio', { name: 'Українська' }).click();
    await expect(page.getByRole('button', { name: 'Вийти' }).first()).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    // A warm-up that ran during the switch is replaced by the next one.
    await expect.poll(cachedLanguages, { timeout: 2 * NETWORK_TIMEOUT }).toEqual(['uk']);

    await page.getByRole('button', { name: /^Мова/ }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeVisible({
      timeout: NETWORK_TIMEOUT,
    });
    // A warm-up that ran during the switch is replaced by the next one.
    await expect.poll(cachedLanguages, { timeout: 2 * NETWORK_TIMEOUT }).toEqual(['en']);
  });
});
