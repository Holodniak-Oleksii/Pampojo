import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exercise, setLog, user, workoutSession } from '@/server/db/schema';
import { getDb } from '@/server/db/client';
import { deleteOwnExercise } from '@/server/exercises/write-service';
import { DomainError } from '@/server/http/errors';
import { putWorkout } from '@/server/workouts/service';
import {
  putSessionInputSchema,
  putSetInputSchema,
  type PutSessionInput,
  type PutSetInput,
} from '@/shared/schemas/session';
import { putWorkoutInputSchema } from '@/shared/schemas/workout';
import { deleteUsersByEmail, withRollback, testPrefix } from '@/test/db';
import type { Tx } from '../queries';
import {
  deleteSet,
  getLastPerformance,
  getSession,
  listSessions,
  patchSession,
  patchSet,
  putSession,
  putSet,
} from '../service';

const PREFIX = testPrefix('sessions-service');

vi.mock('@/server/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage')>()),
  removeObjects: vi.fn(async () => {}),
  isStorageConfigured: () => false,
}));
vi.setConfig({ testTimeout: 60_000 });

const slugs = ['barbell-bench-press', 'plank'];
const ex: Record<string, string> = {};

beforeAll(async () => {
  const rows = await getDb()
    .select({ id: exercise.id, slug: exercise.slug })
    .from(exercise)
    .where(and(inArray(exercise.slug, slugs), isNull(exercise.ownerId)));
  for (const row of rows) if (row.slug) ex[row.slug] = row.id;
  if (Object.keys(ex).length !== slugs.length) throw new Error('Run pnpm db:seed first');
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

async function newUser(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `${PREFIX}-${randomUUID()}@example.com` })
    .returning({ id: user.id });
  if (!row) throw new Error('No user');
  return row.id;
}

interface Entry {
  id: string;
  exerciseId: string;
  trackingType: 'weight_reps' | 'time' | 'reps';
}

