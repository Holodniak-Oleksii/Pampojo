import { IMAGES_CACHE, PAGES_CACHE } from './constants';

/** Cached pages and own exercise images hold the signed-in user's data, so they go with the session. */
export async function deletePageCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      await Promise.all([caches.delete(PAGES_CACHE), caches.delete(IMAGES_CACHE)]);
    }
  } catch {
    // Cache storage unavailable: there is nothing cached to remove.
  }
}
