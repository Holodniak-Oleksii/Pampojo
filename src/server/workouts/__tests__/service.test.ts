import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { exercise, user, workout } from '@/server/db/schema';
import { getDb } from '@/server/db/client';
import { getEnv } from '@/server/env';
import { deleteOwnExercise } from '@/server/exercises/write-service';
import { putWorkoutInputSchema } from '@/shared/schemas/workout';
import { deleteUsersByEmail, withRollback } from '@/test/db';
import type { Tx } from '../queries';
import { getWorkout, hasWorkouts, listWorkouts, putWorkout } from '../service';

vi.mock('@/server/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage')>()),
  removeObjects: vi.fn(async () => {}),
  isStorageConfigured: () => false,
}));
vi.setConfig({ testTimeout: 60_000 });

const slugs = [
  'barbell-bench-press',
  'lateral-raise',
  'triceps-pushdown',
  'plank',
  'barbell-back-squat',
];
const ex: Record<string, string> = {};

async function newUser(tx: Tx | ReturnType<typeof getDb>): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `test-workouts-service-${randomUUID()}@example.com` })
    .returning({ id: user.id });
  if (!row) throw new Error('No user');
  return row.id;
}

const input = (name: string, exerciseIds: string[]) =>
  putWorkoutInputSchema.parse({
    name,
    exercises: exerciseIds.map((exerciseId) => ({ id: randomUUID(), exerciseId })),
  });

beforeAll(async () => {
  const rows = await getDb()
    .select({ id: exercise.id, slug: exercise.slug })
    .from(exercise)
    .where(and(inArray(exercise.slug, slugs), isNull(exercise.ownerId)));
  for (const row of rows) if (row.slug) ex[row.slug] = row.id;
  if (Object.keys(ex).length !== slugs.length) throw new Error('Run pnpm db:seed first');
});

afterAll(async () => {
  await deleteUsersByEmail('test-workouts-service-%@example.com');
});

describe('listWorkouts', () => {
  it('orders by the last change and sums up muscles, counts and thumbnails (AC6)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const push = randomUUID();
      const legs = randomUUID();
      await putWorkout(
        userId,
        'en',
        push,
        input('Push Day', [
          ex['barbell-bench-press']!,
          ex['lateral-raise']!,
          ex['triceps-pushdown']!,
          ex['barbell-bench-press']!,
          ex['plank']!,
        ]),
        tx,
      );
      await putWorkout(userId, 'en', legs, input('Legs', [ex['barbell-back-squat']!]), tx);
      await tx
        .update(workout)
        .set({ updatedAt: new Date(Date.now() - 60_000) })
        .where(eq(workout.id, legs));

      const { items } = await listWorkouts(userId, 'en', tx);
      expect(items.map((item) => item.name)).toEqual(['Push Day', 'Legs']);
      const [first] = items;
      expect(first?.exerciseCount).toBe(5);
      expect(first?.exerciseIds).toHaveLength(4);
      // Chest twice, then shoulders and triceps in order of appearance.
      expect(first?.primaryMuscles).toEqual(['chest', 'shoulders', 'triceps']);
      expect(first?.thumbnailUrls.length).toBeLessThanOrEqual(4);

      expect(await hasWorkouts(userId, tx)).toBe(true);
      expect(await hasWorkouts(await newUser(tx), tx)).toBe(false);
    });
  });

  it('runs the same number of queries for 2 and 5 workouts', async () => {
    const userId = await newUser(getDb());
    let queries = 0;
    const client = postgres(getEnv().DATABASE_URL, { prepare: false, max: 1 });
    const counting = drizzle(client, { schema, logger: { logQuery: () => (queries += 1) } });
    try {
      const counts: number[] = [];
      for (let n = 0; n < 5; n++) {
        await putWorkout(
          userId,
          'en',
          randomUUID(),
          input(`W${n}`, [ex['plank']!, ex['lateral-raise']!]),
        );
        if (n === 1 || n === 4) {
          queries = 0;
          const { items } = await listWorkouts(userId, 'en', counting);
          expect(items).toHaveLength(n + 1);
          counts.push(queries);
        }
      }
      expect(counts[0]).toBe(2);
      expect(counts[1]).toBe(counts[0]);
    } finally {
      await client.end();
    }
  });
});

describe('putWorkout', () => {
  it('keeps the order, targets and notes, and stops at 200 workouts (AC1, AC10)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      const parsed = putWorkoutInputSchema.parse({
        name: 'Push Day',
        exercises: [
          { id: randomUUID(), exerciseId: ex['plank']!, targetSets: 3, targetDurationSec: 45 },
          {
            id: randomUUID(),
            exerciseId: ex['barbell-bench-press']!,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetWeightKg: 82.5,
            notes: 'Pause at the bottom',
          },
        ],
      });
      const saved = await putWorkout(userId, 'en', id, parsed, tx);
      expect(saved.exercises.map((item) => item.exercise.name)).toEqual(['Plank', 'Bench Press']);
      expect(saved.exercises[1]).toMatchObject({
        targetWeightKg: 82.5,
        notes: 'Pause at the bottom',
      });
      expect(saved.exercises[0]?.exercise.trackingType).toBe('time');
      expect((await getWorkout(userId, 'en', id, tx)).exercises).toEqual(saved.exercises);

      await tx.insert(workout).values(
        Array.from({ length: 199 }, (_, n) => ({
          id: randomUUID(),
          ownerId: userId,
          name: `W${n}`,
        })),
      );
      await expect(
        putWorkout(userId, 'en', randomUUID(), input('One too many', [ex['plank']!]), tx),
      ).rejects.toMatchObject({ code: 'WORKOUT_LIMIT_REACHED' });
      // Editing an existing workout at the limit still works.
      await expect(
        putWorkout(userId, 'en', id, input('Renamed', [ex['plank']!]), tx),
      ).resolves.toMatchObject({
        name: 'Renamed',
      });
    });
  });
});

describe('deleting an own exercise', () => {
  it('removes it from the workouts that use it (AC13)', async () => {
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
      const only = randomUUID();
      const mixed = randomUUID();
      await putWorkout(userId, 'en', only, input('Only own', [own!.id]), tx);
      await putWorkout(userId, 'en', mixed, input('Mixed', [own!.id, ex['plank']!]), tx);

      await deleteOwnExercise(userId, own!.id, tx);

      const { items } = await listWorkouts(userId, 'en', tx);
      const byName = new Map(items.map((item) => [item.name, item]));
      expect(byName.get('Only own')?.exerciseCount).toBe(0);
      expect(byName.get('Mixed')?.exerciseIds).toEqual([ex['plank']]);
    });
  });
});
