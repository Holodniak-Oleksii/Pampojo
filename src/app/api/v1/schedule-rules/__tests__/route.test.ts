import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, profile, scheduleRule, user, workout, workoutExercise } from '@/server/db/schema';
import { addDays } from '@/shared/plan/occurrences';
import { deleteUsersByEmail } from '@/test/db';
import { DELETE, PATCH, PUT } from '../[id]/route';
import { GET } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/schedule-rules';
const ZONE = 'Europe/Kyiv';
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

const list = () => GET(new Request(BASE), { params: Promise.resolve({}) });

async function createUser() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-plan-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  await getDb().insert(profile).values({
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

async function createWorkout(ownerId: string) {
  const id = randomUUID();
  await getDb().insert(workout).values({ id, ownerId, name: 'Push Day' });
  await getDb()
    .insert(workoutExercise)
    .values({ id: randomUUID(), workoutId: id, exerciseId: bench, position: 0 });
  return id;
}

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

const today = () => todayIn(ZONE);
const rule = (workoutId: string, overrides: Record<string, unknown> = {}) => ({
  workoutId,
  startDate: today(),
  weekdays: [1, 4],
  intervalWeeks: 1,
  endDate: null,
  ...overrides,
});

let userId: string;
let workoutId: string;

beforeAll(async () => {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(and(eq(exercise.slug, 'barbell-bench-press'), isNull(exercise.ownerId)));
  if (!row) throw new Error('Run pnpm db:seed first');
  bench = row.id;
});

beforeEach(async () => {
  userId = await createUser();
  workoutId = await createWorkout(userId);
  signIn(userId);
});

afterAll(async () => {
  await deleteUsersByEmail('test-plan-route-%@example.com');
});

describe('PUT /schedule-rules/{id}', () => {
  it('creates with 201 and answers a repeat with 200 and the same rule (AC7)', async () => {
    const id = randomUUID();
    const first = await send('PUT', id, rule(workoutId));
    const again = await send('PUT', id, rule(workoutId));
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual(await first.json());
    const body = (await (await list()).json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });

  it('answers 400, 422 and 404 as documented (AC7)', async () => {
    expect((await send('PUT', randomUUID(), rule(workoutId, { intervalWeeks: 5 }))).status).toBe(
      400,
    );
    expect((await send('PUT', randomUUID(), rule(workoutId, { weekdays: [] }))).status).toBe(400);
    expect(
      (await send('PUT', randomUUID(), rule(workoutId, { startDate: addDays(today(), -1) })))
        .status,
    ).toBe(400);
    await send('PUT', randomUUID(), rule(workoutId));
    const overlap = await send('PUT', randomUUID(), rule(workoutId, { weekdays: [4] }));
    expect(overlap.status).toBe(422);
    expect(await overlap.json()).toMatchObject({
      error: { code: 'SCHEDULE_OVERLAP', details: { workoutName: 'Push Day' } },
    });

    const id = randomUUID();
    await send('PUT', id, rule(workoutId, { weekdays: [6] }));
    const intruder = await createUser();
    signIn(intruder);
    expect((await send('DELETE', id)).status).toBe(404);
    expect((await send('PUT', randomUUID(), rule(workoutId, { weekdays: [7] }))).status).toBe(
      400,
    );
  });
});

describe('PATCH and DELETE /schedule-rules/{id}', () => {
  it('splits a started rule once for the same newId and deletes repeat-safely (AC5, AC7)', async () => {
    const id = randomUUID();
    await getDb()
      .insert(scheduleRule)
      .values({ id, userId, workoutId, startDate: addDays(today(), -7), weekdays: [1, 4] });
    const newId = randomUUID();
    const payload = { ...rule(workoutId, { weekdays: [2] }), newId };
    const first = await send('PATCH', id, payload);
    const again = await send('PATCH', id, payload);
    expect(first.status).toBe(200);
    const items = ((await first.json()) as { items: { id: string; endDate: string | null }[] })
      .items;
    expect(items.map((item) => item.id)).toEqual([id, newId]);
    expect(items[0]?.endDate).toBe(addDays(today(), -1));
    expect(await again.json()).toEqual({ items });

    expect((await send('DELETE', newId)).status).toBe(204);
    expect((await send('DELETE', newId)).status).toBe(204);
    const body = (await (await list()).json()) as { items: { id: string }[] };
    expect(body.items.map((item) => item.id)).toEqual([id]);
  });
});
