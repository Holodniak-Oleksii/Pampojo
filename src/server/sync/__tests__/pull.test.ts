import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SYNC_PULL_PAGE_ROWS } from '@/constants/sync';
import { bodyMeasurement, workout, workoutExercise } from '@/server/db/schema';
import { DomainError } from '@/server/http/errors';
import type { PullResponse } from '@/shared/schemas/sync';
import { deleteUsersByEmail, testPrefix, withRollback } from '@/test/db';
import {
  benchExerciseId,
  insertCompletedSession,
  insertRule,
  newHistoryUser,
  newHistoryWorkout,
} from '@/test/history-fixtures';
import { pullChanges } from '../pull';

vi.setConfig({ testTimeout: 90_000 });

const PREFIX = testPrefix('sync-pull');
let bench: string;
let dumbbell: string;

beforeAll(async () => {
  bench = await benchExerciseId();
  const { getDb } = await import('@/server/db/client');
  const rows = await getDb().execute<{ id: string }>(
    sql`select id from exercise where owner_id is null and slug = 'dumbbell-bench-press' limit 1`,
  );
  dumbbell = rows[0]?.id ?? '';
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

type Tx = Parameters<typeof newHistoryUser>[0];

/** Walks every page of a run and returns the merged changes and the final cursor. */
async function pullAll(userId: string, since: string | undefined, tx: Tx) {
  const pages: PullResponse[] = [];
  let next: string | undefined = since;
  for (;;) {
    const page = await pullChanges(userId, next, tx);
    pages.push(page);
    if (!page.nextCursor) return { pages, cursor: page.cursor };
    next = page.nextCursor;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

describe('pullChanges', () => {
  it('sends totals and only live rows on a full download, and never rows of another user', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const other = await newHistoryUser(tx, PREFIX);
      const live = await newHistoryWorkout(tx, userId, bench, 'Live');
      const gone = await newHistoryWorkout(tx, userId, bench, 'Gone');
      await tx.update(workout).set({ deletedAt: new Date() }).where(eq(workout.id, gone));
      await newHistoryWorkout(tx, other, bench, 'Foreign');
      await insertRule(tx, userId, live, today(), [1, 3]);
      await insertCompletedSession(tx, {
        userId,
        workoutId: live,
        exerciseId: bench,
        startedAt: new Date(Date.now() - 2 * 86_400_000),
        sets: 2,
        deletedSets: 1,
      });
      await insertCompletedSession(tx, {
        userId,
        workoutId: live,
        exerciseId: bench,
        startedAt: new Date(Date.now() - 45 * 86_400_000),
        sets: 1,
      });

      const { pages, cursor } = await pullAll(userId, undefined, tx);
      const [page] = pages;
      expect(pages).toHaveLength(1);
      expect(cursor).not.toBeNull();
      expect(page?.totals).toEqual({
        workouts: 1,
        scheduleRules: 1,
        exercises: 1,
        lastPerformance: 1,
        sessions: 1,
        setLogs: 2,
        measurements: 0,
      });
      expect(page?.changes.profile?.displayName).toBe('Test');
      expect(page?.changes.gymChanged).toBe(true);
      expect(page?.changes.workouts.map((item) => item.name)).toEqual(['Live']);
      expect(page?.changes.workouts[0]?.exercises.map((item) => item.exerciseId)).toEqual([bench]);
      expect(page?.changes.exercises.map((item) => item.id)).toEqual([bench]);
      expect(page?.changes.exercises[0]?.translations.map((item) => item.locale).sort()).toEqual([
        'en',
        'uk',
      ]);
      expect(page?.changes.lastPerformance[0]?.item?.sets).toHaveLength(2);
      expect(page?.changes.sessions).toHaveLength(1);
    });
  });

  it('sends tombstones in an incremental pull', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const { cursor } = await pullAll(userId, undefined, tx);
      await tx
        .update(workout)
        .set({ deletedAt: new Date(), updatedAt: sql`now()` })
        .where(eq(workout.id, workoutId));
      const { pages } = await pullAll(userId, cursor ?? undefined, tx);
      const workouts = pages.flatMap((page) => page.changes.workouts);
      expect(workouts.map((item) => [item.id, item.deletedAt !== null])).toEqual([
        [workoutId, true],
      ]);
      expect(pages[0]?.totals).toBeUndefined();
    });
  });

  it('sends a row again inside the overlap and a late row before the cursor (AC16)', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const { cursor } = await pullAll(userId, undefined, tx);
      // In one transaction now() is constant, so the cursor high is the start time of `tx`.
      const [{ now } = { now: '' }] = await tx.execute<{ now: string }>(
        sql`select now()::text as now`,
      );
      const insert = (id: string, day: string, secondsBefore: number) =>
        tx.insert(bodyMeasurement).values({
          id,
          userId,
          type: 'weight',
          value: 80,
          measuredOn: day,
          updatedAt: sql`${now}::timestamptz - ${secondsBefore} * interval '1 second'`,
        });
      const late = randomUUID();
      const old = randomUUID();
      await insert(late, '2026-01-01', 10);
      await insert(old, '2026-01-02', 60);
      const first = await pullAll(userId, cursor ?? undefined, tx);
      const second = await pullAll(userId, first.cursor ?? undefined, tx);
      const ids = (result: typeof first) =>
        result.pages.flatMap((page) => page.changes.measurements.map((item) => item.id));
      expect(ids(first)).toEqual([late]);
      expect(ids(second)).toEqual([late]);
    });
  });

  it('sends an exercise that a changed workout starts to reference', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const { cursor } = await pullAll(userId, undefined, tx);
      await tx
        .insert(workoutExercise)
        .values({ id: randomUUID(), workoutId, exerciseId: dumbbell, position: 1 });
      // Writes in one transaction share now(), the same instant as the cursor.
      await tx
        .update(workout)
        .set({ updatedAt: sql`now()` })
        .where(eq(workout.id, workoutId));
      const { pages } = await pullAll(userId, cursor ?? undefined, tx);
      const exercises = pages.flatMap((page) => page.changes.exercises.map((item) => item.id));
      expect(exercises).toContain(dumbbell);
    });
  });

  it('walks pages of at most 500 rows with no gap and no repeat', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const types = ['neck', 'chest', 'waist', 'hips', 'shoulders'] as const;
      const rows = Array.from({ length: SYNC_PULL_PAGE_ROWS + 20 }, (_, index) => ({
        id: randomUUID(),
        userId,
        type: types[index % types.length] ?? 'neck',
        value: 40,
        measuredOn: new Date(Date.UTC(2024, 0, 1 + Math.floor(index / types.length)))
          .toISOString()
          .slice(0, 10),
      }));
      await tx.insert(bodyMeasurement).values(rows);
      const { pages } = await pullAll(userId, undefined, tx);
      expect(pages.length).toBeGreaterThan(1);
      const ids = pages.flatMap((page) => page.changes.measurements.map((item) => item.id));
      expect(ids).toHaveLength(rows.length);
      expect(new Set(ids).size).toBe(rows.length);
      for (const page of pages) {
        const count =
          page.changes.measurements.length +
          page.changes.workouts.length +
          (page.changes.profile ? 1 : 0) +
          (page.changes.gymChanged ? 1 : 0);
        expect(count).toBeLessThanOrEqual(SYNC_PULL_PAGE_ROWS);
      }
    });
  });

  it('runs the same number of queries for 2 and 20 workouts', async () => {
    await withRollback(async (tx) => {
      const count = async (workouts: number) => {
        const userId = await newHistoryUser(tx, PREFIX);
        for (let index = 0; index < workouts; index += 1) {
          await newHistoryWorkout(tx, userId, bench, `W${index}`);
        }
        const spy = vi.spyOn(tx, 'execute');
        await pullAll(userId, undefined, tx);
        const calls = spy.mock.calls.length;
        spy.mockRestore();
        return calls;
      };
      expect(await count(2)).toBe(await count(20));
    });
  });

  it('rejects a cursor it did not make', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      await expect(pullChanges(userId, 'not-a-cursor', tx)).rejects.toSatisfy(
        (error) => error instanceof DomainError && error.code === 'INVALID_CURSOR',
      );
    });
  });
});
