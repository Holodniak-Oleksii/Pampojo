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

/** Loads the app pages that the page cache does not hold yet, for example after a new version. */
export function warmMissingPages(): Promise<void> {
  warming ??= warmMissing().finally(() => {
    warming = null;
  });
  return warming;
}

async function warmMissing(): Promise<void> {
  if (typeof caches === 'undefined' || !navigator.serviceWorker?.controller) return;
  try {
    const cache = await caches.open(PAGES_CACHE);
    const missing: string[] = [];
    for (const path of WARM_PAGE_PATHS) {
      if (!(await cache.match(path, { ignoreSearch: true }))) missing.push(path);
    }
    await warmPages(missing);
  } catch {
    // Cache storage unavailable: the pages open offline only after a visit.
  }
}
