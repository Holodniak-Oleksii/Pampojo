import { describe, expect, it } from 'vitest';
import { deletePageCaches } from '../caches';

describe('deletePageCaches (AC5)', () => {
  it('removes the cached app pages and keeps other caches', async () => {
    await (await caches.open('pampojo-pages')).put('/today', new Response('page'));
    await caches.open('other');
    await deletePageCaches();
    expect(await caches.has('pampojo-pages')).toBe(false);
    expect(await caches.has('other')).toBe(true);
    await caches.delete('other');
  });
});
