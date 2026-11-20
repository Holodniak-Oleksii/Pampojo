'use client';

import { useIsOnline } from '@/hooks/useIsOnline';

/** For a call site that swaps its leading icon for WifiOff while an `OnlineOnly` control is blocked. */
export function useRequiresOnline(): { blocked: boolean } {
  return { blocked: !useIsOnline() };
}
