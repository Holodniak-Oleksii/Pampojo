'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { PampojoDb, SyncMeta } from '@/services/local-db/db';
import { readSyncMeta } from './meta';

/** Changes in the outbox that wait to sync. */
export function useOutboxCount(db: PampojoDb): number {
  return useLiveQuery(() => db.outbox.count(), [db]) ?? 0;
}

export function useSyncMeta(db: PampojoDb): SyncMeta | undefined {
  return useLiveQuery(() => readSyncMeta(db), [db]);
}

/** True while the outbox holds a change for one of these entities. */
export function useHasUnsynced(db: PampojoDb, entityIds: readonly string[]): boolean {
  const key = entityIds.join(',');
  return (
    useLiveQuery(
      async () =>
        entityIds.length > 0 && (await db.outbox.where('entityId').anyOf(entityIds).count()) > 0,
      // `key` stands for `entityIds`, which is a new array on each render.
      [db, key],
    ) ?? false
  );
}
