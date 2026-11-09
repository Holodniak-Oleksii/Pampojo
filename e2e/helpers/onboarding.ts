import type { Page } from '@playwright/test';

export const ONBOARDING_BODY = {
  displayName: 'John Smith',
  avatarEmoji: 'fox',
  avatarColor: 1,
  sex: 'male',
  birthDate: '1990-05-15',
  heightCm: 180,
  weightKg: 79.8,
  unitSystem: 'metric',
  timeZone: 'Europe/Kyiv',
} as const;

/** Finishes onboarding through the API with the page's session, for tests that are not about onboarding. */
export async function completeOnboardingViaApi(page: Page): Promise<void> {
  const response = await page.request.put('/api/v1/me/profile', { data: ONBOARDING_BODY });
  if (!response.ok()) {
    throw new Error(
      `Onboarding failed: ${response.status()} ${(await response.text()).slice(0, 200)}`,
    );
  }
}
