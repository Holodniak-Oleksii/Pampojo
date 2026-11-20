import { afterEach, describe, expect, it } from 'vitest';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import { openLocalDb, type PampojoDb } from '@/services/local-db';
import { enqueue, pendingEntityIds } from '@/services/local-db/outbox';
import type { SyncChanges } from '@/shared/schemas/sync';
import { localSession, resetLocalDbs } from '@/test/local-session';
import { applyPullPage, pullTables } from '../apply';
import { updateSyncMeta } from '../meta';

afterEach(async () => {
  await resetLocalDbs();
});

const empty = (): SyncChanges => ({
  profile: null,
  gym: null,
  gymChanged: false,
  workouts: [],
  scheduleRules: [],
  exercises: [],
  lastPerformance: [],
  sessions: [],
  setLogs: [],
  measurements: [],
});

async function apply(db: PampojoDb, changes: SyncChanges) {
  await db.transaction('rw', pullTables(db), async () =>
    applyPullPage(db, changes, await pendingEntityIds(db)),
  );
}

const serverSession = (override: Partial<SyncChanges['sessions'][number]> = {}) => {
  const {
    restEndsAt: _a,
    restDurationSec: _b,
    restSetId: _c,
    currentEntryId: _d,
    drafts: _e,
    newRecords: _f,
    ...server
  } = localSession();
  void [_a, _b, _c, _d, _e, _f];
  return { ...server, ...override };
};

const measurement = (id: string, value: number) => ({
  id,
  type: 'weight' as const,
  value,
  measuredOn: '2026-11-01',
  updatedAt: '2026-11-01T10:00:00.000Z',
  deletedAt: null,
});

describe('applyPullPage', () => {
  it('keeps one row when the same page comes twice (AC16)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const page = { ...empty(), measurements: [measurement(crypto.randomUUID(), 80)] };
    await apply(db, page);
    await apply(db, page);
    expect(await db.measurements.count()).toBe(1);
  });

  it('does not overwrite a row with a pending outbox entry', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const id = crypto.randomUUID();
    await db.measurements.put({ ...measurement(id, 82) });
    await enqueue(db, { type: SYNC_MUTATION_TYPE.MEASUREMENT_PUT, entityId: id });
    await apply(db, { ...empty(), measurements: [measurement(id, 80)] });
    expect((await db.measurements.get(id))?.value).toBe(82);
  });

  it('deletes the local row of the same day with another id, which the server merged', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const local = crypto.randomUUID();
    const server = crypto.randomUUID();
    await db.measurements.put(measurement(local, 81));
    await apply(db, { ...empty(), measurements: [measurement(server, 81)] });
    expect((await db.measurements.toArray()).map((row) => row.id)).toEqual([server]);
  });

  it('keeps the local rest and drafts of a pulled in-progress session (AC14)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const restEndsAt = new Date(Date.now() + 60_000).toISOString();
    await db.sessions.put(
      localSession({
        restEndsAt,
        drafts: { 'x:0': { weightKg: 50, reps: 5, durationSec: null, distanceM: null } },
      }),
    );
    await apply(db, { ...empty(), sessions: [serverSession({ notes: 'From the other device' })] });
    const row = await db.sessions.get(localSession().id);
    expect(row?.notes).toBe('From the other device');
    expect(row?.restEndsAt).toBe(restEndsAt);
    expect(Object.keys(row?.drafts ?? {})).toEqual(['x:0']);
  });

  it('marks a pulled in-progress session as not active when this device has its own (AC14)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const own = localSession({ id: crypto.randomUUID() });
    await db.sessions.put(own);
    await updateSyncMeta(db, { activeSessionId: own.id });
    const other = serverSession({ id: crypto.randomUUID() });
    await apply(db, { ...empty(), sessions: [other] });
    expect((await db.sessions.get(other.id))?.deviceOwned).toBe(false);
  });

  it('deletes the local copy of an abandoned session and its sets', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await db.sessions.put(localSession());
    await db.setLogs.put({
      id: crypto.randomUUID(),
      sessionId: localSession().id,
      sessionExerciseId: crypto.randomUUID(),
      exerciseId: crypto.randomUUID(),
      setIndex: 0,
      weightKg: 50,
      reps: 5,
      durationSec: null,
      distanceM: null,
      completedAt: new Date().toISOString(),
      deletedAt: null,
    });
    await apply(db, { ...empty(), sessions: [serverSession({ status: 'abandoned' })] });
    expect(await db.sessions.count()).toBe(0);
    expect(await db.setLogs.count()).toBe(0);
  });
});
