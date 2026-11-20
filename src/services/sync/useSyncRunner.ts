'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { calendarKeys } from '@/api/calendar';
import { progressKeys } from '@/api/progress';
import { sessionKeys } from '@/api/sessions';
import type { PampojoDb } from '@/services/local-db/db';
import { onOutboxEnqueued } from '@/services/local-db/outbox';
import { needsDownload } from './download';
import { syncNow } from './engine';
import { readSyncMeta } from './meta';
import { finishesSession } from './push';
import { onSyncRequested } from './request-sync';

const BACKOFF_START_MS = 2000;
const BACKOFF_MAX_MS = 60_000;
const BUSY_RETRY_MS = 1000;
const ENQUEUE_DEBOUNCE_MS = 300;

/** Keeps the device in sync while a signed-in screen is open (iOS has no Background Sync). */
export function useSyncRunner(db: PampojoDb): void {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    let delay = BACKOFF_START_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // Data that the server computes changes once a session reaches it.
    const refreshServerViews = () => {
      void queryClient.invalidateQueries({ queryKey: progressKeys.all });
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.history() });
    };

    const run = async () => {
      if (stopped) return;
      clearTimeout(timer);
      const meta = await readSyncMeta(db);
      // The download screen runs the first sync itself.
      if (needsDownload(meta)) return;
      const profile = await db.meta.get('profile');
      const result = await syncNow(db, {
        timeZone: profile?.key === 'profile' ? profile.value.timeZone : undefined,
        onRejected: () => toast(t("Couldn't save a change to the server.")),
        onApplied: (entry) => {
          if (finishesSession(entry)) refreshServerViews();
        },
        onSessionsChanged: refreshServerViews,
      });
      if (stopped) return;
      if (result === 'failed') {
        timer = setTimeout(() => void run(), delay);
        delay = Math.min(delay * 2, BACKOFF_MAX_MS);
      } else if (result === 'done') {
        delay = BACKOFF_START_MS;
      } else {
        // Another sync holds the lock and may have finished before this change committed.
        timer = setTimeout(() => void run(), BUSY_RETRY_MS);
      }
    };

    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void run(), ENQUEUE_DEBOUNCE_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run();
    };
    const onOnline = () => {
      delay = BACKOFF_START_MS;
      void run();
    };

    void run();
    const stopEnqueued = onOutboxEnqueued(soon);
    const stopRequested = onSyncRequested(() => void run());
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(debounce);
      stopEnqueued();
      stopRequested();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [db, t, queryClient]);
}
