import { ApiError, http } from '@/api/http';
import { SYNC_MUTATION_TYPE, SYNC_PUSH_BATCH_MAX, SYNC_PUSH_STATUS } from '@/constants/sync';
import { SESSION_STATUS } from '@/constants/session';
import type { OutboxEntry, PampojoDb } from '@/services/local-db/db';
import { pushResponseSchema, type SyncMutation } from '@/shared/schemas/sync';
import { readSyncMeta, updateSyncMeta } from './meta';

export const SYNC_PUSH_PATH = '/api/v1/sync/push';

export interface PushOptions {
  onRejected?: (entry: OutboxEntry, code: string) => void;
  onApplied?: (entry: OutboxEntry) => void;
}

export type PushResultStatus = 'done' | 'failed';

export const finishesSession = (entry: OutboxEntry) =>
  entry.type === SYNC_MUTATION_TYPE.SESSION_PATCH &&
  (entry.payload as { status?: unknown } | undefined)?.status === SESSION_STATUS.COMPLETED;

const toMutation = (entry: OutboxEntry): SyncMutation => ({
  id: entry.id,
  type: entry.type,
  entityId: entry.entityId,
  payload: entry.payload,
  createdAt: entry.createdAt,
});

/**
 * Sends the outbox in `seq` order, in batches of at most 50, until it is empty. The push carries no
 * Idempotency-Key, because the mutation ids already make a replay safe; the sync runner retries.
 */
export async function pushOutbox(
  db: PampojoDb,
  options: PushOptions = {},
): Promise<PushResultStatus> {
  for (;;) {
    const batch = await db.outbox.orderBy('seq').limit(SYNC_PUSH_BATCH_MAX).toArray();
    if (batch.length === 0) return 'done';
    let results;
    try {
      ({ results } = await http(SYNC_PUSH_PATH, {
        method: 'POST',
        body: { mutations: batch.map(toMutation) },
        schema: pushResponseSchema,
      }));
    } catch (error) {
      if (!(error instanceof ApiError) && !(error instanceof TypeError)) throw error;
      await db.transaction('rw', db.outbox, async () => {
        for (const entry of batch) {
          if (entry.seq !== undefined)
            await db.outbox.update(entry.seq, { attempts: entry.attempts + 1 });
        }
      });
      return 'failed';
    }
    const byId = new Map(results.map((result) => [result.id, result]));
    const rejected: { entry: OutboxEntry; code: string }[] = [];
    const applied: OutboxEntry[] = [];
    await db.transaction('rw', [db.outbox, db.meta], async () => {
      for (const entry of batch) {
        const result = byId.get(entry.id);
        if (!result || entry.seq === undefined) continue;
        await db.outbox.delete(entry.seq);
        if (result.status === SYNC_PUSH_STATUS.REJECTED) {
          const code = result.error ?? 'UNKNOWN';
          rejected.push({ entry, code });
          await updateSyncMeta(db, { lastError: { code, at: new Date().toISOString() } });
        } else if (result.status === SYNC_PUSH_STATUS.APPLIED) {
          applied.push(entry);
        }
      }
      // The sync view shows the last rejection until a batch passes with none.
      if (rejected.length === 0 && (await readSyncMeta(db)).lastError !== null) {
        await updateSyncMeta(db, { lastError: null });
      }
    });
    for (const { entry, code } of rejected) options.onRejected?.(entry, code);
    for (const entry of applied) options.onApplied?.(entry);
    // The server answers every id it got. An entry with no answer stays, so stop instead of resending it in a loop.
    if (batch.some((entry) => !byId.has(entry.id))) return 'failed';
  }
}
