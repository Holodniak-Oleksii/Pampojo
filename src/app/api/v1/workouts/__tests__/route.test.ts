import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, user, workout, workoutExercise } from '@/server/db/schema';
import { deleteUsersByEmail } from '@/test/db';
import { DELETE, GET, PUT } from '../[id]/route';
import { GET as LIST } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/workouts';
let bench: string;

const send = (method: 'GET' | 'PUT' | 'DELETE', id: string, payload?: unknown) =>
  ({ GET, PUT, DELETE })[method](
    new Request(`${BASE}/${id}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );

const body = (exerciseId = bench, override: Record<string, unknown> = {}) => ({
  name: 'Push Day',
  exercises: [
    {
      id: randomUUID(),
      exerciseId,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      ...override,
    },
  ],
});

async function createUser() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-workouts-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

async function ownExercise(ownerId: string, deleted = false) {
  const [row] = await getDb()
    .insert(exercise)
    .values({
      ownerId,
      primaryMuscles: ['chest'],
      equipment: ['band'],
      trackingType: 'weight_reps',
      deletedAt: deleted ? new Date() : null,
    })
    .returning({ id: exercise.id });
  if (!row) throw new Error('No exercise');
  return row.id;
}

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

beforeAll(async () => {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(eq(exercise.slug, 'barbell-bench-press'), isNull(exercise.ownerId)));
  if (!row) throw new Error('Run pnpm db:seed first');
  bench = row.id;
});

beforeEach(() => {
  vi.mocked(getSession).mockReset();
});

afterAll(async () => {
  await deleteUsersByEmail('test-workouts-route-%@example.com');
});

describe('/api/v1/workouts', () => {
  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await LIST(new Request(BASE))).status).toBe(401);
    expect((await send('GET', randomUUID())).status).toBe(401);
  });

  it('creates once for the same PUT sent twice and lists it (AC4)', async () => {
    const userId = await createUser();
    signIn(userId);
    const id = randomUUID();
    const payload = body();
    const first = await send('PUT', id, payload);
    const second = await send('PUT', id, payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const saved = await second.json();
    expect(saved.exercises).toHaveLength(1);
    expect(saved.exercises[0]).toMatchObject({
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });

    const rows = await getDb().select().from(workout).where(eq(workout.ownerId, userId));
    expect(rows).toHaveLength(1);
    const children = await getDb()
      .select()
      .from(workoutExercise)
      .where(eq(workoutExercise.workoutId, id));
    expect(children).toHaveLength(1);

    const list = await (await LIST(new Request(BASE))).json();
    expect(list.items.map((item: { id: string }) => item.id)).toEqual([id]);
  });

  it('soft deletes once for DELETE sent twice (AC4)', async () => {
    const userId = await createUser();
    signIn(userId);
    const id = randomUUID();
    await send('PUT', id, body());
    expect((await send('DELETE', id)).status).toBe(204);
    const [deleted] = await getDb().select().from(workout).where(eq(workout.id, id));
    expect((await send('DELETE', id)).status).toBe(204);
    const [again] = await getDb().select().from(workout).where(eq(workout.id, id));
    expect(deleted?.deletedAt).not.toBeNull();
    expect(again?.deletedAt?.toISOString()).toBe(deleted?.deletedAt?.toISOString());
    expect((await send('GET', id)).status).toBe(404);
    expect((await send('PUT', id, body())).status).toBe(404);
  });

  it("answers 404 for another user's workout and leaves it unchanged (AC5)", async () => {
    const owner = await createUser();
    signIn(owner);
    const id = randomUUID();
    await send('PUT', id, body());

    signIn(await createUser());
    for (const method of ['GET', 'DELETE'] as const) {
      const response = await send(method, id);
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('WORKOUT_NOT_FOUND');
    }
    const put = await send('PUT', id, { ...body(), name: 'Taken over' });
    expect(put.status).toBe(404);
    const [row] = await getDb().select().from(workout).where(eq(workout.id, id));
    expect(row?.name).toBe('Push Day');
    expect(row?.deletedAt).toBeNull();
  });

  it("rejects another user's or a deleted own exercise (AC5)", async () => {
    const other = await createUser();
    const foreign = await ownExercise(other);
    const userId = await createUser();
    const deleted = await ownExercise(userId, true);
    signIn(userId);
    for (const exerciseId of [foreign, deleted]) {
      const response = await send('PUT', randomUUID(), body(exerciseId));
      expect(response.status).toBe(400);
      const { error } = await response.json();
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details[0].path).toEqual(['exercises', 0, 'exerciseId']);
    }
    const own = await ownExercise(userId);
    expect((await send('PUT', randomUUID(), body(own))).status).toBe(200);
  });

  it('rejects a target that does not fit the tracking type (AC10)', async () => {
    signIn(await createUser());
    const response = await send('PUT', randomUUID(), body(bench, { targetDurationSec: 30 }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.details[0].path).toEqual([
      'exercises',
      0,
      'targetDurationSec',
    ]);
  });
});
