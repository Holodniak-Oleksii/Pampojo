'use client';

import { useEffect } from 'react';
import { fetchSession, useSessionsQuery } from '@/api/sessions';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { useIsOnline } from '@/hooks/useIsOnline';
import {
  useLocalInProgress,
  useSessionRepository,
  type InProgressSummary,
} from '@/services/local-db';

/**
 * The in-progress session: the device's own, else one the server knows (another device), which is
 * copied onto this device. `undefined` while loading.
 */
export function useInProgress(): InProgressSummary | null | undefined {
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const repository = useSessionRepository(userId);
  const local = useLocalInProgress(userId);
  const remote = useSessionsQuery(
    { status: SESSION_STATUS.IN_PROGRESS },
    { enabled: online && local === null },
  );
  const remoteId = local === null ? remote.data?.items[0]?.id : undefined;

  useEffect(() => {
    if (!remoteId) return;
    let cancelled = false;
    void fetchSession(remoteId)
      .then((session) => {
        if (!cancelled && session?.status === SESSION_STATUS.IN_PROGRESS) {
          return repository.importRemote(session);
        }
      })
      .catch(() => {
        // Offline or a server error: the Start sheet shows the workouts instead.
      });
    return () => {
      cancelled = true;
    };
  }, [remoteId, repository]);

  return local;
}
