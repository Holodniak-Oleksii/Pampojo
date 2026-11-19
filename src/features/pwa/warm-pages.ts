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
