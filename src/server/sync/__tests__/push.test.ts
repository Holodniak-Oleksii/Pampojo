import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bodyMeasurement, setLog, syncMutation, workoutSession } from '@/server/db/schema';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import type { SyncMutation } from '@/shared/schemas/sync';
import { deleteUsersByEmail, testPrefix, withRollback } from '@/test/db';
import { benchExerciseId, newHistoryUser, newHistoryWorkout } from '@/test/history-fixtures';
import { applyPush, MUTATION_HANDLERS } from '../push';

vi.setConfig({ testTimeout: 60_000 });

const PREFIX = testPrefix('sync-push');
let bench: string;

beforeAll(async () => {
  bench = await benchExerciseId();
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

const info = () => ({
  id: bench,
  name: 'Bench Press',
  trackingType: 'weight_reps' as const,
  laterality: 'bilateral' as const,
  thumbnailUrl: null,
});

const targets = {
  targetSets: 3,
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeightKg: null,
  targetDurationSec: null,
  targetDistanceM: null,
  notes: null,
};

function mutation(type: SyncMutation['type'], entityId: string, payload?: unknown): SyncMutation {
  return { id: randomUUID(), type, entityId, payload, createdAt: new Date().toISOString() };
}

function sessionMutations(workoutId: string) {
  const sessionId = randomUUID();
  const entry = randomUUID();
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  const start = mutation(SYNC_MUTATION_TYPE.SESSION_PUT, sessionId, {
    workoutId,
    workoutSnapshot: {
      workoutId,
      name: 'Push Day',
      description: null,
      exercises: [{ id: entry, exerciseId: bench, ...targets, exercise: info() }],
    },
    exercises: [{ id: entry, exerciseId: bench, plannedSets: 3, ...targets, exercise: info() }],
    startedAt,
    scheduledFor: null,
  });
  const set = (setIndex: number, reps: number | string) =>
    mutation(SYNC_MUTATION_TYPE.SET_PUT, randomUUID(), {
      sessionId,
      sessionExerciseId: entry,
      exerciseId: bench,
      setIndex,
      weightKg: 60,
      reps,
      durationSec: null,
      distanceM: null,
      completedAt: startedAt,
    });
  return { sessionId, start, set };
}

describe('applyPush', () => {
  it('applies a batch and acknowledges a replay as duplicate with one row per entity (AC3)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const { sessionId, start, set } = sessionMutations(workoutId);
      const batch = [start, set(0, 8), set(1, 8)];

      const first = await applyPush(userId, batch, tx);
      expect(first.map((item) => item.status)).toEqual(['applied', 'applied', 'applied']);
      const second = await applyPush(userId, batch, tx);
      expect(second.map((item) => item.status)).toEqual(['duplicate', 'duplicate', 'duplicate']);

      const sessions = await tx
        .select()
        .from(workoutSession)
        .where(eq(workoutSession.id, sessionId));
      const sets = await tx.select().from(setLog).where(eq(setLog.sessionId, sessionId));
      expect(sessions).toHaveLength(1);
      expect(sets).toHaveLength(2);
    });
  });

  it('rejects one invalid mutation and applies the others (AC8)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const { sessionId, start, set } = sessionMutations(workoutId);
      const bad = set(1, 'eight');

      const results = await applyPush(userId, [start, bad, set(2, 5)], tx);
      expect(results.map((item) => item.status)).toEqual(['applied', 'rejected', 'applied']);
      expect(results[1]?.error).toBe('VALIDATION_FAILED');
      const sets = await tx.select().from(setLog).where(eq(setLog.sessionId, sessionId));
      expect(sets.map((row) => row.setIndex)).toEqual([2]);
      // A rejected id is not recorded, so a replay gets the same answer.
      const recorded = await tx.select().from(syncMutation).where(eq(syncMutation.id, bad.id));
      expect(recorded).toHaveLength(0);
    });
  });

  it('rejects a domain error with its code', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const results = await applyPush(
        userId,
        [mutation(SYNC_MUTATION_TYPE.SET_DELETE, randomUUID())],
        tx,
      );
      expect(results[0]).toMatchObject({ status: 'rejected', error: 'SESSION_NOT_FOUND' });
    });
  });

  it('rolls back the whole batch on an unexpected error (AC9)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const { sessionId, start, set } = sessionMutations(workoutId);
      const original = MUTATION_HANDLERS[SYNC_MUTATION_TYPE.SET_PATCH].apply;
      MUTATION_HANDLERS[SYNC_MUTATION_TYPE.SET_PATCH].apply = () =>
        Promise.reject(new Error('boom'));
      try {
        const broken = mutation(SYNC_MUTATION_TYPE.SET_PATCH, randomUUID(), { reps: 5 });
        await expect(applyPush(userId, [start, set(0, 8), broken], tx)).rejects.toThrow('boom');
      } finally {
        MUTATION_HANDLERS[SYNC_MUTATION_TYPE.SET_PATCH].apply = original;
      }
      const sessions = await tx
        .select()
        .from(workoutSession)
        .where(eq(workoutSession.id, sessionId));
      const recorded = await tx.select().from(syncMutation).where(eq(syncMutation.userId, userId));
      expect(sessions).toHaveLength(0);
      expect(recorded).toHaveLength(0);
    });
  });

  it("rejects a mutation id that another user's mutation holds", async () => {
    await withRollback(async (tx) => {
      const owner = await newHistoryUser(tx, PREFIX);
      const other = await newHistoryUser(tx, PREFIX);
      const today = new Date().toISOString().slice(0, 10);
      const first = mutation(SYNC_MUTATION_TYPE.MEASUREMENT_PUT, randomUUID(), {
        type: 'weight',
        value: 80,
        measuredOn: today,
      });
      await applyPush(owner, [first], tx);
      const replayed = { ...first, entityId: randomUUID() };
      const [result] = await applyPush(other, [replayed], tx);
      expect(result).toMatchObject({ status: 'rejected', error: 'CONFLICT' });
    });
  });

  it('merges measurement.put into the row of that day, as the REST endpoint does', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const today = new Date().toISOString().slice(0, 10);
      const put = (value: number) =>
        mutation(SYNC_MUTATION_TYPE.MEASUREMENT_PUT, randomUUID(), {
          type: 'weight',
          value,
          measuredOn: today,
        });
      await applyPush(userId, [put(80), put(81)], tx);
      const live = await tx
        .select()
        .from(bodyMeasurement)
        .where(and(eq(bodyMeasurement.userId, userId), isNull(bodyMeasurement.deletedAt)));
      expect(live.map((row) => row.value)).toEqual([81]);
    });
  });
});
