'use client';

import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { useLocalInProgress, type InProgressSummary } from '@/services/local-db';

/**
 * The active in-progress session of this device. Pull brings sessions of other devices, so the
 * device copy is enough. `undefined` while loading.
 */
export function useInProgress(): InProgressSummary | null | undefined {
  return useLocalInProgress(useCurrentUserId());
}
