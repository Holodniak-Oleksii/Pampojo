'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { calendarKeys } from '@/api/calendar';
import { progressKeys } from '@/api/progress';
import { deleteSession, sessionKeys } from '@/api/sessions';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { flushAllLocalDbs, useLocalDb, useSessionRepository } from '@/services/local-db';

/**
 * Deletes a finished session from the history. It needs the network: the server must have the
 * session first, so the outbox is sent before the delete.
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const db = useLocalDb(userId);
  const repository = useSessionRepository(userId);
  const [pending, setPending] = useState(false);

  const remove = useCallback(
    async (sessionId: string): Promise<boolean> => {
      setPending(true);
      try {
        await flushAllLocalDbs();
        if ((await db.outbox.where('entityId').equals(sessionId).count()) > 0) return false;
        await deleteSession(sessionId);
        await repository.forget(sessionId);
        await Promise.all(
          [sessionKeys.all, calendarKeys.all, progressKeys.all].map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
        return true;
      } catch {
        return false;
      } finally {
        setPending(false);
      }
    },
    [db, repository, queryClient],
  );

  return { remove, pending };
}
