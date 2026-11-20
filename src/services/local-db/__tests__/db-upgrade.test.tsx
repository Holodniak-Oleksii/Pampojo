import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { resetLocalDbs } from '@/test/local-session';
import { PampojoDb } from '../db';

afterEach(async () => {
  await resetLocalDbs();
});

describe('Dexie version 2 upgrade', () => {
  it('turns spec 10 REST entries into typed mutations with the same ids and order (AC15)', async () => {
    const name = `pampojo-${crypto.randomUUID()}`;
    const session = crypto.randomUUID();
    const set = crypto.randomUUID();
    const v1 = new Dexie(name);
    v1.version(1).stores({
      sessions: 'id, status, startedAt',
      setLogs: 'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]',
      lastPerformance: 'exerciseId',
      outbox: '++seq',
    });
    const entry = (id: string, method: string, path: string, body?: unknown) => ({
      id,
      method,
      path,
      body,
      createdAt: '2026-11-15T10:00:00.000Z',
      attempts: 1,
    });
    await v1
      .table('outbox')
      .bulkAdd([
        entry('a', 'PUT', `/api/v1/sessions/${session}`, { workoutId: 'w' }),
        entry('b', 'PUT', `/api/v1/sets/${set}`, { reps: 8 }),
        entry('c', 'PATCH', `/api/v1/sets/${set}`, { reps: 9 }),
        entry('d', 'DELETE', `/api/v1/sets/${set}`),
        entry('e', 'PATCH', `/api/v1/sessions/${session}`, { status: 'completed' }),
      ]);
    v1.close();

    const db = new PampojoDb(name);
    const entries = await db.outbox.orderBy('seq').toArray();
    db.close();
    expect(entries.map((item) => [item.id, item.type, item.entityId])).toEqual([
      ['a', 'session.put', session],
      ['b', 'set.put', set],
      ['c', 'set.patch', set],
      ['d', 'set.delete', set],
      ['e', 'session.patch', session],
    ]);
    expect(entries[1]?.payload).toEqual({ reps: 8 });
    expect(entries[0]?.attempts).toBe(1);
  });
});