async function newWorkout(tx: Tx, userId: string, items: Omit<Entry, 'id'>[]) {
  const workoutId = randomUUID();
  await putWorkout(
    userId,
    'en',
    workoutId,
    putWorkoutInputSchema.parse({
      name: 'Push Day',
      exercises: items.map((item) => ({ id: randomUUID(), exerciseId: item.exerciseId })),
    }),
    tx,
  );
  const entries: Entry[] = items.map((item) => ({ ...item, id: randomUUID() }));
  const info = (entry: Entry) => ({
    id: entry.exerciseId,
    name: 'Exercise',
    trackingType: entry.trackingType,
    laterality: null,
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
  const input: PutSessionInput = putSessionInputSchema.parse({
    workoutId,
    workoutSnapshot: {
      workoutId,
      name: 'Push Day',
      description: null,
      exercises: entries.map((entry) => ({
        id: entry.id,
        exerciseId: entry.exerciseId,
        ...targets,
        exercise: info(entry),
      })),
    },
    exercises: entries.map((entry) => ({
      id: entry.id,
      exerciseId: entry.exerciseId,
      plannedSets: 3,
      ...targets,
      exercise: info(entry),
    })),
    startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  return { workoutId, entries, input };
}

const setInput = (
  sessionId: string,
  entry: Entry,
  override: Partial<PutSetInput> = {},
): PutSetInput =>
  putSetInputSchema.parse({
    sessionId,
    sessionExerciseId: entry.id,
    exerciseId: entry.exerciseId,
    setIndex: 0,
    weightKg: entry.trackingType === 'weight_reps' ? 80 : null,
    reps: entry.trackingType === 'time' ? null : 8,
    durationSec: entry.trackingType === 'time' ? 45 : null,
    distanceM: null,
    completedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    ...override,
  });

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
}

async function bench(tx: Tx) {
  const userId = await newUser(tx);
  const { workoutId, entries, input } = await newWorkout(tx, userId, [
    { exerciseId: ex['barbell-bench-press']!, trackingType: 'weight_reps' },
    { exerciseId: ex['plank']!, trackingType: 'time' },
  ]);
  const sessionId = randomUUID();
  await putSession(userId, sessionId, input, tx);
  return { userId, workoutId, entries, input, sessionId, press: entries[0]!, plank: entries[1]! };
}

describe('putSession', () => {
  it('stores the snapshot and a later workout edit leaves it (AC1); a repeat is one row (AC6)', async () => {
    await withRollback(async (tx) => {
      const { userId, workoutId, input, sessionId } = await bench(tx);
      await putWorkout(
        userId,
        'en',
        workoutId,
        putWorkoutInputSchema.parse({
          name: 'Renamed',
          exercises: [{ id: randomUUID(), exerciseId: ex['plank']! }],
        }),
        tx,
      );
      const again = await putSession(userId, sessionId, input, tx);
      expect(again.workoutSnapshot.name).toBe('Push Day');
      expect(again.exercises).toHaveLength(2);
      expect(again.status).toBe('in_progress');
      const rows = await tx.select().from(workoutSession).where(eq(workoutSession.id, sessionId));
      expect(rows).toHaveLength(1);
    });
  });

  it('reports another user id as not found and rejects a foreign workout (AC13)', async () => {
    await withRollback(async (tx) => {
      const { input, sessionId } = await bench(tx);
      const other = await newUser(tx);
      expect(await codeOf(putSession(other, sessionId, input, tx))).toBe('SESSION_NOT_FOUND');
      expect(await codeOf(getSession(other, sessionId, tx))).toBe('SESSION_NOT_FOUND');
      expect(await codeOf(putSession(other, randomUUID(), input, tx))).toBe('VALIDATION_FAILED');
    });
  });
});

describe('sets', () => {
  it('PUT twice is one row and DELETE twice one soft-deleted row (AC6)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, press } = await bench(tx);
      const id = randomUUID();
      await putSet(userId, id, setInput(sessionId, press), tx);
      await putSet(userId, id, setInput(sessionId, press), tx);
      expect(await tx.select().from(setLog).where(eq(setLog.sessionId, sessionId))).toHaveLength(1);
      await deleteSet(userId, id, tx);
      await deleteSet(userId, id, tx);
      const [row] = await tx.select().from(setLog).where(eq(setLog.id, id));
      expect(row?.deletedAt).not.toBeNull();
      // Logging the row again revives the same id.
      await putSet(userId, id, setInput(sessionId, press, { reps: 9 }), tx);
      const session = await getSession(userId, sessionId, tx);
      expect(session.setLogs).toEqual([expect.objectContaining({ id, reps: 9, weightKg: 80 })]);
    });
  });

  it('validates values per tracking type, allowing an empty weight (AC11, AC12)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, press, plank } = await bench(tx);
      expect(
        await codeOf(putSet(userId, randomUUID(), setInput(sessionId, press, { reps: null }), tx)),
      ).toBe('VALIDATION_FAILED');
      expect(
        await codeOf(
          putSet(userId, randomUUID(), setInput(sessionId, plank, { weightKg: 20 }), tx),
        ),
      ).toBe('VALIDATION_FAILED');
      const id = randomUUID();
      await putSet(userId, id, setInput(sessionId, press, { weightKg: null }), tx);
      expect(await codeOf(patchSet(userId, id, { reps: null }, tx))).toBe('VALIDATION_FAILED');
      const patched = await patchSet(userId, id, { weightKg: 82.5 }, tx);
      expect(patched).toMatchObject({ weightKg: 82.5, reps: 8 });
    });
  });

  it('rejects foreign sets and writes on a finished session (AC13)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, press } = await bench(tx);
      const id = randomUUID();
      await putSet(userId, id, setInput(sessionId, press), tx);
      const other = await newUser(tx);
      expect(await codeOf(patchSet(other, id, { reps: 5 }, tx))).toBe('SESSION_NOT_FOUND');
      expect(await codeOf(deleteSet(other, id, tx))).toBe('SESSION_NOT_FOUND');
      expect(await codeOf(putSet(other, id, setInput(sessionId, press), tx))).toBe(
        'SESSION_NOT_FOUND',
      );
      await patchSession(
        userId,
        sessionId,
        { status: 'completed', finishedAt: new Date().toISOString() },
        tx,
      );
      expect(await codeOf(putSet(userId, randomUUID(), setInput(sessionId, press), tx))).toBe(
        'SESSION_NOT_IN_PROGRESS',
      );
      expect(await codeOf(deleteSet(userId, id, tx))).toBe('SESSION_NOT_IN_PROGRESS');
      expect(await codeOf(patchSession(userId, sessionId, { notes: 'late' }, tx))).toBe(
        'SESSION_NOT_IN_PROGRESS',
      );
    });
  });
});

