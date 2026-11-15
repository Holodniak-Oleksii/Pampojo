import { PAGES_CACHE } from './constants';

/** Cached pages hold the signed-in user's data, so they go with the session. */
export async function deletePageCaches(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete(PAGES_CACHE);
  } catch {
    // Cache storage unavailable: there is nothing cached to remove.
  }
}
