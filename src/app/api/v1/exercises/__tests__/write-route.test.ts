import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { exercise, user } from '@/server/db/schema';
import { deleteUsersByEmail } from '@/test/db';
import { DELETE as deleteFrameRoute, PUT as putFrameRoute } from '../[id]/frames/[frameId]/route';
import { DELETE, GET, PATCH, PUT } from '../[id]/route';

vi.mock('@/server/auth/session', () => ({ getSession: vi.fn() }));
vi.mock('@/server/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage')>()),
  ensureBucket: vi.fn(async () => {}),
  putObject: vi.fn(async () => {}),
  copyObject: vi.fn(async () => {}),
  removeObjects: vi.fn(async () => {}),
  isStorageConfigured: () => false,
}));
vi.setConfig({ testTimeout: 30_000 });

const BASE = 'http://localhost/api/v1/exercises';
const body = (name = `Route ${randomUUID().slice(0, 8)}`) => ({
  name,
  primaryMuscles: ['chest'],
  equipment: ['band'],
  trackingType: 'weight_reps',
});

const send = (method: string, id: string, payload?: unknown) =>
  ({ GET, PUT, PATCH, DELETE })[method as 'GET']!(
    new Request(`${BASE}/${id}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );

async function frame(method: 'PUT' | 'DELETE', id: string, frameId: string, file?: Blob) {
  const form = new FormData();
  if (file) form.set('file', file, 'photo');
  const request = new Request(`${BASE}/${id}/frames/${frameId}`, {
    method,
    body: method === 'PUT' ? form : undefined,
  });
  const route = method === 'PUT' ? putFrameRoute : deleteFrameRoute;
  return route(request, { params: Promise.resolve({ id, frameId }) });
}

async function signIn(): Promise<string> {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `test-exercises-write-route-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  vi.mocked(getSession).mockResolvedValue({ user: { id: row.id } } as Awaited<
    ReturnType<typeof getSession>
  >);
  return row.id;
}

async function systemId(): Promise<string> {
  const [row] = await getDb()
    .select({ id: exercise.id })
    .from(exercise)
    .where(eq(exercise.slug, 'barbell-bench-press'));
  if (!row) throw new Error('Seed the catalog first');
  return row.id;
}

const jpeg = async () =>
  new Blob(
    [
      new Uint8Array(
        await sharp({
          create: { width: 64, height: 64, channels: 3, background: { r: 136, g: 136, b: 136 } },
        })
          .jpeg()
          .toBuffer(),
      ),
    ],
    { type: 'image/jpeg' },
  );

beforeEach(() => {
  vi.mocked(getSession).mockReset();
});

afterAll(async () => {
  await deleteUsersByEmail('test-exercises-write-route-%@example.com');
});

describe('exercise write routes', () => {
  it('creates idempotently with PUT and returns the same exercise twice (AC10)', async () => {
    await signIn();
    const id = randomUUID();
    const payload = body();

    const first = await send('PUT', id, payload);
    const second = await send('PUT', id, payload);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await second.json()).toEqual(await first.json());
  });

  it('hides a foreign exercise behind 404 on every endpoint (AC2)', async () => {
    await signIn();
    const id = randomUUID();
    await send('PUT', id, body());
    await signIn();

    for (const response of [
      await send('GET', id),
      await send('PATCH', id, { name: 'Mine now' }),
      await send('DELETE', id),
      await send('PUT', id, body()),
      await frame('PUT', id, randomUUID(), await jpeg()),
      await frame('DELETE', id, randomUUID()),
    ]) {
      expect(response.status).toBe(404);
      expect((await response.json()).error.code).toBe('EXERCISE_NOT_FOUND');
    }
  });

  it('answers 403 for system exercises (AC3)', async () => {
    await signIn();
    const id = await systemId();

    for (const response of [
      await send('PATCH', id, { name: 'Nope' }),
      await send('DELETE', id),
      await frame('PUT', id, randomUUID(), await jpeg()),
    ]) {
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('EXERCISE_READ_ONLY');
    }
  });

  it('maps name conflicts to 409 and deletes with 204 (AC6, AC8)', async () => {
    await signIn();
    const id = randomUUID();
    await send('PUT', id, body('Route Unique'));

    const conflict = await send('PUT', randomUUID(), body('route unique'));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe('EXERCISE_NAME_TAKEN');

    expect((await send('DELETE', id)).status).toBe(204);
    expect((await send('GET', id)).status).toBe(404);
  });

  it('rejects oversized and non-image uploads (AC4)', async () => {
    await signIn();
    const id = randomUUID();
    await send('PUT', id, body());

    const big = await frame(
      'PUT',
      id,
      randomUUID(),
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/jpeg' }),
    );
    expect(big.status).toBe(413);
    expect((await big.json()).error.code).toBe('IMAGE_TOO_LARGE');

    const text = await frame('PUT', id, randomUUID(), new Blob(['hello'], { type: 'text/plain' }));
    expect(text.status).toBe(400);
    expect((await text.json()).error.code).toBe('IMAGE_INVALID');

    const ok = await frame('PUT', id, randomUUID(), await jpeg());
    expect(ok.status).toBe(200);
  });
});
