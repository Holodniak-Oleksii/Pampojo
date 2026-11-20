import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { profile, user } from '@/server/db/schema';
import { deleteUsersByEmail, testPrefix } from '@/test/db';
import { GET } from '../pull/route';
import { POST } from '../push/route';

const PREFIX = testPrefix('sync-route');

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(null);
});

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

async function newUser(): Promise<string> {
  const db = getDb();
  const [row] = await db
    .insert(user)
    .values({ name: 'test', email: `${PREFIX}-${randomUUID()}@example.com` })
    .returning({ id: user.id });
  await db.insert(profile).values({
    userId: row!.id,
    displayName: 'Test',
    avatarEmoji: 'fox',
    avatarColor: 1,
    sex: 'male',
    birthDate: '1990-05-15',
    heightCm: 180,
    timeZone: 'UTC',
    onboardingCompletedAt: new Date(),
  });
  return row!.id;
}

const push = (body: unknown) =>
  POST(
    new Request('http://localhost/api/v1/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

const pull = (since?: string) =>
  GET(
    new Request(
      `http://localhost/api/v1/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    ),
    { params: Promise.resolve({}) },
  );

describe('sync routes', () => {
  it('need a session', async () => {
    expect((await push({ mutations: [] })).status).toBe(401);
    expect((await pull()).status).toBe(401);
  });

  it('push rejects an invalid body with 400', async () => {
    signIn(await newUser());
    const response = await push({ mutations: [] });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('push answers one result per mutation', async () => {
    signIn(await newUser());
    const id = randomUUID();
    const response = await push({
      mutations: [
        {
          id,
          type: 'measurement.put',
          entityId: randomUUID(),
          payload: { type: 'weight', value: 80, measuredOn: '2026-01-01' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).results).toEqual([{ id, status: 'applied' }]);
  });

  it('pull answers a full download and rejects an unknown cursor', async () => {
    signIn(await newUser());
    const full = await pull();
    expect(full.status).toBe(200);
    const body = await full.json();
    expect(body.totals).toBeDefined();
    expect(body.cursor).toEqual(expect.any(String));
    const invalid = await pull('not-a-cursor');
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('INVALID_CURSOR');
  });
});
