/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from 'serwist';
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist';
import {
  isAppPagePath,
  isSessionPagePath,
  OFFLINE_PATH,
  PAGES_CACHE,
  SESSION_SHELL_PATH,
} from '@/features/pwa/constants';

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

const isPageRequest = (request: Request, url: URL) =>
  request.method === 'GET' && !url.searchParams.has('_rsc') && !request.headers.has('RSC');

// A session started offline has a new URL with no stored copy, so the shared session page opens it.
const sessionShell: SerwistPlugin = {
  handlerDidError: async () =>
    (await caches.match(SESSION_SHELL_PATH, { cacheName: PAGES_CACHE })) ??
    (await serwist.matchPrecache(OFFLINE_PATH)),
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
        sameOrigin && isPageRequest(request, url) && isSessionPagePath(url.pathname),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 4,
        plugins: [htmlOnly, sessionShell],
      }),
    },
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && isPageRequest(request, url) && isAppPagePath(url.pathname),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE,
        networkTimeoutSeconds: 4,
        // The pages read their query on the client, so one copy serves every query.
        matchOptions: { ignoreSearch: true },
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
