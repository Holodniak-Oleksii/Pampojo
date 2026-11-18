'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { progressKeys } from '@/api/progress';
import { SESSION_STATUS } from '@/constants/session';
import { openLocalDb, type OutboxEntry } from './db';
import { flushOutbox, onOutboxEnqueued } from './outbox';

const BACKOFF_START_MS = 2000;
const BACKOFF_MAX_MS = 60_000;
const BUSY_RETRY_MS = 1000;

const finishesSession = (entry: OutboxEntry) =>
  entry.method === 'PATCH' &&
  (entry.body as { status?: unknown } | undefined)?.status === SESSION_STATUS.COMPLETED;

/** Keeps the outbox draining while a signed-in screen is open (iOS has no Background Sync). */
export function useOutboxRunner(userId: string): void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const db = openLocalDb(userId);
    let delay = BACKOFF_START_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const run = async () => {
      if (stopped) return;
      clearTimeout(timer);
      const result = await flushOutbox(db, {
        onDropped: () => toast(t("Couldn't save a change to the server.")),
        // Progress is computed on the server, so it changes only once the finish reaches it.
        onSent: (entry) => {
          if (finishesSession(entry))
            void queryClient.invalidateQueries({ queryKey: progressKeys.all });
        },
      });
      if (stopped) return;
      if (result === 'failed') {
        timer = setTimeout(() => void run(), delay);
        delay = Math.min(delay * 2, BACKOFF_MAX_MS);
      } else if (result === 'done') {
        delay = BACKOFF_START_MS;
      } else {
        // Another flush holds the lock and may have finished before this entry committed.
        timer = setTimeout(() => void run(), BUSY_RETRY_MS);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onOnline = () => {
      delay = BACKOFF_START_MS;
      void run();
    };

    void run();
    const unsubscribe = onOutboxEnqueued(() => void run());
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, t, queryClient]);
}
