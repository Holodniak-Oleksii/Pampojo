/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist';
import { isAppPagePath, OFFLINE_PATH, PAGES_CACHE } from '@/features/pwa/constants';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Only complete HTML pages are kept: never a login redirect or an error.
const htmlOnly: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) =>
    response.status === 200 &&
    !response.redirected &&
    (response.headers.get('content-type') ?? '').includes('text/html')
      ? response
      : null,
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version waits for the next launch, so a running workout is never reloaded.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.method === 'GET' &&
        isAppPagePath(url.pathname) &&
        !url.searchParams.has('_rsc') &&
        !request.headers.has('RSC'),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 4,
        plugins: [htmlOnly],
      }),
    },
    { matcher: () => true, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PATH, matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

// Cached pages point at the chunks of the build that rendered them, so a new version starts clean.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(PAGES_CACHE));
});
