import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { DomainError } from '@/server/http/errors';
import { addDays } from '@/shared/plan/occurrences';
import { putSessionInputSchema } from '@/shared/schemas/session';
import { deleteUsersByEmail, withRollback, testPrefix } from '@/test/db';
import {
  benchExerciseId,
  insertCompletedSession,
  insertRule,
  newHistoryUser,
  newHistoryWorkout,
} from '@/test/history-fixtures';
import { listSessions, putSession } from '../service';

vi.setConfig({ testTimeout: 60_000 });

const PREFIX = testPrefix('session-history');
let bench: string;

beforeAll(async () => {
  bench = await benchExerciseId();
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

const today = () => todayIn('UTC');
const noonOf = (date: string) => new Date(`${date}T12:00:00Z`);

async function code(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
}

function sessionBody(workoutId: string, startedAt: Date, scheduledFor: string | null) {
  const entry = randomUUID();
  const info = {
    id: bench,
    name: 'Bench Press',
    trackingType: 'weight_reps' as const,
    laterality: 'bilateral' as const,
    thumbnailUrl: null,
  };
  const targets = {
    targetSets: 3,
    targetRepsMin: null,
    targetRepsMax: null,
    targetWeightKg: null,
    targetDurationSec: null,
    targetDistanceM: null,
    notes: null,
  };
  return putSessionInputSchema.parse({
    workoutId,
    workoutSnapshot: {
      workoutId,
      name: 'Push Day',
      description: null,
      exercises: [{ id: entry, exerciseId: bench, ...targets, exercise: info }],
    },
    exercises: [{ id: entry, exerciseId: bench, plannedSets: 3, ...targets, exercise: info }],
    startedAt: startedAt.toISOString(),
    scheduledFor,
  });
}

describe('listSessions pages (AC5)', () => {
  it('pages by cursor with no overlap or gap, newest first', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const base = Date.now() - 50 * 86_400_000;
      // Two sessions share a start time, so the id breaks the tie.
      const starts = Array.from(
        { length: 45 },
        (_, i) => new Date(base + Math.floor(i / 2) * 86_400_000),
      );
      for (const startedAt of starts) {
        await insertCompletedSession(tx, { userId, workoutId, exerciseId: bench, startedAt });
      }
      const first = await listSessions(userId, { status: 'completed', limit: 20 }, tx);
      expect(first.items).toHaveLength(20);
      expect(first.nextCursor).not.toBeNull();
      const second = await listSessions(
        userId,
        { status: 'completed', limit: 20, cursor: first.nextCursor ?? undefined },
        tx,
      );
      const third = await listSessions(
        userId,
        { status: 'completed', limit: 20, cursor: second.nextCursor ?? undefined },
        tx,
      );
      expect(second.items).toHaveLength(20);
      expect(third.items).toHaveLength(5);
      expect(third.nextCursor).toBeNull();
      const all = [...first.items, ...second.items, ...third.items];
      expect(new Set(all.map((item) => item.id)).size).toBe(45);
      const times = all.map((item) => item.startedAt);
      expect([...times].sort().reverse()).toEqual(times);
    });
  });

  it('rejects a cursor it did not make', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      expect(await code(listSessions(userId, { cursor: 'not-a-cursor' }, tx))).toBe(
        'VALIDATION_FAILED',
      );
    });
  });

  it('counts only live sets, and keeps the old list shape without paging', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      await insertCompletedSession(tx, {
        userId,
        workoutId,
        exerciseId: bench,
        startedAt: new Date(Date.now() - 3_600_000),
        sets: 3,
        deletedSets: 2,
      });
      const list = await listSessions(userId, {}, tx);
      expect(list.items[0]?.setCount).toBe(3);
      expect(list.nextCursor).toBeNull();
    });
  });

  it('never lists another user’s sessions', async () => {
    await withRollback(async (tx) => {
      const owner = await newHistoryUser(tx, PREFIX);
      const other = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, owner, bench);
      await insertCompletedSession(tx, {
        userId: owner,
        workoutId,
        exerciseId: bench,
        startedAt: new Date(Date.now() - 3_600_000),
      });
      expect((await listSessions(other, { limit: 20 }, tx)).items).toHaveLength(0);
    });
  });
});

describe('putSession make-up dates (AC8)', () => {
  it('accepts the start date and a missed date in its window', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const missed = addDays(today(), -3);
      await insertRule(tx, userId, workoutId, missed);
      const now = new Date();
      const onTime = await putSession(
        userId,
        randomUUID(),
        sessionBody(workoutId, now, today()),
        tx,
      );
      expect(onTime.scheduledFor).toBe(today());
      const late = await putSession(userId, randomUUID(), sessionBody(workoutId, now, missed), tx);
      expect(late.scheduledFor).toBe(missed);
    });
  });

  it('rejects a date with no occurrence, a date after the window and a future date', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const tooOld = addDays(today(), -8);
      await insertRule(tx, userId, workoutId, tooOld);
      const now = new Date();
      for (const date of [addDays(today(), -2), tooOld, addDays(today(), 1)]) {
        expect(
          await code(putSession(userId, randomUUID(), sessionBody(workoutId, now, date), tx)),
        ).toBe('VALIDATION_FAILED');
      }
    });
  });

  it('closes the window before the next occurrence of the same workout', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const missed = addDays(today(), -3);
      await insertRule(tx, userId, workoutId, missed);
      await insertRule(tx, userId, workoutId, addDays(today(), -1));
      expect(
        await code(
          putSession(userId, randomUUID(), sessionBody(workoutId, new Date(), missed), tx),
        ),
      ).toBe('VALIDATION_FAILED');
    });
  });

  it('passes a late outbox replay whose start was in the window', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      // Missed 9 days ago, made up 3 days later; the replay arrives today, after the window.
      const missed = addDays(today(), -9);
      await insertRule(tx, userId, workoutId, missed);
      const startedAt = noonOf(addDays(missed, 3));
      const replay = await putSession(
        userId,
        randomUUID(),
        sessionBody(workoutId, startedAt, missed),
        tx,
      );
      expect(replay.scheduledFor).toBe(missed);
    });
  });
});
