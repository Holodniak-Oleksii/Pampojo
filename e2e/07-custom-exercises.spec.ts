import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { deleteE2eUsers, e2eRunPrefix } from './helpers/db';
import { completeOnboardingViaApi } from './helpers/onboarding';

// Photo uploads need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync('.env.local'))
  process.loadEnvFile('.env.local');
const STORAGE_READY = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const STORAGE_SKIP = 'needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for photo uploads';
const PASSWORD = 'Password123!';
const PREFIX = e2eRunPrefix('own');
const IP_RANGE = '198.18.7';

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

async function photo(color: { r: number; g: number; b: number }) {
  return {
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: await sharp({ create: { width: 1200, height: 900, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  };
}

const DETAILS = /\/library\/exercises\/[0-9a-f-]{36}$/;
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

async function fillRequired(page: Page, name: string) {
  await page.getByLabel('Name').fill(name);
  await page
    .getByRole('group', { name: 'Primary muscles' })
    .getByRole('button', { name: 'Chest', exact: true })
    .click();
  await page.getByRole('checkbox', { name: 'Cable' }).click();
}

test.describe('custom exercises', () => {
  test.use({ locale: 'en-US' });

  test('creates an exercise with photos, finds it under Mine, reorders and deletes it', async ({
    page,
  }) => {
    test.skip(!STORAGE_READY, STORAGE_SKIP);
    await signUp(page);
    await page.goto('/library/exercises');
    await page.getByRole('link', { name: 'Create exercise' }).first().click();
    await page.waitForURL('**/library/exercises/new');
    await expect(page).toHaveTitle('New exercise · Pampojo');
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    await fillRequired(page, 'Cable Hug');
    const inputs = page.locator('input[type="file"]');
    await inputs.nth(0).setInputFiles(await photo({ r: 200, g: 60, b: 60 }));
    await inputs.nth(1).setInputFiles(await photo({ r: 60, g: 60, b: 200 }));
    await expect(page.getByRole('button', { name: /^Drag to reorder/ })).toHaveCount(2);
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL(DETAILS);
    const id = page.url().split('/').pop() ?? '';
    await expect(page.getByRole('heading', { level: 1, name: 'Cable Hug' })).toBeVisible();
    const image = page.getByRole('img', { name: 'Cable Hug, Start position' });
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    const before = await (await page.request.get(`/api/v1/exercises/${id}`)).json();
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.waitForURL('**/edit');
    // Keyboard reorder on the drag handle; pointer drag uses the same code path.
    await page.getByRole('button', { name: 'Drag to reorder, Start position' }).press('ArrowRight');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(DETAILS);
    await page.reload();
    const after = await (await page.request.get(`/api/v1/exercises/${id}`)).json();
    expect(after.frames.map((f: { id: string }) => f.id)).toEqual(
      [...before.frames].reverse().map((f: { id: string }) => f.id),
    );

    await page.goto('/library/exercises?mine=1');
    const card = page
      .getByRole('region', { name: 'Exercises' })
      .getByRole('link', { name: /Cable Hug/ });
    await expect(card).toContainText('Mine');

    await card.click();
    await page.waitForURL(DETAILS);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL('**/library/exercises');
    await page.goto(`/library/exercises/${id}`);
    await expect(page.getByRole('heading', { name: 'Exercise not found' })).toBeVisible();
  });

  test('duplicates a system exercise as my own', async ({ page }) => {
    test.skip(!STORAGE_READY, STORAGE_SKIP);
    await signUp(page);
    await page.goto('/library/exercises?q=bench');
    await page
      .getByRole('region', { name: 'Exercises' })
      .getByRole('link')
      .filter({ hasText: /^Bench Press/ })
      .click();
    await page.waitForURL(DETAILS);
    const sourceId = page.url().split('/').pop();
    await page.getByRole('link', { name: 'Duplicate as my own' }).click();
    await page.waitForURL('**/library/exercises/new?from=*');

    await expect(page.getByLabel('Name')).toHaveValue('Bench Press');
    await page.getByLabel('Name').fill('My Bench Press');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(DETAILS);

    const id = page.url().split('/').pop();
    const copy = await (await page.request.get(`/api/v1/exercises/${id}`)).json();
    expect(copy).toMatchObject({ isOwn: true, sourceExerciseId: sourceId, name: 'My Bench Press' });
    expect(copy.frames).toHaveLength(2);
    const source = await (await page.request.get(`/api/v1/exercises/${sourceId}`)).json();
    expect(source).toMatchObject({ isOwn: false, name: 'Bench Press' });

    await page.request.delete(`/api/v1/exercises/${id}`);
  });

  test('rejects a taken name and asks before discarding changes', async ({ page }) => {
    await signUp(page);
    await page.goto('/library/exercises/new');
    await fillRequired(page, 'Twin');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL(DETAILS);

    await page.goto('/library/exercises/new');
    await fillRequired(page, 'TWIN');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('You already have an exercise with this name.')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/library\/exercises\/new$/);
  });

  test('disables changes offline', async ({ page, context }) => {
    await signUp(page);
    const id = randomUUID();
    await page.request.put(`/api/v1/exercises/${id}`, {
      data: {
        name: 'Offline One',
        primaryMuscles: ['chest'],
        equipment: ['band'],
        trackingType: 'reps',
      },
    });
    await page.goto(`/library/exercises/${id}`);
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(page.getByText('Needs internet')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('custom exercises in Ukrainian', () => {
  test.use({ locale: 'uk-UA' });

  test('keeps the text it was written in when the UI switches to English', async ({
    page,
    context,
  }) => {
    await signUp(page);
    await page.goto('/library/exercises/new');
    await page.getByLabel('Назва').fill('Моя тяга');
    await page
      .getByRole('group', { name: "Основні м'язи" })
      .getByRole('button', { name: "Широкі м'язи спини", exact: true })
      .click();
    await page.getByRole('checkbox', { name: 'Блок' }).click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await page.waitForURL(DETAILS);

    await context.addCookies([{ name: 'lang', value: 'en', url: 'http://localhost:3000' }]);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Моя тяга' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  });
});
