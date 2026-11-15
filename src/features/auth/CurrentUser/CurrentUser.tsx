'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useOutboxRunner } from '@/services/local-db';

const CurrentUserContext = createContext<string | null>(null);

function OutboxRunner({ userId }: { userId: string }) {
  useOutboxRunner(userId);
  return null;
}

/** The id alone, without the outbox runner; tests use it to render device-data screens. */
export function CurrentUserIdProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return <CurrentUserContext.Provider value={userId}>{children}</CurrentUserContext.Provider>;
}

/** The signed-in user's id for client code that keeps data on the device; also drains the outbox. */
export function CurrentUserProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return (
    <CurrentUserContext.Provider value={userId}>
      <OutboxRunner userId={userId} />
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUserId(): string {
  const userId = useContext(CurrentUserContext);
  if (!userId) throw new Error('useCurrentUserId needs a CurrentUserProvider');
  return userId;
}
