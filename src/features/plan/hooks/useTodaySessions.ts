'use client';

import { useMemo } from 'react';
import { useSessionsQuery } from '@/api/sessions';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocalScheduledSessions } from '@/services/local-db';
import type { ScheduledSession } from '../resolveScheduledFor';

/** Sessions linked to `date`: the server's merged with this device's, the local copy winning. */
export function useTodaySessions(date: string): ScheduledSession[] {
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const remote = useSessionsQuery({ scheduledFor: date }, { enabled: online });
  const local = useLocalScheduledSessions(userId, date);
  return useMemo(() => {
    const byId = new Map<string, ScheduledSession>();
    for (const item of remote.data?.items ?? []) byId.set(item.id, item);
    for (const session of local ?? []) byId.set(session.id, session);
    return [...byId.values()];
  }, [remote.data, local]);
}
