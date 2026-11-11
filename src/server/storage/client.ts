import 'server-only';
import { getEnv } from '@/server/env';
import { DomainError } from '@/server/http/errors';

export const STORAGE_ERROR = { UNAVAILABLE: 'STORAGE_UNAVAILABLE' } as const;

interface Config {
  base: string;
  headers: Record<string, string>;
}

function config(): Config {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: key } = getEnv();
  if (!SUPABASE_URL || !key) {
    throw new DomainError(STORAGE_ERROR.UNAVAILABLE, 'Storage is not configured');
  }
  // New `sb_secret_…` keys are not JWTs and go in `apikey` only; legacy service_role JWTs need both.
  const headers: Record<string, string> = key.startsWith('sb_')
    ? { apikey: key }
    : { apikey: key, authorization: `Bearer ${key}` };
  return { base: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1`, headers };
}

async function call(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  const { base, headers } = config();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Storage ${init.method ?? 'GET'} ${path} failed: ${response.status} ${text.slice(0, 200)}`,
    );
  }
  return response;
}

const ensured = new Set<string>();

/** Creates the bucket once per process; an existing bucket counts as success. */
export async function ensureBucket(bucket: string, isPublic: boolean): Promise<void> {
  if (ensured.has(bucket)) return;
  try {
    await call('/bucket', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: bucket, name: bucket, public: isPublic }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !/already exists/i.test(error.message)) throw error;
  }
  ensured.add(bucket);
}

export async function putObject(
  bucket: string,
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  await call(`/object/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'cache-control': 'max-age=31536000',
      'x-upsert': 'true',
    },
    body: new Uint8Array(body),
  });
}

/** Copies an object, also across buckets; falls back to download and upload on older Storage versions. */
export async function copyObject(
  fromBucket: string,
  fromKey: string,
  toBucket: string,
  toKey: string,
): Promise<void> {
  try {
    await call('/object/copy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bucketId: fromBucket,
        sourceKey: fromKey,
        destinationBucket: toBucket,
        destinationKey: toKey,
      }),
    });
  } catch {
    const source = await call(`/object/${fromBucket}/${fromKey}`);
    await putObject(
      toBucket,
      toKey,
      new Uint8Array(await source.arrayBuffer()),
      source.headers.get('content-type') ?? 'image/webp',
    );
  }
}

export async function removeObjects(bucket: string, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await call(`/object/${bucket}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: keys }),
  });
}

/** One request for all keys; returns absolute signed URLs by key. */
export async function signUrls(
  bucket: string,
  keys: readonly string[],
  expiresIn: number,
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const { base } = config();
  const response = await call(`/object/sign/${bucket}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn, paths: keys }),
  });
  const data = (await response.json()) as unknown;
  const urls = new Map<string, string>();
  if (!Array.isArray(data)) return urls;
  for (const entry of data) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'path' in entry &&
      'signedURL' in entry &&
      typeof entry.path === 'string' &&
      typeof entry.signedURL === 'string'
    ) {
      urls.set(entry.path, `${base}${entry.signedURL}`);
    }
  }
  return urls;
}

/** True when uploads can work; reads fall back to placeholders otherwise. */
export function isStorageConfigured(): boolean {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}
