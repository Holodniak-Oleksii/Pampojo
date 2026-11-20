import { IMAGES_CACHE } from './constants';

const PARALLEL = 4;

const withoutQuery = (url: string) => url.split('?')[0] ?? url;

/**
 * Loads exercise images in the background, so the service worker keeps them for offline use.
 * The cache key has no query, so an own image keeps its key after the signed URL expires.
 */
export async function warmExerciseImages(urls: readonly string[]): Promise<void> {
  if (typeof caches === 'undefined' || !navigator.onLine) return;
  if (!navigator.serviceWorker?.controller) return;
  let cache: Cache;
  try {
    cache = await caches.open(IMAGES_CACHE);
  } catch {
    return;
  }
  const missing: string[] = [];
  for (const url of new Set(urls)) {
    if (!(await cache.match(withoutQuery(url), { ignoreSearch: true }))) missing.push(url);
  }
  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const url = missing[next++]!;
      try {
        await fetch(url, { mode: 'cors' });
      } catch {
        // A failed image shows the placeholder offline; the next warm-up tries again.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, missing.length) }, worker));
}
