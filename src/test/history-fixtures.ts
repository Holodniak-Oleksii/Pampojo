import { randomUUID } from 'node:crypto';
import { and, inArray, isNull } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  exercise,
  profile,
  scheduleRule,
  setLog,
  user,
  workout,
  workoutExercise,
  workoutSession,
} from '@/server/db/schema';
import type { Tx } from '@/server/plan/queries';

/** Server test data for history and adherence: past rules and finished sessions written directly. */
export async function benchExerciseId(): Promise<string> {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(inArray(exercise.slug, ['barbell-bench-press']), isNull(exercise.ownerId)));
  if (!row) throw new Error('Run pnpm db:seed first');
  return row.id;
}

export async function newHistoryUser(tx: Tx, prefix: string, timeZone = 'UTC'): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `${prefix}-${randomUUID()}@example.com` })
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
    timeZone,
    onboardingCompletedAt: new Date(),
  });
  return row.id;
}

export async function newHistoryWorkout(
  tx: Tx,
  userId: string,
  exerciseId: string,
  name = 'Push Day',
): Promise<string> {
  const id = randomUUID();
  await tx.insert(workout).values({ id, ownerId: userId, name });
  await tx
    .insert(workoutExercise)
    .values({ id: randomUUID(), workoutId: id, exerciseId, position: 0 });
  return id;
}

/** A rule on the given ISO weekdays from `startDate`, or a one-off when `weekdays` is empty. */
export async function insertRule(
  tx: Tx,
  userId: string,
  workoutId: string,
  startDate: string,
  weekdays: number[] = [],
): Promise<string> {
  const id = randomUUID();
  await tx.insert(scheduleRule).values({
    id,
    userId,
    workoutId,
    startDate,
    endDate: weekdays.length === 0 ? startDate : null,
    weekdays,
    intervalWeeks: 1,
  });
  return id;
}

export async function insertCompletedSession(
  tx: Tx,
  {
    userId,
    workoutId,
    exerciseId,
    startedAt,
    scheduledFor = null,
    sets = 0,
    deletedSets = 0,
  }: {
    userId: string;
    workoutId: string;
    exerciseId: string;
    startedAt: Date;
    scheduledFor?: string | null;
    sets?: number;
    deletedSets?: number;
  },
): Promise<string> {
  const id = randomUUID();
  const entry = randomUUID();
  await tx.insert(workoutSession).values({
    id,
    userId,
    workoutId,
    scheduledFor,
    workoutSnapshot: { workoutId, name: 'Push Day', description: null, exercises: [] },
    exercises: [],
    status: 'completed',
    startedAt,
    finishedAt: new Date(startedAt.getTime() + 50 * 60_000),
  });
  for (let index = 0; index < sets + deletedSets; index += 1) {
    await tx.insert(setLog).values({
      id: randomUUID(),
      sessionId: id,
      sessionExerciseId: entry,
      exerciseId,
      setIndex: index,
      reps: 8,
      completedAt: startedAt,
      deletedAt: index >= sets ? new Date() : null,
    });
  }
  return id;
}
