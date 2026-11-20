'use client';

import { useIsOnline } from '@/hooks/useIsOnline';
import { useOptionalLocalDb } from '@/services/local-db';

/** Measurements work offline on the device, so their controls need the network only without it. */
export function useMeasurementsAvailable(): boolean {
  const online = useIsOnline();
  return useOptionalLocalDb() !== null || online;
}
