import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DomainError } from '../errors';
import { withHandler } from '../handler';
import { json } from '../response';

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
