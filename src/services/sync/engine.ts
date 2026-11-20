import { todayIn } from '@/lib/dates';
import type { PampojoDb } from '@/services/local-db/db';
import type { SyncChanges, SyncTotals } from '@/shared/schemas/sync';
import { pruneLocal } from './prune';
import { pullChanges } from './pull';
import { pushOutbox, type PushOptions } from './push';

export type SyncResult = 'done' | 'failed' | 'busy';

export interface SyncOptions extends PushOptions {
  onPage?: (changes: SyncChanges, totals: SyncTotals | undefined) => void;
  onSessionsChanged?: () => void;
  /** The profile time zone for the 30-day window; the device zone when unknown. */
  timeZone?: string;
}

const running = new Set<string>();

async function run(db: PampojoDb, options: SyncOptions): Promise<'done' | 'failed'> {
  if ((await pushOutbox(db, options)) === 'failed') return 'failed';
  try {
    const { sessionsChanged } = await pullChanges(db, { onPage: options.onPage });
    const zone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    await pruneLocal(db, todayIn(zone));
    if (sessionsChanged) options.onSessionsChanged?.();
    return 'done';
  } catch (error) {
    console.warn('[sync] pull failed', error);
    return 'failed';
  }
}

/**
 * Pushes the outbox, pulls changes and prunes old rows. One sync runs per database at a time,
 * across tabs (Web Locks) and in this tab; another call meanwhile returns `busy`.
 */
export async function syncNow(db: PampojoDb, options: SyncOptions = {}): Promise<SyncResult> {
  const lockName = `${db.name}-sync`;
  if (running.has(lockName)) return 'busy';
  running.add(lockName);
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request(lockName, { ifAvailable: true }, async (lock) =>
        lock ? run(db, options) : ('busy' as const),
      );
    }
    return await run(db, options);
  } finally {
    running.delete(lockName);
  }
}
