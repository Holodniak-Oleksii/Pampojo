'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { openLocalDb, type PampojoDb } from './db';

const LocalDbContext = createContext<PampojoDb | null>(null);

/** The local database of the signed-in user, for query hooks that read Dexie. */
export function LocalDbProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const db = useMemo(() => openLocalDb(userId), [userId]);
  return <LocalDbContext.Provider value={db}>{children}</LocalDbContext.Provider>;
}

/** `null` outside the signed-in app (landing, onboarding, tests), where hooks use the network. */
export function useOptionalLocalDb(): PampojoDb | null {
  return useContext(LocalDbContext);
}

export function useRequiredLocalDb(): PampojoDb {
  const db = useContext(LocalDbContext);
  if (!db) throw new Error('useRequiredLocalDb needs a LocalDbProvider');
  return db;
}
