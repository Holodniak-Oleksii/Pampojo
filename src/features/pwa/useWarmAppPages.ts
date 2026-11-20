'use client';

import { useEffect } from 'react';
import type { PampojoDb } from '@/services/local-db/db';
import { onSyncDone } from '@/services/sync/request-sync';
import { offlineTargets } from './offline-targets';
import { warmExerciseImages } from './warm-images';
import { warmMissingPages } from './warm-pages';

/**
 * Keeps the app pages and exercise images of the user's data in the caches, so they open offline
 * without a first visit (specs 16 and 17).
 */
export function useWarmAppPages(db: PampojoDb): void {
  useEffect(() => {
    let stopped = false;
    const warm = async () => {
      const targets = await offlineTargets(db).catch(() => null);
      if (stopped) return;
      await warmMissingPages(targets?.paths ?? []);
      if (targets && !stopped) await warmExerciseImages(targets.imageUrls);
    };
    const onEvent = () => void warm();
    void warm();
    const stopDone = onSyncDone(onEvent);
    window.addEventListener('online', onEvent);
    navigator.serviceWorker?.addEventListener('controllerchange', onEvent);
    return () => {
      stopped = true;
      stopDone();
      window.removeEventListener('online', onEvent);
      navigator.serviceWorker?.removeEventListener('controllerchange', onEvent);
    };
  }, [db]);
}
