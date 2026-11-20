import { PAGES_CACHE, WARM_PAGE_PATHS } from './constants';

/**
 * Loads app pages once in the background, so the service worker keeps their HTML for offline use.
 * Requests without the RSC header match the network-first page rule in `src/app/sw.ts`.
 */
export async function warmPages(paths: readonly string[]): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.onLine) return;
  if (!navigator.serviceWorker?.controller) return;
  for (const path of paths) {
    try {
      await fetch(path, { credentials: 'same-origin', headers: { accept: 'text/html' } });
    } catch {
      // A failed warm-up only means the page is not cached; the session goes on.
    }
  }
}

export function exerciseDetailPaths(exerciseIds: readonly string[]): string[] {
  return [...new Set(exerciseIds)].map((id) => `/library/exercises/${id}`);
}

let warming: Promise<void> | null = null;
let queued: readonly string[] | null = null;

/**
 * Loads the app pages that the page cache does not hold yet, for example after a new version.
 * `extraPaths` are the pages of the user's own data (spec 17). A call during a run waits for it.
 */
export function warmMissingPages(extraPaths: readonly string[] = []): Promise<void> {
  if (warming) {
    queued = extraPaths;
    return warming;
  }
  warming = warmMissing(extraPaths).finally(() => {
    warming = null;
    const next = queued;
    queued = null;
    if (next) void warmMissingPages(next);
  });
  return warming;
}

async function warmMissing(extraPaths: readonly string[]): Promise<void> {
  if (typeof caches === 'undefined' || !navigator.serviceWorker?.controller) return;
  try {
    const cache = await caches.open(PAGES_CACHE);
    const missing: string[] = [];
    for (const path of new Set([...WARM_PAGE_PATHS, ...extraPaths])) {
      if (!(await cache.match(path, { ignoreSearch: true }))) missing.push(path);
    }
    await warmPages(missing);
  } catch {
    // Cache storage unavailable: the pages open offline only after a visit.
  }
}