describe('patchSession', () => {
  it('completes once with finishedAt; a repeat is a no-op (AC8)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId } = await bench(tx);
      const finishedAt = new Date().toISOString();
      const done = await patchSession(userId, sessionId, { status: 'completed', finishedAt }, tx);
      expect(done.status).toBe('completed');
      expect(done.finishedAt).toBe(finishedAt);
      const again = await patchSession(
        userId,
        sessionId,
        { status: 'completed', finishedAt: new Date().toISOString() },
        tx,
      );
      expect(again.finishedAt).toBe(finishedAt);
      expect(await codeOf(patchSession(userId, sessionId, { status: 'abandoned' }, tx))).toBe(
        'SESSION_NOT_IN_PROGRESS',
      );
    });
  });

  it('rejects a finish before the start and an unknown added exercise (AC12)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, input } = await bench(tx);
      expect(
        await codeOf(
          patchSession(
            userId,
            sessionId,
            { status: 'completed', finishedAt: '2020-01-01T00:00:00Z' },
            tx,
          ),
        ),
      ).toBe('VALIDATION_FAILED');
      const unknown = randomUUID();
      const added = {
        ...input.exercises[0]!,
        id: randomUUID(),
        exerciseId: unknown,
        exercise: { ...input.exercises[0]!.exercise, id: unknown },
      };
      expect(
        await codeOf(
          patchSession(userId, sessionId, { exercises: [...input.exercises, added] }, tx),
        ),
      ).toBe('VALIDATION_FAILED');
      const reordered = [...input.exercises].reverse();
      const patched = await patchSession(userId, sessionId, { exercises: reordered }, tx);
      expect(patched.exercises.map((item) => item.id)).toEqual(reordered.map((item) => item.id));
    });
  });

  it('keeps entries with logged sets and their exercise (AC12)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, input, press, plank } = await bench(tx);
      await putSet(userId, randomUUID(), setInput(sessionId, press), tx);
      const withoutPress = input.exercises.filter((item) => item.id !== press.id);
      expect(await codeOf(patchSession(userId, sessionId, { exercises: withoutPress }, tx))).toBe(
        'VALIDATION_FAILED',
      );
      const retyped = input.exercises.map((item) =>
        item.id === press.id
          ? { ...item, exercise: { ...item.exercise, trackingType: 'reps' as const } }
          : item,
      );
      expect(await codeOf(patchSession(userId, sessionId, { exercises: retyped }, tx))).toBe(
        'VALIDATION_FAILED',
      );
      const withoutPlank = input.exercises.filter((item) => item.id !== plank.id);
      const patched = await patchSession(userId, sessionId, { exercises: withoutPlank }, tx);
      expect(patched.exercises.map((item) => item.id)).toEqual([press.id]);
    });
  });

  it('abandon soft deletes the sets and hides the session (AC9)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, press } = await bench(tx);
      await putSet(userId, randomUUID(), setInput(sessionId, press), tx);
      await patchSession(userId, sessionId, { status: 'abandoned' }, tx);
      const live = await tx
        .select()
        .from(setLog)
        .where(and(eq(setLog.sessionId, sessionId), isNull(setLog.deletedAt)));
      expect(live).toHaveLength(0);
      expect(await codeOf(getSession(userId, sessionId, tx))).toBe('SESSION_NOT_FOUND');
      expect((await listSessions(userId, {}, tx)).items).toHaveLength(0);
      expect((await getLastPerformance(userId, press.exerciseId, tx)).item).toBeNull();
    });
  });
});

