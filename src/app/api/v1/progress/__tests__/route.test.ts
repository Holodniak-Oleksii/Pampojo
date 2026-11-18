import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise } from '@/server/db/schema';
import type { Tx } from '@/server/plan/queries';
import { deleteUsersByEmail, testPrefix } from '@/test/db';
import { newHistoryUser, newHistoryWorkout } from '@/test/history-fixtures';
import { insertSessionWithSets, systemExerciseId } from '@/test/progress-fixtures';
import { GET as DETAIL } from '../exercises/[id]/route';
import { GET as LIST } from '../exercises/route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const PREFIX = testPrefix('progress-route');
let userId: string;
let otherUserId: string;
let bench: string;

const signIn = (id: string) =>
  vi
    .mocked(getSession)
    .mockResolvedValue({ user: { id } } as Awaited<ReturnType<typeof getSession>>);

const detail = (id: string, range?: string) =>
  DETAIL(
    new Request(
      `http://localhost/api/v1/progress/exercises/${id}${range ? `?range=${range}` : ''}`,
    ),
    { params: Promise.resolve({ id }) },
  );

beforeAll(async () => {
  const db = getDb() as unknown as Tx;
  bench = await systemExerciseId('barbell-bench-press');
  userId = await newHistoryUser(db, PREFIX);
  otherUserId = await newHistoryUser(db, PREFIX);
  const workoutId = await newHistoryWorkout(db, userId, bench);
  await insertSessionWithSets(db, {
    userId,
    workoutId,
    startedAt: new Date(Date.now() - 2 * 86_400_000),
    sets: [{ exerciseId: bench, weightKg: 80, reps: 8 }],
  });
});

beforeEach(() => signIn(userId));

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

describe('GET /api/v1/progress/exercises', () => {
  it('lists the trained exercises and the month numbers', async () => {
    const response = await LIST(new Request('http://localhost/api/v1/progress/exercises'), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { exerciseId: string }[] };
    expect(body.items.map((item) => item.exerciseId)).toEqual([bench]);
  });
});

describe('GET /api/v1/progress/exercises/{id}', () => {
  it('returns points and records with the default range', async () => {
    const response = await detail(bench);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { points: unknown[]; records: unknown[] };
    expect(body.points).toHaveLength(1);
    expect(body.records).toHaveLength(4);
  });

  it('rejects an unknown range with 400', async () => {
    expect((await detail(bench, '2w')).status).toBe(400);
  });

  it('gives 404 for an unknown id and for another user’s own exercise', async () => {
    expect((await detail(randomUUID())).status).toBe(404);
    const own = randomUUID();
    await getDb()
      .insert(exercise)
      .values({
        id: own,
        ownerId: otherUserId,
        primaryMuscles: ['chest'],
        equipment: ['barbell'],
        trackingType: 'weight_reps',
      } as typeof exercise.$inferInsert);
    expect((await detail(own)).status).toBe(404);
  });
});
