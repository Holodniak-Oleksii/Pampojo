import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { gymProfile, user } from '@/server/db/schema';
import { deleteUsersByEmail } from '@/test/db';
import { GET, PUT } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const URL_ = 'http://localhost/api/v1/me/gym';

const request = (method: string, payload?: unknown) =>
  new Request(URL_, {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

async function createUser() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-gym-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

function signIn(userId: string) {
  vi.mocked(getSession).mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

beforeEach(() => {
  vi.mocked(getSession).mockReset();
});

afterAll(async () => {
  await deleteUsersByEmail('test-gym-route-%@example.com');
});

describe('/api/v1/me/gym', () => {
  it('returns 401 without a session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    for (const response of [
      await GET(request('GET')),
      await PUT(request('PUT', { equipment: [] })),
    ]) {
      expect(response.status).toBe(401);
    }
  });

  it('returns 404 GYM_PROFILE_NOT_FOUND before the first save', async () => {
    signIn(await createUser());
    const response = await GET(request('GET'));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('GYM_PROFILE_NOT_FOUND');
  });

  it('saves with PUT, a replay keeps one row, and GET returns it', async () => {
    const userId = await createUser();
    signIn(userId);
    const body = { equipment: ['flat_bench', 'barbell', 'barbell'] };
    const first = await PUT(request('PUT', body));
    const second = await PUT(request('PUT', body));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect((await second.json()).equipment).toEqual(['barbell', 'flat_bench']);
    const rows = await getDb().select().from(gymProfile).where(eq(gymProfile.userId, userId));
    expect(rows).toHaveLength(1);
    const get = await GET(request('GET'));
    expect(await get.json()).toMatchObject({ equipment: ['barbell', 'flat_bench'] });
  });

  it('accepts an empty list', async () => {
    signIn(await createUser());
    const response = await PUT(request('PUT', { equipment: [] }));
    expect(response.status).toBe(200);
    expect((await response.json()).equipment).toEqual([]);
  });

  it('rejects an unknown key and extra fields with 400', async () => {
    signIn(await createUser());
    for (const body of [{ equipment: ['treadmill'] }, { equipment: [], name: 'Home' }]) {
      const response = await PUT(request('PUT', body));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('VALIDATION_FAILED');
    }
  });

  it("does not read or change another user's gym", async () => {
    const other = await createUser();
    signIn(other);
    await PUT(request('PUT', { equipment: ['dumbbells'] }));
    signIn(await createUser());
    expect((await GET(request('GET'))).status).toBe(404);
    await PUT(request('PUT', { equipment: ['barbell'] }));
    const [row] = await getDb().select().from(gymProfile).where(eq(gymProfile.userId, other));
    expect(row?.equipment).toEqual(['dumbbells']);
  });
});
