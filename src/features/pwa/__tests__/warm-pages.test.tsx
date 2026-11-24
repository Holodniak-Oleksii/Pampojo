import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exerciseDetailPaths, warmMissingPages, warmPages } from '..';
import { MEASUREMENT_TYPES } from '@/constants/measurement';
import { openLocalDb } from '@/services/local-db';
import { localExercise } from '@/test/local-data';
import { resetLocalDbs } from '@/test/local-session';
import { IMAGES_CACHE, PAGES_CACHE, SESSION_SHELL_PATH, WARM_PAGE_PATHS } from '../constants';
import { offlineTargets } from '../offline-targets';
import { warmExerciseImages } from '../warm-images';

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
  const page = (lang: string) => new Response(`<!DOCTYPE html><html lang="${lang}"></html>`);

  beforeEach(() => {
    document.documentElement.lang = 'uk';
  });

  afterEach(async () => {
    await caches.delete(PAGES_CACHE);
  });

  it('requests only the app pages that the page cache does not hold', async () => {
    controlled({});
    const cache = await caches.open(PAGES_CACHE);
    await cache.put('/today', page('uk'));
    await cache.put('/calendar?view=list', page('uk'));
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

  it('also requests the pages of the user data (spec 17 AC6)', async () => {
    controlled({});
    const cache = await caches.open(PAGES_CACHE);
    for (const path of WARM_PAGE_PATHS) await cache.put(path, page('uk'));
    await cache.put('/library/workouts/a', page('uk'));
    await warmMissingPages(['/library/workouts/a', '/library/exercises/b']);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/library/exercises/b']);
  });

  it('requests again a page cached in another language', async () => {
    controlled({});
    const cache = await caches.open(PAGES_CACHE);
    for (const path of WARM_PAGE_PATHS) await cache.put(path, page('uk'));
    await cache.put('/today', page('en'));
    await warmMissingPages();
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/today']);
  });
});

describe('offlineTargets (spec 17 AC6, AC9)', () => {
  afterEach(async () => {
    await resetLocalDbs();
  });

  it('lists live workouts, live exercises, measurement types and the images in use', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const used = localExercise('Bench Press', {
      frames: [{ id: null, thumbUrl: 'https://s/t1.webp', fullUrl: 'https://s/f1.webp' }],
    });
    const unused = localExercise('Plank', {
      frames: [{ id: null, thumbUrl: 'https://s/t2.webp', fullUrl: 'https://s/f2.webp' }],
    });
    const gone = localExercise('Old', { deletedAt: '2026-11-01T10:00:00.000Z' });
    await db.exercises.bulkPut([used, unused, gone]);
    const exercise = {
      id: crypto.randomUUID(),
      exerciseId: used.id,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetWeightKg: null,
      targetDurationSec: null,
      targetDistanceM: null,
      notes: null,
    };
    await db.workouts.bulkPut([
      {
        id: 'w1',
        name: 'Push',
        description: null,
        updatedAt: '',
        deletedAt: null,
        exercises: [exercise],
      },
      {
        id: 'w2',
        name: 'Gone',
        description: null,
        updatedAt: '',
        deletedAt: '2026-11-01',
        exercises: [],
      },
    ]);

    const targets = await offlineTargets(db);
    // Dexie returns rows in key order, so the test does not depend on it.
    expect([...targets.paths].sort()).toEqual(
      [
        '/library/workouts/w1',
        `/library/exercises/${used.id}`,
        `/library/exercises/${unused.id}`,
        ...MEASUREMENT_TYPES.map((type) => `/profile/measurements/${type}`),
      ].sort(),
    );
    expect(targets.imageUrls).toEqual(['https://s/t1.webp', 'https://s/f1.webp']);
  });
});

describe('warmExerciseImages (spec 17 AC9)', () => {
  afterEach(async () => {
    await caches.delete(IMAGES_CACHE);
  });

  it('fetches only the images the cache misses, ignoring the signature', async () => {
    controlled({});
    const cache = await caches.open(IMAGES_CACHE);
    await cache.put('https://s.example/own/a.webp', new Response('img'));
    await warmExerciseImages([
      'https://s.example/own/a.webp?token=new',
      'https://s.example/b.webp',
      'https://s.example/b.webp',
    ]);
    expect(fetchMock.mock.calls).toEqual([['https://s.example/b.webp', { mode: 'cors' }]]);
  });

  it('runs at most 4 requests at a time and nothing offline', async () => {
    controlled({});
    let active = 0;
    let peak = 0;
    fetchMock.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response('img');
    });
    await warmExerciseImages(
      Array.from({ length: 10 }, (_, index) => `https://s.example/${index}.webp`),
    );
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(peak).toBe(4);

    fetchMock.mockClear();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await warmExerciseImages(['https://s.example/x.webp']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
