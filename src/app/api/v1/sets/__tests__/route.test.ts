import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, setLog, user, workout, workoutSession } from '@/server/db/schema';
import { deleteUsersByEmail } from '@/test/db';
import { DELETE, PATCH, PUT } from '../[id]/route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/sets';
let bench: string;

const send = (method: 'PUT' | 'PATCH' | 'DELETE', id: string, payload?: unknown) =>
  ({ PUT, PATCH, DELETE })[method](
    new Request(`${BASE}/${id}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

async function createSession() {
  const db = getDb();
  const [owner] = await db
    .insert(user)
    .values({ name: 'test', email: `test-sets-route-${randomUUID()}@example.com` })
    .returning();
  const workoutId = randomUUID();
  await db.insert(workout).values({ id: workoutId, ownerId: owner!.id, name: 'Push Day' });
  const entry = randomUUID();
  const info = {
    id: bench,
    name: 'Bench',
    trackingType: 'weight_reps' as const,
    laterality: null,
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
  const sessionId = randomUUID();
  await db.insert(workoutSession).values({
    id: sessionId,
    userId: owner!.id,
    workoutId,
    workoutSnapshot: { workoutId, name: 'Push Day', description: null, exercises: [] },
    exercises: [{ id: entry, exerciseId: bench, plannedSets: 3, ...targets, exercise: info }],
    status: 'in_progress',
    startedAt: new Date(Date.now() - 60_000),
  });
  return { userId: owner!.id, sessionId, entry };
}

const setBody = (sessionId: string, entry: string, override: Record<string, unknown> = {}) => ({
  sessionId,
  sessionExerciseId: entry,
  exerciseId: bench,
  setIndex: 0,
  weightKg: 80,
  reps: 8,
  durationSec: null,
  distanceM: null,
  completedAt: new Date().toISOString(),
  ...override,
});

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
  await deleteUsersByEmail('test-sets-route-%@example.com');
});

describe('/api/v1/sets/{id}', () => {
  it('PUT twice is one row; DELETE twice is 204 and one deleted row (AC6)', async () => {
    const { userId, sessionId, entry } = await createSession();
    signIn(userId);
    const id = randomUUID();
    expect((await send('PUT', id, setBody(sessionId, entry))).status).toBe(200);
    expect((await send('PUT', id, setBody(sessionId, entry))).status).toBe(200);
    expect(await getDb().select().from(setLog).where(eq(setLog.sessionId, sessionId))).toHaveLength(
      1,
    );
    expect((await send('DELETE', id)).status).toBe(204);
    expect((await send('DELETE', id)).status).toBe(204);
    const rows = await getDb().select().from(setLog).where(eq(setLog.sessionId, sessionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).not.toBeNull();
  });

  it("returns 404 for another user's set and 409 on a finished session (AC13)", async () => {
    const { userId, sessionId, entry } = await createSession();
    signIn(userId);
    const id = randomUUID();
    await send('PUT', id, setBody(sessionId, entry));

    const stranger = await createSession();
    signIn(stranger.userId);
    expect((await send('PATCH', id, { reps: 5 })).status).toBe(404);
    expect((await send('DELETE', id)).status).toBe(404);
    expect((await send('PUT', randomUUID(), setBody(sessionId, entry))).status).toBe(404);

    signIn(userId);
    await getDb()
      .update(workoutSession)
      .set({ status: 'completed', finishedAt: new Date() })
      .where(eq(workoutSession.id, sessionId));
    const late = await send('PUT', randomUUID(), setBody(sessionId, entry, { setIndex: 1 }));
    expect(late.status).toBe(409);
    expect(((await late.json()) as { error: { code: string } }).error.code).toBe(
      'SESSION_NOT_IN_PROGRESS',
    );
  });

  it('rejects out-of-range values with 400 (AC12)', async () => {
    const { userId, sessionId, entry } = await createSession();
    signIn(userId);
    expect((await send('PUT', randomUUID(), setBody(sessionId, entry, { reps: 101 }))).status).toBe(
      400,
    );
    expect(
      (await send('PUT', randomUUID(), setBody(sessionId, entry, { weightKg: 500.5 }))).status,
    ).toBe(400);
  });
});
