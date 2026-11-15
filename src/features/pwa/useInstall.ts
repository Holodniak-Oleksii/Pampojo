'use client';

import { useSyncExternalStore } from 'react';
import { getInstallState, installPath, promptInstall, subscribeInstall } from './install';
import type { InstallPath } from './types';

/** How this device can install the app, or null; null on the server and during hydration. */
export function useInstall(): { path: InstallPath; promptInstall: () => Promise<void> } {
  const path = useSyncExternalStore(
    subscribeInstall,
    () => installPath(getInstallState()),
    () => null,
  );
  return { path, promptInstall };
}
