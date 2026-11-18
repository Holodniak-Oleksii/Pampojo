import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { profile, user } from '@/server/db/schema';
import { deleteUsersByEmail, testPrefix } from '@/test/db';
import { DELETE, PUT } from '../[id]/route';
import { GET } from '../route';

const PREFIX = testPrefix('measurements-route');
const ZONE = 'Europe/Kyiv';
const BASE = 'http://localhost/api/v1/measurements';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const send = (method: 'PUT' | 'DELETE', id: string, payload?: unknown) =>
  ({ PUT, DELETE })[method](
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
    .values({ name: 'test', email: `${PREFIX}-${randomUUID()}@example.com` })
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

function signIn(id: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

const body = (override: Record<string, unknown> = {}) => ({
  type: 'chest',
  value: 104.25,
  measuredOn: todayIn(ZONE),
  ...override,
});

let userId: string;

beforeEach(async () => {
  userId = await createUser();
  signIn(userId);
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

describe('PUT /measurements/{id}', () => {
  it('creates with 201 and answers a repeat with 200 and the same row (AC6)', async () => {
    const id = randomUUID();
    const first = await send('PUT', id, body());
    const second = await send('PUT', id, body());
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ item: { id, type: 'chest', value: 104.25 } });
    const listed = await (await list()).json();
    expect(listed.items).toHaveLength(1);
  });

  it('rejects values outside the limits and unknown keys with 400 (AC9)', async () => {
    expect((await send('PUT', randomUUID(), body({ value: 300 }))).status).toBe(400);
    expect((await send('PUT', randomUUID(), body({ value: 104.255 }))).status).toBe(400);
    expect((await send('PUT', randomUUID(), body({ userId: randomUUID() }))).status).toBe(400);
  });

  it('answers another user’s id with 404 (AC20)', async () => {
    const id = randomUUID();
    await send('PUT', id, body());
    signIn(await createUser());
    expect((await send('PUT', id, body({ value: 99 }))).status).toBe(404);
    expect((await send('DELETE', id)).status).toBe(404);
  });

  it('requires a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect((await list()).status).toBe(401);
  });
});

describe('DELETE /measurements/{id}', () => {
  it('answers 204 twice and removes the row from the list', async () => {
    const id = randomUUID();
    await send('PUT', id, body());
    expect((await send('DELETE', id)).status).toBe(204);
    expect((await send('DELETE', id)).status).toBe(204);
    expect((await (await list()).json()).items).toHaveLength(0);
  });

  it('answers an unknown id with 404', async () => {
    expect((await send('DELETE', randomUUID())).status).toBe(404);
  });
});
