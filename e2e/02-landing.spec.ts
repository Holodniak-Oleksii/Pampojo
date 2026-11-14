import { expect, test, type Page } from '@playwright/test';

const SECTION_ORDER = [
  'header',
  'hero',
  'features',
  'how-it-works',
  'showcase',
  'offline',
  'faq',
  'cta',
  'footer',
];

const COPY = {
  en: {
    h1: 'Your workouts. Even offline.',
    features: [
      'Build your own workouts',
      'Plan with a calendar',
      'Works offline in the gym',
      'Share workouts with friends',
    ],
    steps: ['Create a workout', 'Schedule it', 'Train and track'],
    offline: "Train in the basement. Sync when you're back online.",
    faq: [
      'Is Pampojo free?',
      'Does it work without internet?',
      'Can I use it on iPhone?',
      'How do I share a workout?',
    ],
    cta: 'Log your next workout here',
    tagline: 'A workout log that works without a signal',
    title: 'Pampojo — workout tracker that works offline',
    description:
      'Build workouts, plan them in a calendar and log every set in the gym, even without a signal.',
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    soon: 'Coming soon.',
    back: 'Back to home',
  },
  uk: {
    h1: 'Твої тренування. Навіть офлайн.',
    features: [
      'Створюй свої тренування',
      'Плануй у календарі',
      'Працює офлайн у залі',
      'Ділись тренуваннями з друзями',
    ],
    steps: ['Створи тренування', 'Заплануй', 'Тренуйся й відстежуй'],
    offline: 'Тренуйся в підвалі. Синхронізуй, коли повернешся онлайн.',
    faq: [
      'Pampojo безкоштовний?',
      'Чи працює без інтернету?',
      'Чи можна на iPhone?',
      'Як поділитися тренуванням?',
    ],
    cta: 'Записуй наступне тренування тут',
    tagline: 'Журнал тренувань, який працює без мережі',
    title: 'Pampojo — трекер тренувань, що працює офлайн',
    description:
      "Створюй тренування, плануй їх у календарі й записуй кожен підхід у залі, навіть без зв'язку.",
    privacy: 'Політика конфіденційності',
    terms: 'Умови використання',
    soon: 'Скоро буде.',
    back: 'На головну',
  },
} as const;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const [locale, acceptLanguage] of [
  ['en', 'en-US'],
  ['uk', 'uk-UA'],
] as const) {
  const copy = COPY[locale];

  test.describe(`landing in ${locale}`, () => {
    test.use({ locale: acceptLanguage });

    test('shows every section in order with its copy', async ({ page }) => {
      await page.goto('/');

      const order = await page
        .locator('[data-section]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-section')));
      expect(order).toEqual(SECTION_ORDER);
      for (const name of SECTION_ORDER) {
        const section = page.locator(`[data-section="${name}"]`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeVisible();
      }

      await expect(page.getByRole('heading', { level: 1, name: copy.h1 })).toBeVisible();
      for (const text of [...copy.features, ...copy.steps]) {
        await expect(page.getByRole('heading', { level: 3, name: text })).toBeVisible();
      }
      await expect(page.getByRole('heading', { level: 2, name: copy.offline })).toBeVisible();
      for (const question of copy.faq) {
        await expect(page.getByRole('button', { name: question })).toBeVisible();
      }
      await expect(page.getByRole('heading', { level: 2, name: copy.cta })).toBeVisible();
      await expect(page.getByText(copy.tagline)).toBeVisible();
      // 9 of 11 workouts done: the plan card must read 82%, not a fraction of a percent.
      await expect(page.locator('[data-section="showcase"]')).toContainText(/82\s?%/);
    });

    test('has localized metadata and an OG image', async ({ page, request }) => {
      await page.goto('/');

      await expect(page).toHaveTitle(copy.title);
      const meta = (selector: string) => page.locator(selector).getAttribute('content');
      expect(await meta('meta[name="description"]')).toBe(copy.description);
      expect(await meta('meta[property="og:title"]')).toBe(copy.title);
      expect(await meta('meta[property="og:description"]')).toBe(copy.description);
      expect(await meta('meta[property="og:type"]')).toBe('website');
      expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');

      const imageUrl = await meta('meta[property="og:image"]');
      expect(imageUrl).toBeTruthy();
      const response = await request.get(
        new URL(imageUrl ?? '').pathname + new URL(imageUrl ?? '').search,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toBe('image/png');
      const png = await response.body();
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
    });

    test('renders the legal placeholders', async ({ page }) => {
      for (const [path, title] of [
        ['/privacy', copy.privacy],
        ['/terms', copy.terms],
      ] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        await expect(page.getByText(copy.soon)).toBeVisible();
        await expect(page.locator('[data-section="header"]')).toBeVisible();
        await expect(page.locator('[data-section="footer"]')).toBeVisible();
        await page.getByRole('link', { name: copy.back }).click();
        await expect(page).toHaveURL(/\/$/);
      }
    });
  });
}

test.describe('landing links and layout', () => {
  test.use({ locale: 'en-US' });

  test('links to sign up and log in', async ({ page }) => {
    await page.goto('/');

    for (const link of await page.getByRole('link', { name: 'Get started' }).all()) {
      await expect(link).toHaveAttribute('href', '/signup');
    }
    for (const link of await page.getByRole('link', { name: 'Log in' }).all()) {
      await expect(link).toHaveAttribute('href', '/login');
    }
    await expect(page.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  test('footer anchors scroll to their sections', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('[data-section="footer"]');

    for (const [name, hash] of [
      ['Features', 'features'],
      ['How it works', 'how-it-works'],
      ['FAQ', 'faq'],
    ] as const) {
      await footer.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      await expect(page.locator(`#${hash}`)).toBeInViewport();
    }
  });

  test('header anchors scroll to their sections on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The header nav is desktop only');
    await page.goto('/');
    const header = page.locator('[data-section="header"]');

    for (const [name, hash] of [
      ['Features', 'features'],
      ['How it works', 'how-it-works'],
      ['FAQ', 'faq'],
    ] as const) {
      await header.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${hash}$`));
      await expect(page.locator(`#${hash}`)).toBeInViewport();
    }
  });

  test('mobile menu opens and closes by touch and keyboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'The menu is mobile only');
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Open menu' });
    const menu = page.getByRole('dialog', { name: 'Menu' });

    await trigger.tap();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Close' }).tap();
    await expect(menu).toBeHidden();

    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'FAQ', exact: true }).tap();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#faq$/);
  });

  test('FAQ toggles on the page', async ({ page }) => {
    await page.goto('/');
    const first = page.getByRole('button', { name: 'Is Pampojo free?' });
    const second = page.getByRole('button', { name: 'Does it work without internet?' });

    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await second.focus();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  test('has no horizontal scroll at 360, 390 and 1440', async ({ page }) => {
    for (const width of [360, 390, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await noHorizontalScroll(page);
    }
  });

  test('uses only SVG images', async ({ page }) => {
    await page.goto('/');

    const sources = await page
      .locator('img')
      .evaluateAll((images) =>
        images.map((image) =>
          decodeURIComponent(
            (image as HTMLImageElement).currentSrc || image.getAttribute('src') || '',
          ),
        ),
      );
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source.split('?')[0]).toMatch(/\.svg$/);
    }
    await expect(page.locator('picture')).toHaveCount(0);
  });
});
