import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { exercise, profile, scheduleRule, user, workout } from '@/server/db/schema';
import { DomainError } from '@/server/http/errors';
import { putSession } from '@/server/sessions/service';
import { deleteWorkout, putWorkout } from '@/server/workouts/service';
import { addDays, expandOccurrences, isoWeekday } from '@/shared/plan/occurrences';
import {
  patchScheduleRuleInputSchema,
  putScheduleRuleInputSchema,
  type PutScheduleRuleInput,
} from '@/shared/schemas/plan';
import { putWorkoutInputSchema } from '@/shared/schemas/workout';
import { deleteUsersByEmail, withRollback } from '@/test/db';
import type { Tx } from '../queries';
import { deleteRule, listRules, patchRule, putRule } from '../service';

vi.setConfig({ testTimeout: 60_000 });

const ZONE = 'Europe/Kyiv';
let bench: string;

beforeAll(async () => {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(inArray(exercise.slug, ['barbell-bench-press']), isNull(exercise.ownerId)));
  if (!row) throw new Error('Run pnpm db:seed first');
  bench = row.id;
});

afterAll(async () => {
  await deleteUsersByEmail('test-plan-service-%@example.com');
});

const today = () => todayIn(ZONE);

async function newUser(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `test-plan-service-${randomUUID()}@example.com` })
    .returning({ id: user.id });
  if (!row) throw new Error('No user');
  await tx.insert(profile).values({
    userId: row.id,
    displayName: 'Test',
    avatarEmoji: 'fox',
    avatarColor: 1,
    sex: 'male',
    birthDate: '1990-05-15',
    heightCm: 180,
    timeZone: ZONE,
    onboardingCompletedAt: new Date(),
  });
  return row.id;
}

async function newWorkout(tx: Tx, userId: string, exercises = true): Promise<string> {
  const id = randomUUID();
  if (!exercises) {
    await tx.insert(workout).values({ id, ownerId: userId, name: 'Empty' });
    return id;
  }
  await putWorkout(
    userId,
    'en',
    id,
    putWorkoutInputSchema.parse({
      name: 'Push Day',
      exercises: [{ id: randomUUID(), exerciseId: bench }],
    }),
    tx,
  );
  return id;
}

function settings(workoutId: string, overrides: Partial<PutScheduleRuleInput> = {}) {
  return putScheduleRuleInputSchema.parse({
    workoutId,
    startDate: today(),
    weekdays: [1, 4],
    intervalWeeks: 1,
    endDate: null,
    ...overrides,
  });
}

async function code(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
}

/** A rule that started `daysAgo` days ago, written directly because the API refuses past starts. */
async function pastRule(tx: Tx, userId: string, workoutId: string, daysAgo: number) {
  const id = randomUUID();
  await tx.insert(scheduleRule).values({
    id,
    userId,
    workoutId,
    startDate: addDays(today(), -daysAgo),
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    intervalWeeks: 1,
  });
  return id;
}

describe('putRule', () => {
  it('creates once for the same id and lists the workout (AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const id = randomUUID();
      const first = await putRule(userId, id, settings(workoutId), tx);
      const again = await putRule(userId, id, settings(workoutId), tx);
      expect(first.created).toBe(true);
      expect(again.created).toBe(false);
      expect(again.items).toEqual(first.items);
      const { items } = await listRules(userId, tx);
      expect(items).toHaveLength(1);
      expect(items[0]?.workout).toMatchObject({
        name: 'Push Day',
        exerciseCount: 1,
        deleted: false,
      });
    });
  });

  it('stores the 5th occurrence for endAfter 5 (AC2)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const input = settings(workoutId, { endAfter: 5 });
      const { items } = await putRule(userId, randomUUID(), input, tx);
      const expected = expandOccurrences(
        { ...input, endDate: null },
        today(),
        addDays(today(), 60),
      )[4];
      expect(items[0]?.endDate).toBe(expected);
    });
  });

  it('rejects invalid rules with the documented codes (AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const empty = await newWorkout(tx, userId, false);
      const otherUser = await newUser(tx);
      const foreign = await newWorkout(tx, otherUser);
      const put = (input: ReturnType<typeof settings>) => putRule(userId, randomUUID(), input, tx);

      expect(await code(put(settings(workoutId, { startDate: addDays(today(), -1) })))).toBe(
        'VALIDATION_FAILED',
      );
      expect(await code(put(settings(workoutId, { endDate: addDays(today(), 2 * 366 + 1) })))).toBe(
        'VALIDATION_FAILED',
      );
      expect(await code(put(settings(empty)))).toBe('VALIDATION_FAILED');
      expect(await code(put(settings(foreign)))).toBe('VALIDATION_FAILED');

      // A weekly rule that ends before its only weekday has no dates.
      const noDates = settings(workoutId, {
        weekdays: [isoWeekday(addDays(today(), 1))],
        endDate: today(),
      });
      expect(await code(put(noDates))).toBe('VALIDATION_FAILED');

      await put(settings(workoutId));
      expect(await code(put(settings(workoutId, { weekdays: [4] })))).toBe('SCHEDULE_OVERLAP');
      // A different workout on the same days is allowed.
      const other = await newWorkout(tx, userId);
      await put(settings(other));
    });
  });

  it('stops at 100 active rules (AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      // One-offs on different days of the same workout never overlap.
      const values = Array.from({ length: 100 }, (_, i) => ({
        id: randomUUID(),
        userId,
        workoutId,
        startDate: addDays(today(), i),
        endDate: addDays(today(), i),
        weekdays: [] as number[],
        intervalWeeks: 1,
      }));
      await tx.insert(scheduleRule).values(values);
      const input = settings(workoutId, {
        weekdays: [],
        startDate: addDays(today(), 200),
        endDate: addDays(today(), 200),
      });
      expect(await code(putRule(userId, randomUUID(), input, tx))).toBe('SCHEDULE_LIMIT_REACHED');
    });
  });

  it('hides another user rule as not found', async () => {
    await withRollback(async (tx) => {
      const owner = await newUser(tx);
      const workoutId = await newWorkout(tx, owner);
      const id = randomUUID();
      await putRule(owner, id, settings(workoutId), tx);
      const intruder = await newUser(tx);
      const theirs = await newWorkout(tx, intruder);
      expect(await code(putRule(intruder, id, settings(theirs), tx))).toBe(
        'SCHEDULE_RULE_NOT_FOUND',
      );
      expect(await code(deleteRule(intruder, id, tx))).toBe('SCHEDULE_RULE_NOT_FOUND');
    });
  });
});

