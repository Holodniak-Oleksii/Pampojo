import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DomainError } from '../errors';
import { withHandler } from '../handler';
import { json } from '../response';
import { getAuth } from '@/server/auth/auth';
import { deleteUsersByEmail } from '@/test/db';

// The auth tests sign up a real user against the remote database, which takes seconds on CI.
vi.setConfig({ testTimeout: 30_000 });

const post = (body: string) =>
  new Request('http://localhost/api/v1/things', { method: 'POST', body });

describe('withHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the parsed body to the handler', async () => {
    const handler = withHandler(
      { auth: 'none', body: z.object({ name: z.string() }).strict() },
      async ({ body }) => json({ received: body.name }),
    );

    const response = await handler(post('{"name":"Push Day"}'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: 'Push Day' });
  });

  it('returns 400 VALIDATION_FAILED with issues for an invalid body', async () => {
    const handler = withHandler(
      { auth: 'none', body: z.object({ name: z.string() }).strict() },
      async () => json({}),
    );

    const response = await handler(post('{"name":42}'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details).toEqual([expect.objectContaining({ path: ['name'] })]);
  });

  it('returns 400 for a body that is not JSON', async () => {
    const handler = withHandler({ auth: 'none', body: z.object({}) }, async () => json({}));

    const response = await handler(post('not json'));

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('passes repeated query keys as arrays and single keys as strings', async () => {
    const handler = withHandler(
      {
        auth: 'none',
        query: z.object({ muscle: z.array(z.string()), q: z.string() }).strict(),
      },
      async ({ query }) => json(query),
    );

    const response = await handler(
      new Request('http://localhost/api/v1/things?muscle=chest&muscle=triceps&q=press'),
    );

    expect(await response.json()).toEqual({ muscle: ['chest', 'triceps'], q: 'press' });
  });

  it('maps a DomainError code to its status and envelope', async () => {
    const handler = withHandler({ auth: 'none' }, async () => {
      throw new DomainError('NOT_FOUND', 'Thing not found');
    });

    const response = await handler(new Request('http://localhost/api/v1/things/1'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Thing not found' },
    });
  });

  it('returns 500 INTERNAL without internals for an unexpected error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withHandler({ auth: 'none' }, async () => {
      throw new Error('boom');
    });

    const response = await handler(new Request('http://localhost/api/v1/things'));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: { code: 'INTERNAL', message: 'Internal error' } });
    expect(text).not.toContain('boom');
  });
});

describe('json', () => {
  it('sets private, no-store by default', () => {
    expect(json({}).headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('keeps an explicit Cache-Control header', () => {
    const response = json({}, { headers: { 'Cache-Control': 'no-store' } });

    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('withHandler auth', () => {
  const authed = withHandler({ auth: 'required' }, async ({ userId }) => json({ userId }));

  afterAll(async () => {
    await deleteUsersByEmail('test-handler-%@example.com');
  });

  it('returns 401 UNAUTHORIZED without a session', async () => {
    const response = await authed(new Request('http://localhost/api/v1/me'));

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('passes the signed-in user id to the handler', async () => {
    const email = `test-handler-${randomUUID()}@example.com`;
    const signUp = await getAuth().handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': '203.0.113.200',
        },
        body: JSON.stringify({ email, password: 'Password123!', name: 'test' }),
      }),
    );
    const cookie = (signUp.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const { user: created } = await signUp.json();

    const response = await authed(
      new Request('http://localhost/api/v1/me', { headers: { cookie } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: created.id });
  });
});
