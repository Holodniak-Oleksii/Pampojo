import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/v1/health/route';
import { getDb } from '@/server/db/client';
import { HEALTH_TIMEOUT_MS } from '../service';

const request = () => new Request('http://localhost/api/v1/health');

describe('GET /api/v1/health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns 200 with db: true when the database answers', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, db: true });
  });

  it('returns 503 without details when the query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(getDb(), 'execute').mockRejectedValueOnce(new Error('connection refused'));

    const response = await GET(request());

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: false, db: false });
  });

  it('returns 503 when the database does not answer in time', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(getDb(), 'execute').mockReturnValueOnce(new Promise(() => {}) as never);

    const pending = GET(request());
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
    const response = await pending;

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, db: false });
  });
});
