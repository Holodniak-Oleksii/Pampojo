import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise, WorkoutSnapshot } from '@/shared/schemas/session';
import { closeLocalDbs, openLocalDb } from '../db';
import { lastPerformanceFor } from '../last-performance';
import { deleteAllLocalDbs, flushAllLocalDbs } from '../logout';
import { flushOutbox } from '../outbox';
import { createSessionRepository } from '../session-repository';

const EXERCISE = '00000000-0000-4000-8000-0000000000aa';
const WORKOUT = '00000000-0000-4000-8000-0000000000bb';

function plan(entryId: string): SessionExercise[] {
  return [
    {
      id: entryId,
      exerciseId: EXERCISE,
      plannedSets: 3,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetWeightKg: null,
      targetDurationSec: null,
      targetDistanceM: null,
      notes: null,
      exercise: {
        id: EXERCISE,
        name: 'Bench Press',
        trackingType: 'weight_reps',
        laterality: null,
        thumbnailUrl: null,
      },
    },
  ];
}

const snapshot: WorkoutSnapshot = {
  workoutId: WORKOUT,
  name: 'Push Day',
  description: null,
  exercises: [],
};

async function setup() {
  const db = openLocalDb(crypto.randomUUID());
  const repo = createSessionRepository(db);
  const sessionId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  await repo.start({
    id: sessionId,
    workoutId: WORKOUT,
    workoutSnapshot: snapshot,
    exercises: plan(entryId),
    startedAt: new Date().toISOString(),
  });
  return { db, repo, sessionId, entryId };
}

const values = { weightKg: 80, reps: 8, durationSec: null, distanceM: null };

afterEach(async () => {
  vi.restoreAllMocks();
  closeLocalDbs();
  await Promise.all(
    (await Dexie.getDatabaseNames())
      .filter((n) => n.startsWith('pampojo-'))
      .map((n) => Dexie.delete(n)),
  );
});

describe('session repository', () => {
  it('start and logSet write local rows and one outbox entry each (AC2)', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    const set = await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    const outbox = await db.outbox.orderBy('seq').toArray();
    expect(outbox.map((entry) => [entry.method, entry.path])).toEqual([
      ['PUT', `/api/v1/sessions/${sessionId}`],
      ['PUT', `/api/v1/sets/${set.id}`],
    ]);
    const session = await db.sessions.get(sessionId);
    expect(session?.restSetId).toBe(set.id);
    expect(session?.restDurationSec).toBe(90);
    expect(new Date(session!.restEndsAt!).getTime()).toBeGreaterThan(Date.now() + 85_000);
  });

  it('unlog keeps the row id for a re-log and stops the rest started from it (AC11)', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    const first = await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    await repo.unlogSet(first.id);
    expect((await db.sessions.get(sessionId))?.restEndsAt).toBeNull();
    expect((await db.setLogs.get(first.id))?.deletedAt).not.toBeNull();
    const again = await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 60 });
    expect(again.id).toBe(first.id);
    expect((await db.setLogs.get(first.id))?.deletedAt).toBeNull();
  });

  it('finish remembers last performance for the next session offline (AC4)', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    await repo.logSet({
      sessionId,
      entryId,
      setIndex: 1,
      values: { ...values, reps: 6 },
      restSec: 90,
    });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await repo.finish(sessionId, new Date().toISOString());
    const last = await lastPerformanceFor(db, EXERCISE);
    expect(last?.sets.map((set) => set.reps)).toEqual([8, 6]);
    expect((await db.sessions.get(sessionId))?.status).toBe('completed');
  });

  it('adds up quick rest and set-count taps (review finding 3)', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    await Promise.all([
      repo.adjustRest(sessionId, -15),
      repo.adjustRest(sessionId, -15),
      repo.adjustRest(sessionId, -15),
    ]);
    expect((await db.sessions.get(sessionId))?.restDurationSec).toBe(45);
    await Promise.all([
      repo.changePlannedSets(sessionId, entryId, 1),
      repo.changePlannedSets(sessionId, entryId, 1),
    ]);
    expect((await db.sessions.get(sessionId))?.exercises[0]?.plannedSets).toBe(5);
  });

  it('abandon marks local sets deleted', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    await repo.abandon(sessionId);
    const sets = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    expect(sets.every((set) => set.deletedAt !== null)).toBe(true);
    expect((await db.sessions.get(sessionId))?.status).toBe('abandoned');
  });
});

describe('outbox', () => {
  it('sends in order, stops on a network error, and resumes (AC7)', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    expect(await flushOutbox(db)).toBe('failed');
    expect(await db.outbox.count()).toBe(2);

    const paths: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      paths.push(String(input));
      return new Response(null, { status: 204 });
    });
    expect(await flushOutbox(db)).toBe('done');
    expect(await db.outbox.count()).toBe(0);
    expect(paths[0]).toBe(`/api/v1/sessions/${sessionId}`);
    expect(paths[1]).toMatch(/^\/api\/v1\/sets\//);
  });

  it('drops a 4xx entry with a callback and keeps going; waits on 401', async () => {
    const { db, repo, sessionId, entryId } = await setup();
    await repo.logSet({ sessionId, entryId, setIndex: 0, values, restSec: 90 });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
    );
    expect(await flushOutbox(db)).toBe('failed');
    expect(await db.outbox.count()).toBe(2);

    fetchMock
      .mockResolvedValueOnce(
        Response.json({ error: { code: 'VALIDATION_FAILED' } }, { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const dropped = vi.fn();
    expect(await flushOutbox(db, { onDropped: dropped })).toBe('done');
    expect(dropped).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(0);
  });

  it('runs one flush at a time', async () => {
    const { db } = await setup();
    let release: () => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(new Response(null, { status: 204 }));
        }),
    );
    const first = flushOutbox(db);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(await flushOutbox(db)).toBe('busy');
    release();
    expect(await first).toBe('done');
  });
});

describe('logout helpers', () => {
  it('reports unsent entries and deletes every pampojo database (AC14)', async () => {
    await setup();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    expect(await flushAllLocalDbs()).toBe(1);
    await deleteAllLocalDbs();
    const names = (await Dexie.getDatabaseNames()).filter((n) => n.startsWith('pampojo-'));
    expect(names).toEqual([]);
  });
});
