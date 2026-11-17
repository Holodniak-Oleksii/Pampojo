import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise, SetValues } from '@/shared/schemas/session';
import { closeLocalDbs, openLocalDb, type PampojoDb } from '../db';
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

const lift = (weightKg: number, reps: number): SetValues => ({
  weightKg,
  reps,
  durationSec: null,
  distanceM: null,
});

/** Starts, logs and finishes one session on the device, with no network. */
async function trainOffline(db: PampojoDb, sets: SetValues[]): Promise<string> {
  const repo = createSessionRepository(db);
  const sessionId = crypto.randomUUID();
  const entryId = crypto.randomUUID();
  await repo.start({
    id: sessionId,
    workoutId: WORKOUT,
    workoutSnapshot: { workoutId: WORKOUT, name: 'Push Day', description: null, exercises: [] },
    exercises: plan(entryId),
    startedAt: new Date().toISOString(),
    scheduledFor: null,
  });
  for (const [setIndex, values] of sets.entries()) {
    await repo.logSet({ sessionId, entryId, setIndex, values, restSec: 90 });
  }
  await repo.finish(sessionId, new Date().toISOString());
  return sessionId;
}

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  closeLocalDbs();
  await Promise.all(
    (await Dexie.getDatabaseNames())
      .filter((name) => name.startsWith('pampojo-'))
      .map((name) => Dexie.delete(name)),
  );
});

describe('new records at finish', () => {
  it('the first session of an exercise is a baseline with no records (AC3)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const sessionId = await trainOffline(db, [lift(80, 8)]);
    expect((await db.sessions.get(sessionId))?.newRecords).toEqual([]);
    expect((await db.lastPerformance.get(EXERCISE))?.bests).toMatchObject({
      heaviestWeightKg: 80,
    });
  });

  it('compares with the stored bests and local sessions offline (AC4)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    // Bests from the server, stored at a start before this device trained.
    await db.lastPerformance.put({
      exerciseId: EXERCISE,
      sessionId: crypto.randomUUID(),
      finishedAt: '2026-11-01T10:00:00.000Z',
      fetchedAt: '2026-11-01T10:00:00.000Z',
      sets: [],
      bests: {
        heaviestWeightKg: 85,
        bestE1rmKg: 95,
        mostReps: { reps: 10, weightKg: 60 },
        bestVolumeKg: 2000,
        longestDurationSec: null,
        longestDistanceM: null,
      },
    });
    await trainOffline(db, [lift(80, 12)]);
    const second = await trainOffline(db, [lift(90, 3), lift(80, 12)]);
    expect((await db.sessions.get(second))?.newRecords).toEqual([
      { exerciseId: EXERCISE, type: 'heaviest_weight', value: 90, weightKg: null, reps: null },
    ]);
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('last-performance'),
      expect.anything(),
    );
    expect((await db.lastPerformance.get(EXERCISE))?.bests).toMatchObject({
      heaviestWeightKg: 90,
      mostReps: { reps: 12, weightKg: 80 },
      bestVolumeKg: 2000,
    });
  });
});
