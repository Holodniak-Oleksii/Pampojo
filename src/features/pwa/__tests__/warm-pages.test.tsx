import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exerciseDetailPaths, warmMissingPages, warmPages } from '..';
import { PAGES_CACHE, SESSION_SHELL_PATH, WARM_PAGE_PATHS } from '../constants';

const fetchMock = vi.fn<typeof fetch>(async () => new Response('<html></html>'));

function controlled(controller: object | null) {
  vi.spyOn(navigator, 'serviceWorker', 'get').mockReturnValue({
    controller,
  } as unknown as ServiceWorkerContainer);
}

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('warmPages (spec 14 AC16)', () => {
  it('requests each details page as HTML once', async () => {
    controlled({});
    await warmPages(exerciseDetailPaths(['a', 'b', 'a']));
    expect(fetchMock.mock.calls).toEqual([
      ['/library/exercises/a', { credentials: 'same-origin', headers: { accept: 'text/html' } }],
      ['/library/exercises/b', { credentials: 'same-origin', headers: { accept: 'text/html' } }],
    ]);
  });

  it('does nothing offline or without a service worker', async () => {
    controlled(null);
    await warmPages(['/library/exercises/a']);
    controlled({});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await warmPages(['/library/exercises/a']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a failed request', async () => {
    controlled({});
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(warmPages(['/a', '/b'])).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('warmMissingPages (spec 16 AC1)', () => {
  afterEach(async () => {
    await caches.delete(PAGES_CACHE);
  });

  it('requests only the app pages that the page cache does not hold', async () => {
    controlled({});
    const cache = await caches.open(PAGES_CACHE);
    await cache.put('/today', new Response('<html></html>'));
    await cache.put('/calendar?view=list', new Response('<html></html>'));
    await warmMissingPages();
    const requested = fetchMock.mock.calls.map(([path]) => path);
    expect(requested).toEqual(
      WARM_PAGE_PATHS.filter((path) => path !== '/today' && path !== '/calendar'),
    );
    expect(requested).toContain(SESSION_SHELL_PATH);
  });

  it('does nothing without a service worker', async () => {
    controlled(null);
    await warmMissingPages();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