describe('listSessions and getLastPerformance', () => {
  it('filters by status and exercise and returns the latest completed sets (AC4, AC15)', async () => {
    await withRollback(async (tx) => {
      const { userId, sessionId, press, plank, input } = await bench(tx);
      await putSet(userId, randomUUID(), setInput(sessionId, press), tx);
      await putSet(
        userId,
        randomUUID(),
        setInput(sessionId, press, { setIndex: 1, weightKg: 82.5 }),
        tx,
      );
      const deleted = randomUUID();
      await putSet(userId, deleted, setInput(sessionId, press, { setIndex: 2, weightKg: 100 }), tx);
      await deleteSet(userId, deleted, tx);
      expect((await listSessions(userId, { status: 'in_progress' }, tx)).items).toHaveLength(1);
      await patchSession(
        userId,
        sessionId,
        { status: 'completed', finishedAt: new Date().toISOString() },
        tx,
      );

      const other = randomUUID();
      await putSession(userId, other, { ...input, startedAt: new Date().toISOString() }, tx);
      const completed = await listSessions(
        userId,
        { status: 'completed', exerciseId: press.exerciseId },
        tx,
      );
      expect(completed.items.map((item) => item.id)).toEqual([sessionId]);
      expect(completed.items[0]?.workoutName).toBe('Push Day');
      expect(
        (await listSessions(userId, { status: 'completed', exerciseId: plank.exerciseId }, tx))
          .items,
      ).toHaveLength(0);

      const last = await getLastPerformance(userId, press.exerciseId, tx);
      expect(last.item?.sessionId).toBe(sessionId);
      expect(last.item?.sets.map((item) => [item.setIndex, item.weightKg, item.reps])).toEqual([
        [0, 80, 8],
        [1, 82.5, 8],
      ]);
      expect((await getLastPerformance(userId, plank.exerciseId, tx)).item).toBeNull();
      const stranger = await newUser(tx);
      expect((await getLastPerformance(stranger, press.exerciseId, tx)).item).toBeNull();
    });
  });
});

describe('deleting an own exercise', () => {
  it('removes its sets and drops it from sessions in progress (AC15)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const [own] = await tx
        .insert(exercise)
        .values({
          ownerId: userId,
          primaryMuscles: ['chest'],
          equipment: ['band'],
          trackingType: 'reps',
        })
        .returning({ id: exercise.id });
      const { input, entries } = await newWorkout(tx, userId, [
        { exerciseId: own!.id, trackingType: 'reps' },
        { exerciseId: ex['plank']!, trackingType: 'time' },
      ]);
      const done = randomUUID();
      await putSession(userId, done, input, tx);
      await putSet(userId, randomUUID(), setInput(done, entries[0]!), tx);
      await patchSession(
        userId,
        done,
        { status: 'completed', finishedAt: new Date().toISOString() },
        tx,
      );
      const running = randomUUID();
      await putSession(userId, running, input, tx);

      await deleteOwnExercise(userId, own!.id, tx);

      expect((await getSession(userId, done, tx)).setLogs).toHaveLength(0);
      const plan = (await getSession(userId, running, tx)).exercises;
      expect(plan.map((item) => item.exerciseId)).toEqual([ex['plank']]);
    });
  });
});
