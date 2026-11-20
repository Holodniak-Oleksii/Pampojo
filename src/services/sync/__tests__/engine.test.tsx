import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import { closeLocalDbs, PampojoDb } from '@/services/local-db/db';
import { enqueue } from '@/services/local-db/outbox';
import { resetLocalDbs } from '@/test/local-session';
import { syncNow } from '../engine';

afterEach(async () => {
  vi.unstubAllGlobals();
  closeLocalDbs();
  await resetLocalDbs();
});

describe('syncNow', () => {
  it('returns busy and sends nothing while another tab syncs the same database (AC6)', async () => {
    const name = `pampojo-${crypto.randomUUID()}`;
    // Two connections stand for two tabs; the in-tab guard does not see the other one.
    const tabA = new PampojoDb(name);
    const tabB = new PampojoDb(name);
    await enqueue(tabA, { type: SYNC_MUTATION_TYPE.SET_DELETE, entityId: crypto.randomUUID() });
    let release: () => void = () => {};
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
      // Only the push waits; the pull after it fails at once, which ends the sync.
      !String(input).includes('/sync/push')
        ? Promise.reject(new TypeError('offline'))
        : new Promise<Response>((resolve) => {
            const { mutations } = JSON.parse(String(init?.body ?? '{"mutations":[]}')) as {
              mutations: { id: string }[];
            };
            release = () =>
              resolve(
                Response.json({
                  results: mutations.map((item) => ({ id: item.id, status: 'applied' })),
                }),
              );
          }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const first = syncNow(tabA);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await syncNow(tabB)).toBe('busy');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    expect(await first).toBe('failed');
    tabA.close();
    tabB.close();
  });
});
