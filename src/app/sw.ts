/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from 'serwist';
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
} from 'serwist';
import {
  IMAGES_CACHE,
  IMAGES_CACHE_MAX_ENTRIES,
  isAppPagePath,
  isSessionPagePath,
  OFFLINE_PATH,
  PAGES_CACHE,
  PAGES_RESET_KEY,
  PWA_META_CACHE,
  SESSION_SHELL_PATH,
  STAGED_AT_KEY,
  STAGED_PAGES_CACHE,
  STORAGE_OBJECT_PATH,
  WARM_PAGE_PATHS,
} from '@/features/pwa/constants';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isCompletePage = (response: Response) =>
  response.status === 200 &&
  !response.redirected &&
  (response.headers.get('content-type') ?? '').includes('text/html');

// Only complete HTML pages are kept: never a login redirect or an error.
const htmlOnly: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) => (isCompletePage(response) ? response : null),
};

const isPageRequest = (request: Request, url: URL) =>
  request.method === 'GET' && !url.searchParams.has('_rsc') && !request.headers.has('RSC');

// A session started offline has a new URL with no stored copy, so the shared session page opens it.
const sessionShell: SerwistPlugin = {
  handlerDidError: async () =>
    (await caches.match(SESSION_SHELL_PATH, { cacheName: PAGES_CACHE })) ??
    (await serwist.matchPrecache(OFFLINE_PATH)),
};

// A signed URL of an own image changes every hour, so the key drops the query and the image stays.
const imageKeyWithoutQuery: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    url.search = '';
    return url.href;
  },
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
    {
      matcher: ({ request, url }) =>
        request.method === 'GET' && url.pathname.includes(STORAGE_OBJECT_PATH),
      handler: new CacheFirst({
        cacheName: IMAGES_CACHE,
        plugins: [
          imageKeyWithoutQuery,
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: IMAGES_CACHE_MAX_ENTRIES, purgeOnQuotaError: true }),
        ],
      }),
    },
    { matcher: () => true, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: OFFLINE_PATH, matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

const STAGE_CONCURRENCY = 4;

/**
 * Loads this version of every cached page while the network is there: the browser installs a new
 * version only after it downloads it. The first launch after an update can be offline.
 */
async function stagePages(): Promise<void> {
  // First, so a logout at any later point is newer than this mark.
  const meta = await caches.open(PWA_META_CACHE);
  await meta.put(STAGED_AT_KEY, new Response(String(Date.now())));
  const current = await caches.open(PAGES_CACHE);
  const paths = new Set<string>(WARM_PAGE_PATHS);
  for (const request of await current.keys()) {
    const url = new URL(request.url);
    paths.add(url.pathname + url.search);
  }
  await caches.delete(STAGED_PAGES_CACHE);
  const staged = await caches.open(STAGED_PAGES_CACHE);
  const queue = [...paths];
  const worker = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      try {
        // A signed-out page redirects to login; following that redirect from install never ends.
        const response = await fetch(path, {
          credentials: 'same-origin',
          redirect: 'manual',
          headers: { accept: 'text/html' },
        });
        if (isCompletePage(response)) await staged.put(path, response);
      } catch {
        // The page is not staged; the app loads it again on its next online launch.
      }
    }
  };
  await Promise.all(Array.from({ length: STAGE_CONCURRENCY }, worker));
}

async function readTime(key: string): Promise<number | null> {
  const response = await caches.match(key, { cacheName: PWA_META_CACHE });
  return response ? Number(await response.text()) : null;
}

/**
 * Logout and a language switch clear the pages, but a staging request still running can store a
 * page after that. Staged pages are valid only if no clear happened after staging started.
 */
async function stagedPagesValid(): Promise<boolean> {
  const stagedAt = await readTime(STAGED_AT_KEY);
  const resetAt = await readTime(PAGES_RESET_KEY);
  return stagedAt !== null && (resetAt === null || resetAt < stagedAt);
}

/**
 * Cached pages point at the chunks of the build that rendered them, so the staged copies replace
 * them. The copy comes first: a stop half-way still leaves pages to open.
 */
async function promoteStagedPages(): Promise<void> {
  const valid = (await caches.has(STAGED_PAGES_CACHE)) && (await stagedPagesValid());
  if (!valid) {
    await Promise.all([caches.delete(PAGES_CACHE), caches.delete(STAGED_PAGES_CACHE)]);
    return;
  }
  const staged = await caches.open(STAGED_PAGES_CACHE);
  const pages = await caches.open(PAGES_CACHE);
  const keep = new Set<string>();
  for (const request of await staged.keys()) {
    const response = await staged.match(request);
    if (!response) continue;
    await pages.put(request, response);
    keep.add(request.url);
  }
  for (const request of await pages.keys()) {
    if (!keep.has(request.url)) await pages.delete(request);
  }
  await caches.delete(STAGED_PAGES_CACHE);
  // A logout during the copy came after the check above.
  if (!(await stagedPagesValid())) await caches.delete(PAGES_CACHE);
}

self.addEventListener('install', (event) => {
  // A failed stage must not stop the update.
  event.waitUntil(stagePages().catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(promoteStagedPages());
});
