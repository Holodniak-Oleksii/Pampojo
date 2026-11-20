import { useSyncExternalStore } from 'react';
import { isOnline, subscribeConnectivity } from '@/services/connectivity';

/** The one source for online checks: `navigator.onLine` plus the health ping (spec 17). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isOnline, () => true);
}
