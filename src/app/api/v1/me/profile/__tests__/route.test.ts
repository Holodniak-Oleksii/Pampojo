import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/server/db/client';
import { user } from '@/server/db/schema';
import { getSession } from '@/server/auth/session';
import { deleteUsersByEmail } from '@/test/db';
import { GET, PATCH, PUT } from '../route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.setConfig({ testTimeout: 30_000 });

const URL_ = 'http://localhost/api/v1/me/profile';
const body = {
  displayName: 'John Smith',
  avatarEmoji: 'fox',
  avatarColor: 3,
  sex: 'male',
  birthDate: '1990-05-15',
  heightCm: 180,
  weightKg: 79.8,
  unitSystem: 'metric',
  timeZone: 'Europe/Kyiv',
};

const request = (method: string, payload?: unknown) =>
  new Request(URL_, {
    method,
    headers: { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

async function signedInAs() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-profile-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  vi.mocked(getSession).mockResolvedValue({ user: { id: row.id } } as Awaited<
    ReturnType<typeof getSession>
  >);
  return row.id;
}

beforeEach(() => {
  vi.mocked(getSession).mockReset();
});

afterAll(async () => {
  await deleteUsersByEmail('test-profile-route-%@example.com');
});

describe('/api/v1/me/profile', () => {
  it('returns 401 without a session on every method', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    for (const response of [
      await GET(request('GET')),
      await PUT(request('PUT', body)),
      await PATCH(request('PATCH', { displayName: 'Jane' })),
    ]) {
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns 404 PROFILE_NOT_FOUND on GET and PATCH before onboarding', async () => {
    await signedInAs();
    const get = await GET(request('GET'));
    const patch = await PATCH(request('PATCH', { displayName: 'Jane' }));
    expect(get.status).toBe(404);
    expect((await get.json()).error.code).toBe('PROFILE_NOT_FOUND');
    expect(patch.status).toBe(404);
  });

  it('finishes onboarding with PUT, and a repeat returns the same profile', async () => {
    await signedInAs();
    const first = await PUT(request('PUT', body));
    const second = await PUT(request('PUT', body));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(first.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('never shows one user the profile of another', async () => {
    await signedInAs();
    await PUT(request('PUT', body));
    await signedInAs();
    expect((await GET(request('GET'))).status).toBe(404);
  });

  it('rejects an underage birth date on PUT and PATCH with 400', async () => {
    await signedInAs();
    const tooYoung = `${new Date().getUTCFullYear() - 10}-01-01`;
    const put = await PUT(request('PUT', { ...body, birthDate: tooYoung }));
    expect(put.status).toBe(400);
    expect((await put.json()).error.details).toEqual([
      expect.objectContaining({ path: ['birthDate'], message: 'too_young' }),
    ]);

    await PUT(request('PUT', body));
    const patch = await PATCH(request('PATCH', { birthDate: tooYoung }));
    expect(patch.status).toBe(400);
  });

  it('rejects an empty PATCH and accepts a partial one', async () => {
    await signedInAs();
    await PUT(request('PUT', body));
    expect((await PATCH(request('PATCH', {}))).status).toBe(400);
    const response = await PATCH(request('PATCH', { heightCm: 181 }));
    expect(response.status).toBe(200);
    expect((await response.json()).heightCm).toBe(181);
  });
});
