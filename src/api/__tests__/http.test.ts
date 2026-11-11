import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '../http';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe('http', () => {
  it('parses the error envelope into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } }),
    );

    const error = await http('/api/v1/me/profile').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'PROFILE_NOT_FOUND', status: 404 });
  });

  it('retries a network error twice on GET and PUT', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(settle(http('/x', { method: 'PUT', body: {} }))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after two retries with a NETWORK error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = settle(http('/x').catch((caught: unknown) => caught));

    expect(await result).toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry PATCH', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await http('/x', { method: 'PATCH', body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(result).toMatchObject({ code: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 503 but not 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, {}));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await expect(settle(http('/x'))).resolves.toEqual({ ok: true });

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { code: 'VALIDATION_FAILED' } }));
    await expect(http('/x')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends FormData as is, without a JSON content type', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const form = new FormData();
    form.set('file', new Blob(['x']), 'photo');

    await http('/api/v1/exercises/a/frames/b', { method: 'PUT', body: form });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(form);
    expect(init?.headers).not.toHaveProperty('content-type');
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(http('/api/v1/exercises/a', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