describe('patchRule', () => {
  it('splits a started rule once, keeping the past (AC5, AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const id = await pastRule(tx, userId, workoutId, 10);
      const newId = randomUUID();
      const input = patchScheduleRuleInputSchema.parse({
        ...settings(workoutId, { weekdays: [6] }),
        newId,
      });
      const first = await patchRule(userId, id, input, tx);
      const again = await patchRule(userId, id, input, tx);
      expect(first.items.map((rule) => rule.id)).toEqual([id, newId]);
      expect(first.items[0]).toMatchObject({
        startDate: addDays(today(), -10),
        endDate: addDays(today(), -1),
      });
      expect(first.items[1]).toMatchObject({ startDate: today(), weekdays: [6] });
      expect(again.items).toEqual(first.items);
      expect((await listRules(userId, tx)).items).toHaveLength(2);
      // The ended half is read-only now.
      const later = patchScheduleRuleInputSchema.parse({ ...input, newId: randomUUID() });
      expect(await code(patchRule(userId, id, later, tx))).toBe('VALIDATION_FAILED');
    });
  });

  it('edits a future rule in place (AC5)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const id = randomUUID();
      await putRule(userId, id, settings(workoutId, { startDate: addDays(today(), 3) }), tx);
      const { items } = await patchRule(
        userId,
        id,
        patchScheduleRuleInputSchema.parse({
          ...settings(workoutId, { startDate: addDays(today(), 5), intervalWeeks: 2 }),
          newId: randomUUID(),
        }),
        tx,
      );
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id, startDate: addDays(today(), 5), intervalWeeks: 2 });
    });
  });
});

describe('deleteRule', () => {
  it('ends a started rule yesterday and soft deletes a future one, repeat-safe (AC5)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const started = await pastRule(tx, userId, workoutId, 3);
      const future = randomUUID();
      const other = await newWorkout(tx, userId);
      await putRule(userId, future, settings(other, { startDate: addDays(today(), 2) }), tx);

      await deleteRule(userId, started, tx);
      await deleteRule(userId, started, tx);
      await deleteRule(userId, future, tx);
      await deleteRule(userId, future, tx);

      const { items } = await listRules(userId, tx);
      expect(items.map((rule) => rule.id)).toEqual([started]);
      expect(items[0]?.endDate).toBe(addDays(today(), -1));
    });
  });
});

describe('deleting a workout (AC8)', () => {
  it('ends its started rules and removes its future ones', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
      const started = await pastRule(tx, userId, workoutId, 5);
      const future = randomUUID();
      await tx.insert(scheduleRule).values({
        id: future,
        userId,
        workoutId,
        startDate: addDays(today(), 30),
        weekdays: [1],
        intervalWeeks: 1,
      });
      await deleteWorkout(userId, workoutId, tx);
      const rows = await tx
        .select()
        .from(scheduleRule)
        .where(eq(scheduleRule.workoutId, workoutId));
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(started)?.endDate).toBe(addDays(today(), -1));
      expect(byId.get(future)?.deletedAt).not.toBeNull();
      const { items } = await listRules(userId, tx);
      expect(items[0]?.workout.deleted).toBe(true);
      const [deleted] = await tx.select().from(workout).where(eq(workout.id, workoutId));
      expect(deleted?.deletedAt).not.toBeNull();
    });
  });
});

describe('putSession scheduledFor (AC4)', () => {
  it('must equal the start date in the profile zone, so a late replay still passes', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const workoutId = await newWorkout(tx, userId);
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
      const body = (startedAt: Date, scheduledFor: string | null) => ({
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
      const yesterdayStart = new Date(Date.now() - 26 * 3_600_000);
      const yesterday = todayIn(ZONE, yesterdayStart);
      const replay = await putSession(userId, randomUUID(), body(yesterdayStart, yesterday), tx);
      expect(replay.scheduledFor).toBe(yesterday);
      expect(await code(putSession(userId, randomUUID(), body(new Date(), yesterday), tx))).toBe(
        'VALIDATION_FAILED',
      );
    });
  });
});
