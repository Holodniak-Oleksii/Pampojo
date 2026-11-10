import 'server-only';
import { cache } from 'react';
import { isOnboardingComplete } from './service';

// One lookup per request, shared by the (app) gate, the onboarding gate and pages.
export const getRequestOnboardingComplete = cache(async (userId: string) =>
  isOnboardingComplete(userId),
);
