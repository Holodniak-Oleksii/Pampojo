import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, user, workout, workoutSession } from '@/server/db/schema';
import type { Tx } from '@/server/plan/queries';
import { deleteUsersByEmail, testPrefix } from '@/test/db';
import { insertSessionWithSets } from '@/test/progress-fixtures';
import { GET as LAST } from '../../exercises/[id]/last-performance/route';
import { DELETE, GET, PATCH, PUT } from '../[id]/route';
import { GET as LIST } from '../route';

const PREFIX = testPrefix('sessions-route');

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/sessions';
let bench: string;

const send = (method: 'GET' | 'PUT' | 'PATCH' | 'DELETE', id: string, payload?: unknown) =>
  ({ GET, PUT, PATCH, DELETE })[method](
    new Request(`${BASE}/${id}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );

async function createUser() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `${PREFIX}-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

async function createWorkout(ownerId: string) {
  const [row] = await getDb()
    .insert(workout)
    .values({ id: randomUUID(), ownerId, name: 'Push Day' })
    .returning({ id: workout.id });
  if (!row) throw new Error('No workout');
  return row.id;
}

function body(workoutId: string) {
  const entry = randomUUID();
  const info = {
    id: bench,
    name: 'Bench Press',
    trackingType: 'weight_reps',
    laterality: 'bilateral',
    thumbnailUrl: null,
  };
  const targets = {
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetWeightKg: 80,
    targetDurationSec: null,
    targetDistanceM: null,
    notes: null,
  };
  return {
    workoutId,
    workoutSnapshot: {
      workoutId,
      name: 'Push Day',
      description: null,
      exercises: [{ id: entry, exerciseId: bench, ...targets, exercise: info }],
    },
    exercises: [{ id: entry, exerciseId: bench, plannedSets: 3, ...targets, exercise: info }],
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  };
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
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

describe('/api/v1/sessions', () => {
  it('requires a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const response = await LIST(new Request(BASE));
    expect(response.status).toBe(401);
  });

  it('PUT twice creates one session (AC6)', async () => {
    const userId = await createUser();
    signIn(userId);
    const id = randomUUID();
    const payload = body(await createWorkout(userId));
    const first = await send('PUT', id, payload);
    const second = await send('PUT', id, payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const rows = await getDb().select().from(workoutSession).where(eq(workoutSession.id, id));
    expect(rows).toHaveLength(1);
    const listed = (await (await LIST(new Request(`${BASE}?status=in_progress`))).json()) as {
      items: { id: string; workoutName: string }[];
    };
    expect(listed.items).toEqual([expect.objectContaining({ id, workoutName: 'Push Day' })]);
  });

  it("returns 404 for another user's session and 409 after it is finished (AC13)", async () => {
    const owner = await createUser();
    signIn(owner);
    const id = randomUUID();
    await send('PUT', id, body(await createWorkout(owner)));

    signIn(await createUser());
    for (const response of [
      await send('GET', id),
      await send('PUT', id, body(randomUUID())),
      await send('PATCH', id, { notes: 'x' }),
    ]) {
      expect(response.status).toBe(404);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
        'SESSION_NOT_FOUND',
      );
    }

    signIn(owner);
    const done = await send('PATCH', id, {
      status: 'completed',
      finishedAt: new Date().toISOString(),
    });
    expect(done.status).toBe(200);
    const late = await send('PATCH', id, { notes: 'late' });
    expect(late.status).toBe(409);
  });

  it('DELETE removes a finished session from the history; a repeat is 204, another user 404', async () => {
    const owner = await createUser();
    signIn(owner);
    const id = randomUUID();
    await send('PUT', id, body(await createWorkout(owner)));
    await send('PATCH', id, { status: 'completed', finishedAt: new Date().toISOString() });

    signIn(await createUser());
    expect((await send('DELETE', id)).status).toBe(404);

    signIn(owner);
    expect((await send('DELETE', id)).status).toBe(204);
    expect((await send('DELETE', id)).status).toBe(204);
    expect((await send('GET', id)).status).toBe(404);
    const listed = (await (await LIST(new Request(`${BASE}?status=completed`))).json()) as {
      items: { id: string }[];
    };
    expect(listed.items.map((item) => item.id)).not.toContain(id);
  });

  it('rejects an invalid body with 400', async () => {
    const userId = await createUser();
    signIn(userId);
    const response = await send('PUT', randomUUID(), {
      ...body(await createWorkout(userId)),
      exercises: [],
    });
    expect(response.status).toBe(400);
  });

  it('returns null last performance for a first time', async () => {
    signIn(await createUser());
    const response = await LAST(
      new Request(`http://localhost/api/v1/exercises/${bench}/last-performance`),
      {
        params: Promise.resolve({ id: bench }),
      },
    );
    expect(await response.json()).toEqual({ item: null, bests: null });
  });

  it('returns the all-time bests with last performance (spec 13)', async () => {
    const userId = await createUser();
    signIn(userId);
    const workoutId = await createWorkout(userId);
    const db = getDb() as unknown as Tx;
    const day = (back: number) => new Date(Date.now() - back * 86_400_000);
    await insertSessionWithSets(db, {
      userId,
      workoutId,
      startedAt: day(10),
      sets: [{ exerciseId: bench, weightKg: 100, reps: 3 }],
    });
    await insertSessionWithSets(db, {
      userId,
      workoutId,
      startedAt: day(3),
      sets: [{ exerciseId: bench, weightKg: 80, reps: 10 }],
    });
    const response = await LAST(
      new Request(`http://localhost/api/v1/exercises/${bench}/last-performance`),
      { params: Promise.resolve({ id: bench }) },
    );
    const json = (await response.json()) as { item: { sets: unknown[] }; bests: unknown };
    expect(json.item.sets).toHaveLength(1);
    expect(json.bests).toEqual({
      heaviestWeightKg: 100,
      bestE1rmKg: 110,
      mostReps: { reps: 10, weightKg: 80 },
      bestVolumeKg: 800,
      longestDurationSec: null,
      longestDistanceM: null,
    });
  });
});
