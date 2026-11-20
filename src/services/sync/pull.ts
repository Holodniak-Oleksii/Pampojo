import { http } from '@/api/http';
import { SYNC_COUNTED_PHASES } from '@/constants/sync';
import type { PampojoDb } from '@/services/local-db/db';
import { pendingEntityIds } from '@/services/local-db/outbox';
import { pullResponseSchema, type SyncChanges, type SyncTotals } from '@/shared/schemas/sync';
import { applyPullPage, pullTables } from './apply';
import { readSyncMeta, updateSyncMeta } from './meta';

export const SYNC_PULL_PATH = '/api/v1/sync/pull';

export const ZERO_TOTALS: SyncTotals = {
  workouts: 0,
  scheduleRules: 0,
  exercises: 0,
  lastPerformance: 0,
  sessions: 0,
  setLogs: 0,
  measurements: 0,
};

export function addReceived(received: SyncTotals, changes: SyncChanges): SyncTotals {
  const next = { ...received };
  for (const phase of SYNC_COUNTED_PHASES) next[phase] += changes[phase].length;
  return next;
}

export interface PullOptions {
  onPage?: (changes: SyncChanges, totals: SyncTotals | undefined) => void;
}

/**
 * Pulls every page of a run. Each page and its cursor commit in one Dexie transaction, so a stopped
 * run continues from the last written page. Network and server errors reject.
 */
export async function pullChanges(
  db: PampojoDb,
  options: PullOptions = {},
): Promise<{ sessionsChanged: boolean }> {
  let sessionsChanged = false;
  for (;;) {
    const meta = await readSyncMeta(db);
    const since = meta.pageToken ?? meta.cursor;
    const query = since ? `?${new URLSearchParams({ since }).toString()}` : '';
    const page = await http(`${SYNC_PULL_PATH}${query}`, { schema: pullResponseSchema });
    await db.transaction('rw', pullTables(db), async () => {
      const result = await applyPullPage(db, page.changes, await pendingEntityIds(db));
      sessionsChanged ||= result.sessionsChanged;
      await updateSyncMeta(
        db,
        page.nextCursor
          ? { pageToken: page.nextCursor }
          : { pageToken: null, cursor: page.cursor, lastSyncAt: new Date().toISOString() },
      );
    });
    options.onPage?.(page.changes, page.totals);
    if (!page.nextCursor) return { sessionsChanged };
  }
}
