import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import { openLocalDb, type PampojoDb } from '@/services/local-db';
import { enqueue } from '@/services/local-db/outbox';
import type { SyncMutation } from '@/shared/schemas/sync';
import { resetLocalDbs } from '@/test/local-session';
import { readSyncMeta } from '../meta';
import { pushOutbox } from '../push';

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

async function fill(db: PampojoDb, count: number) {
  for (let index = 0; index < count; index += 1) {
    await enqueue(db, { type: SYNC_MUTATION_TYPE.SET_DELETE, entityId: crypto.randomUUID() });
  }
}

/** A server double that answers each mutation with `status(mutation)` and records the batches. */
function server(status: (mutation: SyncMutation) => string = () => 'applied') {
  const batches: SyncMutation[][] = [];
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const { mutations } = JSON.parse(String(init?.body)) as { mutations: SyncMutation[] };
    batches.push(mutations);
    return Response.json({
      results: mutations.map((item) => {
        const result = status(item);
        return result === 'rejected'
          ? { id: item.id, status: result, error: 'VALIDATION_FAILED' }
          : { id: item.id, status: result };
      }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { batches, fetchMock };
}

describe('pushOutbox', () => {
  it('sends entries in seq order, at most 50 per request, and empties the outbox (AC7)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await fill(db, 120);
    const expected = (await db.outbox.orderBy('seq').toArray()).map((entry) => entry.id);
    const { batches } = server();
    expect(await pushOutbox(db)).toBe('done');
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(batches.flat().map((item) => item.id)).toEqual(expected);
    expect(await db.outbox.count()).toBe(0);
  });

  it('deletes a rejected entry, saves lastError and keeps going (AC8)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await fill(db, 3);
    const [, second] = await db.outbox.orderBy('seq').toArray();
    server((item) => (item.id === second?.id ? 'rejected' : 'applied'));
    const rejected = vi.fn();
    expect(await pushOutbox(db, { onRejected: rejected })).toBe('done');
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ id: second?.id }),
      'VALIDATION_FAILED',
    );
    expect(await db.outbox.count()).toBe(0);
    expect((await readSyncMeta(db)).lastError?.code).toBe('VALIDATION_FAILED');
  });

  it('keeps every entry and counts attempts on a 503 (AC9)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await fill(db, 2);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: { code: 'INTERNAL' } }, { status: 503 })),
    );
    expect(await pushOutbox(db)).toBe('failed');
    const entries = await db.outbox.toArray();
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.attempts === 1)).toBe(true);
  });

  it('retries a batch whose response was lost and acknowledges it as duplicate (AC4)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await fill(db, 2);
    const applied = new Set<string>();
    let applies = 0;
    let lose = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { mutations } = JSON.parse(String(init?.body)) as { mutations: SyncMutation[] };
        const results = mutations.map((item) => {
          if (applied.has(item.id)) return { id: item.id, status: 'duplicate' };
          applied.add(item.id);
          applies += 1;
          return { id: item.id, status: 'applied' };
        });
        // The server applied the batch, but the app stopped before it read the answer.
        if (lose) {
          lose = false;
          throw new TypeError('Failed to fetch');
        }
        return Response.json({ results });
      }),
    );
    expect(await pushOutbox(db)).toBe('failed');
    expect(await db.outbox.count()).toBe(2);
    expect(await pushOutbox(db)).toBe('done');
    expect(await db.outbox.count()).toBe(0);
    expect(applies).toBe(2);
  });

  it('stops instead of resending a batch that the server did not fully answer', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await fill(db, 2);
    const [first] = await db.outbox.orderBy('seq').toArray();
    const fetchMock = vi.fn(async () =>
      Response.json({ results: [{ id: first!.id, status: 'applied' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await pushOutbox(db)).toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(1);
  });
});
