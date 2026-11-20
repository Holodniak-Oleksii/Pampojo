import { afterEach, describe, expect, it } from 'vitest';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import { addDays } from '@/shared/plan/occurrences';
import { openLocalDb } from '@/services/local-db';
import { enqueue } from '@/services/local-db/outbox';
import { localSession, localSet, resetLocalDbs } from '@/test/local-session';
import { pruneLocal } from '../prune';

afterEach(async () => {
  await resetLocalDbs();
});

const today = '2026-11-20';
const startOn = (date: string) => `${date}T12:00:00.000Z`;

describe('pruneLocal', () => {
  it('deletes synced sessions older than 30 days and keeps pending and recent ones (AC13)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const old = localSession({
      id: crypto.randomUUID(),
      status: 'completed',
      startedAt: startOn(addDays(today, -40)),
    });
    const pending = localSession({
      id: crypto.randomUUID(),
      status: 'completed',
      startedAt: startOn(addDays(today, -40)),
    });
    const recent = localSession({
      id: crypto.randomUUID(),
      status: 'completed',
      startedAt: startOn(addDays(today, -3)),
    });
    const running = localSession({
      id: crypto.randomUUID(),
      status: 'in_progress',
      startedAt: startOn(addDays(today, -40)),
    });
    await db.sessions.bulkPut([old, pending, recent, running]);
    await db.setLogs.bulkPut([localSet({ sessionId: old.id }), localSet({ sessionId: recent.id })]);
    await enqueue(db, { type: SYNC_MUTATION_TYPE.SESSION_PATCH, entityId: pending.id });

    await pruneLocal(db, today);

    expect((await db.sessions.toArray()).map((row) => row.id).sort()).toEqual(
      [pending.id, recent.id, running.id].sort(),
    );
    expect((await db.setLogs.toArray()).map((row) => row.sessionId)).toEqual([recent.id]);
  });
});
