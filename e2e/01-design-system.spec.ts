import { expect, test } from '@playwright/test';

const SECTIONS = [
  'Colors',
  'Type',
  'Buttons',
  'Inputs',
  'Cards',
  'Gauge',
  'Avatars',
  'Status',
  'Overlays',
];
const VARIANTS = ['primary', 'accent', 'secondary', 'ghost'];
const SIZES = ['sm', 'md', 'lg', 'xl'];

test.describe('/dev/ui in English', () => {
  test.use({ locale: 'en-US' });

  test('shows every section and component state', async ({ page }) => {
    const response = await page.goto('/dev/ui');
    expect(response?.status()).toBe(200);

    for (const name of SECTIONS) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        await expect(
          page.getByRole('button', { name: `${variant} ${size}`, exact: true }),
        ).toBeVisible();
      }
      await expect(page.getByRole('button', { name: `Add (${variant})` })).toBeVisible();
      await expect(page.getByRole('button', { name: `${variant} disabled` })).toBeDisabled();
    }

    await expect(page.getByRole('meter', { name: 'Plan adherence' })).toHaveCount(4);
    const avatars = page.getByRole('region', { name: 'Avatars' }).getByRole('img');
    await expect(avatars).toHaveCount(24 + 3);
    await expect(page.getByRole('region', { name: 'Status' }).getByRole('status')).toHaveCount(3);
    await expect(page.getByTestId('pending-badge')).toHaveText('3');
  });

  test('opens every overlay', async ({ page }) => {
    await page.goto('/dev/ui');

    await page.getByRole('button', { name: 'Open dialog' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Open sheet' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Show toast' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  });

  test('renders Ukrainian glyphs with Manrope', async ({ page }) => {
    await page.goto('/dev/ui');
    const result = await page.evaluate(async () => {
      await document.fonts.ready;
      const family = getComputedStyle(document.body).fontFamily.split(',')[0]?.trim() ?? '';
      // ґ (U+0491) is also listed in the cyrillic-ext range, which never loads for Ukrainian text,
      // so check() on it reports false; assert the basic Cyrillic face that covers it is loaded.
      const basicCyrillicLoaded = [...document.fonts].some(
        (face) =>
          face.family === family &&
          face.status === 'loaded' &&
          face.unicodeRange.includes('U+490-491'),
      );
      return {
        family,
        letters: document.fonts.check(`16px ${family}`, 'їєі'),
        basicCyrillicLoaded,
      };
    });

    expect(result.family).toContain('Manrope');
    expect(result.letters).toBe(true);
    expect(result.basicCyrillicLoaded).toBe(true);
  });

  test('has no horizontal scroll', async ({ page }) => {
    await page.goto('/dev/ui');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('switches to Ukrainian and remembers the choice', async ({ page, context }) => {
    await page.goto('/dev/ui');
    await page.getByRole('button', { name: 'Language' }).click();
    await page.getByRole('menuitemradio', { name: 'Українська' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Дизайн-система' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    expect(new URL(page.url()).pathname).toBe('/dev/ui');
    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === 'lang')?.value).toBe('uk');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Дизайн-система' })).toBeVisible();
  });
});

test.describe('/dev/ui in Ukrainian', () => {
  test.use({ locale: 'uk-UA' });

  test('follows Accept-Language on the first visit', async ({ page }) => {
    await page.goto('/dev/ui');

    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.getByRole('heading', { level: 1, name: 'Дизайн-система' })).toBeVisible();
  });
});

test.describe('language cookie', () => {
  test.use({ locale: 'en-US' });

  test('wins over Accept-Language', async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: 'lang', value: 'uk', url: baseURL ?? 'http://localhost:3000' },
    ]);
    await page.goto('/dev/ui');

    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });
});

test('home page links the favicon and apple-touch icon', async ({ page, request }) => {
  await page.goto('/');

  for (const rel of ['icon', 'apple-touch-icon']) {
    const href = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
    expect(href).toBeTruthy();
    const response = await request.get(href ?? '');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\//);
  }
});
