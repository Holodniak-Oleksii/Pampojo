'use client';

import type { ReactNode } from 'react';
import { useRequiredLocalDb } from '@/services/local-db';
import { useInitialDownload } from '@/services/sync';
import { DownloadScreen } from './DownloadScreen';

/** Shows the download screen until this device has its first full copy of the user's data. */
export function LocalDataGate({
  children,
  fallback = null,
}: {
  children: ReactNode;
  /** Shows while the device reads its local data state, so the screen is never blank. */
  fallback?: ReactNode;
}) {
  const view = useInitialDownload(useRequiredLocalDb());
  if (view.state === 'loading') return fallback;
  if (view.state === 'done' || view.state === 'background') return children;
  return <DownloadScreen view={view} />;
}
