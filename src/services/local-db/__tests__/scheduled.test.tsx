import { afterEach, describe, expect, it } from 'vitest';
import type { SessionExercise, WorkoutSnapshot } from '@/shared/schemas/session';
import { closeLocalDbs, openLocalDb } from '../db';
import { findCompletedSessionsBetween } from '../scheduled';
import { createSessionRepository } from '../session-repository';

const EXERCISE = '00000000-0000-4000-8000-0000000000aa';
const WORKOUT = '00000000-0000-4000-8000-0000000000bb';

const plan = (entryId: string): SessionExercise[] => [
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

const snapshot: WorkoutSnapshot = {
  workoutId: WORKOUT,
  name: 'Push Day',
  description: null,
  exercises: [],
};
const values = { weightKg: 80, reps: 8, durationSec: null, distanceM: null };

afterEach(() => {
  closeLocalDbs();
});

describe('findCompletedSessionsBetween', () => {
  it('returns completed sessions in the range with their live set count', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const repo = createSessionRepository(db);
    const start = async (startedAt: string, scheduledFor: string | null) => {
      const id = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      await repo.start({
        id,
        workoutId: WORKOUT,
        workoutSnapshot: snapshot,
        exercises: plan(entryId),
        startedAt,
        scheduledFor,
      });
      return { id, entryId };
    };

    const done = await start('2026-11-16T17:00:00.000Z', '2026-11-16');
    await repo.logSet({
      sessionId: done.id,
      entryId: done.entryId,
      setIndex: 0,
      values,
      restSec: 90,
    });
    const unlogged = await repo.logSet({
      sessionId: done.id,
      entryId: done.entryId,
      setIndex: 1,
      values,
      restSec: 90,
    });
    await repo.unlogSet(unlogged.id);
    await repo.finish(done.id, '2026-11-16T18:00:00.000Z');

    const running = await start('2026-11-17T08:00:00.000Z', null);
    const old = await start('2026-10-01T17:00:00.000Z', null);
    await repo.finish(old.id, '2026-10-01T18:00:00.000Z');

    const found = await findCompletedSessionsBetween(db, '2026-11-10', '2026-11-17');
    expect(found.map((item) => item.id)).toEqual([done.id]);
    expect(found[0]).toMatchObject({
      workoutName: 'Push Day',
      scheduledFor: '2026-11-16',
      setCount: 1,
    });
    expect(found.some((item) => item.id === running.id)).toBe(false);
  });
});
