import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import * as schema from '@/server/db/schema';
import { getEnv } from '@/server/env';
import type { Tx } from '@/server/plan/queries';
import { addDays } from '@/shared/plan/occurrences';
import { estimateOneRepMax } from '@/shared/progress/metrics';
import { deleteUsersByEmail, withRollback, testPrefix } from '@/test/db';
import { newHistoryUser, newHistoryWorkout } from '@/test/history-fixtures';
import { insertSessionWithSets, systemExerciseId } from '@/test/progress-fixtures';
import { findBests, getExerciseProgress, listProgressExercises } from '../service';

vi.setConfig({ testTimeout: 60_000 });

const PREFIX = testPrefix('progress-service');
const KYIV = 'Europe/Kyiv';
let bench: string;
let squat: string;
let plank: string;

beforeAll(async () => {
  [bench, squat, plank] = await Promise.all([
    systemExerciseId('barbell-bench-press'),
    systemExerciseId('barbell-back-squat'),
    systemExerciseId('plank'),
  ]);
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

const today = () => todayIn(KYIV);
const noonOf = (date: string) => new Date(`${date}T10:00:00Z`);

describe('getExerciseProgress', () => {
  it('gives one point per completed session and all-time records (AC1, AC2, AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX, KYIV);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const oldDay = addDays(today(), -200);
      const a = await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: noonOf(oldDay),
        sets: [{ exerciseId: bench, weightKg: 95, reps: 1 }],
      });
      const b = await insertSessionWithSets(tx, {
        userId,
        workoutId,
        // 23:30 UTC is the next day in Kyiv.
        startedAt: new Date(`${addDays(today(), -10)}T23:30:00Z`),
        sets: [
          { exerciseId: bench, weightKg: 80, reps: 8 },
          { exerciseId: bench, weightKg: 87.5, reps: 5 },
          { exerciseId: bench, weightKg: 120, reps: 1, deleted: true },
        ],
      });
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: noonOf(addDays(today(), -5)),
        status: 'abandoned',
        sets: [{ exerciseId: bench, weightKg: 150, reps: 1 }],
      });
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: noonOf(today()),
        status: 'in_progress',
        sets: [{ exerciseId: bench, weightKg: 140, reps: 1 }],
      });

      const recent = await getExerciseProgress(userId, 'en', bench, '3m', tx as unknown as Tx);
      expect(recent.trackingType).toBe('weight_reps');
      expect(recent.points).toEqual([
        {
          sessionId: b,
          date: addDays(today(), -9),
          topWeightKg: 87.5,
          e1rmKg: estimateOneRepMax(87.5, 5),
          volumeKg: 80 * 8 + 87.5 * 5,
          reps: 8,
          durationSec: null,
          distanceM: null,
        },
      ]);
      expect(recent.records.map((record) => [record.type, record.value, record.sessionId])).toEqual(
        [
          ['heaviest_weight', 95, a],
          ['best_e1rm', estimateOneRepMax(87.5, 5), b],
          ['most_reps', 8, b],
          ['best_volume', 80 * 8 + 87.5 * 5, b],
        ],
      );
      expect(recent.records[0]?.date).toBe(oldDay);

      const all = await getExerciseProgress(userId, 'en', bench, 'all', tx as unknown as Tx);
      expect(all.points.map((point) => point.sessionId)).toEqual([a, b]);

      expect(await findBests(tx as unknown as Tx, userId, bench)).toMatchObject({
        heaviestWeightKg: 95,
        mostReps: { reps: 8, weightKg: 80 },
      });
    });
  });

  it('gives empty lists without history and 404 for an unknown exercise', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX, KYIV);
      expect(await getExerciseProgress(userId, 'en', plank, 'all', tx as unknown as Tx)).toEqual({
        trackingType: 'time',
        points: [],
        records: [],
      });
      expect(await findBests(tx as unknown as Tx, userId, plank)).toBeNull();
      await expect(
        getExerciseProgress(userId, 'en', crypto.randomUUID(), '3m', tx as unknown as Tx),
      ).rejects.toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
    });
  });
});

describe('listProgressExercises', () => {
  it('lists trained exercises, newest first, and counts this month (AC5, AC10)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX, KYIV);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const monthStart = `${today().slice(0, 8)}01`;
      // 00:30 on the first of the month in Kyiv is still the previous month in UTC.
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: new Date(new Date(`${monthStart}T00:30:00Z`).getTime() - 2 * 3_600_000),
        sets: [
          { exerciseId: bench, weightKg: 80, reps: 10 },
          { exerciseId: plank, durationSec: 60 },
        ],
      });
      // The last evening of the previous month in Kyiv.
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: new Date(new Date(`${monthStart}T00:00:00Z`).getTime() - 4 * 3_600_000),
        sets: [{ exerciseId: squat, weightKg: 100, reps: 5 }],
      });
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: noonOf(today()),
        status: 'abandoned',
        sets: [{ exerciseId: bench, weightKg: 200, reps: 10 }],
      });
      await insertSessionWithSets(tx, {
        userId,
        workoutId,
        startedAt: noonOf(addDays(today(), -40)),
        sets: [{ exerciseId: plank, durationSec: 45, deleted: true }],
      });

      const response = await listProgressExercises(userId, 'uk', tx as unknown as Tx);
      const ids = response.items.map((item) => item.exerciseId);
      // Bench and plank share the latest session; squat was trained before it.
      expect(new Set(ids.slice(0, 2))).toEqual(new Set([bench, plank]));
      expect(ids[2]).toBe(squat);
      expect(ids).toHaveLength(3);
      expect(response.items.find((item) => item.exerciseId === bench)).toMatchObject({
        name: 'Жим штанги лежачи',
        trackingType: 'weight_reps',
      });
      expect(response.month).toEqual({ workouts: 1, volumeKg: 800 });
    });
  });

  it('runs a constant number of queries', async () => {
    const db = getDb() as unknown as Tx;
    const userId = await newHistoryUser(db, PREFIX, KYIV);
    const workoutId = await newHistoryWorkout(db, userId, bench);
    const empty = await newHistoryUser(db, PREFIX, KYIV);
    for (const exerciseId of [bench, squat, plank]) {
      await insertSessionWithSets(db, {
        userId,
        workoutId,
        startedAt: noonOf(addDays(today(), -3)),
        sets: [{ exerciseId, weightKg: 50, reps: 5, durationSec: 30 }],
      });
    }
    let queries = 0;
    const client = postgres(getEnv().DATABASE_URL, { prepare: false, max: 1 });
    const counting = drizzle(client, { schema, logger: { logQuery: () => (queries += 1) } });
    try {
      await listProgressExercises(empty, 'en', counting);
      const forEmpty = queries;
      queries = 0;
      const full = await listProgressExercises(userId, 'en', counting);
      expect(full.items).toHaveLength(3);
      expect(queries).toBe(forEmpty);
      expect(queries).toBe(3);
    } finally {
      await client.end();
    }
  });
});
