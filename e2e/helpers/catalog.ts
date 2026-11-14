import { expect, type Locator, type Page } from '@playwright/test';

const NAME = /^(Filters|Фільтри)$/;

/** The catalog filters: the side column on desktop, the filter sheet (opened if needed) on mobile. */
export async function catalogFilters(page: Page): Promise<Locator> {
  const search = page.getByRole('search', { name: NAME });
  await expect(search).toBeVisible();
  const trigger = search.getByRole('button', { name: /^(Filters|Фільтри)( \(\d+\))?$/ });
  if (!(await trigger.isVisible())) return search;
  const sheet = page.getByRole('dialog', { name: NAME });
  if (!(await sheet.isVisible())) await trigger.click();
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Closes the mobile filter sheet so the results are reachable again. */
export async function closeCatalogFilters(page: Page): Promise<void> {
  const sheet = page.getByRole('dialog', { name: NAME });
  if (!(await sheet.isVisible())) return;
  await sheet.getByRole('button', { name: /^(Show exercises|Показати вправи)$/ }).click();
  await expect(sheet).toBeHidden();
}
