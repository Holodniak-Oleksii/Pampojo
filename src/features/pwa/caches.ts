import { IMAGES_CACHE, PAGES_CACHE, STAGED_PAGES_CACHE } from './constants';

/** Cached pages and own exercise images hold the signed-in user's data, so they go with the session. */
export async function deletePageCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      await Promise.all(
        [PAGES_CACHE, STAGED_PAGES_CACHE, IMAGES_CACHE].map((name) => caches.delete(name)),
      );
    }
  } catch {
    // Cache storage unavailable: there is nothing cached to remove.
  }
}

/**
 * Cached pages hold the language they were rendered in. The network-first rule serves the cached
 * copy after 4 s, so after a language switch a slow network would show the old language.
 */
export async function deleteAppPages(): Promise<void> {
  try {
    if ('caches' in window) {
      await Promise.all([PAGES_CACHE, STAGED_PAGES_CACHE].map((name) => caches.delete(name)));
    }
  } catch {
    // Cache storage unavailable: there is nothing cached to remove.
  }
}
