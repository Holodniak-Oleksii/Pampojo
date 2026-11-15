'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { openLocalDb } from './db';
import { flushOutbox, onOutboxEnqueued } from './outbox';

const BACKOFF_START_MS = 2000;
const BACKOFF_MAX_MS = 60_000;
const BUSY_RETRY_MS = 1000;

/** Keeps the outbox draining while a signed-in screen is open (iOS has no Background Sync). */
export function useOutboxRunner(userId: string): void {
  const { t } = useTranslation();

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
  }, [userId, t]);
}
