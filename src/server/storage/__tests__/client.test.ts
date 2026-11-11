import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = { SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' };
vi.mock('@/server/env', () => ({ getEnv: () => env }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_x';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const headersOf = (call: number) =>
  fetchMock.mock.calls[call]?.[1]?.headers as Record<string, string>;

describe('storage client', () => {
  it('sends new secret keys in apikey only and legacy keys in both headers', async () => {
    const { putObject } = await import('../client');
    fetchMock.mockResolvedValue(new Response('{}'));

    await putObject('b', 'k.webp', new Uint8Array([1]), 'image/webp');
    expect(headersOf(0)).toMatchObject({ apikey: 'sb_secret_x', 'x-upsert': 'true' });
    expect(headersOf(0)).not.toHaveProperty('authorization');

    env.SUPABASE_SERVICE_ROLE_KEY = 'eyJlegacy';
    await putObject('b', 'k.webp', new Uint8Array([1]), 'image/webp');
    expect(headersOf(1)).toMatchObject({ apikey: 'eyJlegacy', authorization: 'Bearer eyJlegacy' });
  });

  it('maps signed URLs by key in one request', async () => {
    const { signUrls } = await import('../client');
    fetchMock.mockResolvedValue(
      Response.json([
        { path: 'a.webp', signedURL: '/object/sign/b/a.webp?token=1' },
        { path: 'b.webp', signedURL: '/object/sign/b/b.webp?token=2' },
      ]),
    );

    const urls = await signUrls('b', ['a.webp', 'b.webp'], 3600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls.get('a.webp')).toBe(
      'https://ref.supabase.co/storage/v1/object/sign/b/a.webp?token=1',
    );
    expect(await signUrls('b', [], 3600)).toEqual(new Map());
  });

  it('falls back to download and upload when the copy endpoint fails', async () => {
    const { copyObject } = await import('../client');
    fetchMock
      .mockResolvedValueOnce(new Response('nope', { status: 400 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/webp' } }),
      )
      .mockResolvedValueOnce(new Response('{}'));

    await copyObject('pub', 'a.webp', 'priv', 'b.webp');

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://ref.supabase.co/storage/v1/object/copy',
      'https://ref.supabase.co/storage/v1/object/pub/a.webp',
      'https://ref.supabase.co/storage/v1/object/priv/b.webp',
    ]);
  });

  it('throws STORAGE_UNAVAILABLE without a key', async () => {
    const { removeObjects } = await import('../client');
    env.SUPABASE_SERVICE_ROLE_KEY = '';
    await expect(removeObjects('b', ['a'])).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });
});
