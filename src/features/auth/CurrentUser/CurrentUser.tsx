'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { LocalDbProvider, useRequiredLocalDb } from '@/services/local-db';
import { useSyncRunner } from '@/services/sync';
import { useWarmAppPages } from '@/features/pwa';
import { LocalDataGate } from '@/features/sync/LocalDataGate';

const CurrentUserContext = createContext<string | null>(null);

function PageWarmer() {
  useWarmAppPages();
  return null;
}

function SyncRunner() {
  useSyncRunner(useRequiredLocalDb());
  return null;
}

/** The id alone, without the sync runner; tests use it to render device-data screens. */
export function CurrentUserIdProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return <CurrentUserContext.Provider value={userId}>{children}</CurrentUserContext.Provider>;
}

/**
 * The signed-in user's id for client code that keeps data on the device. It also opens the local
 * database, keeps it in sync, and shows the download screen until the first download ends.
 */
export function CurrentUserProvider({
  userId,
  fallback = null,
  children,
}: {
  userId: string;
  /** Shows while the device reads its local data state. */
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CurrentUserContext.Provider value={userId}>
      <LocalDbProvider userId={userId}>
        <SyncRunner />
        <LocalDataGate fallback={fallback}>
          <PageWarmer />
          {children}
        </LocalDataGate>
      </LocalDbProvider>
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUserId(): string {
  const userId = useContext(CurrentUserContext);
  if (!userId) throw new Error('useCurrentUserId needs a CurrentUserProvider');
  return userId;
}
