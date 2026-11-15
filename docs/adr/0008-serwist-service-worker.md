# 0008. Serwist for the service worker, through its Turbopack route

Date: 2026-11-15

## Context

Spec 15 needs a service worker:

- precache the build output and an offline page;
- serve visited app pages offline;
- update without interrupting a workout.

Next 16 builds with Turbopack, which has no build plugins. The classic `@serwist/next` plugin needs webpack, and the app runs with `cacheComponents: true`.

## Decision

- **Integration:** use `@serwist/turbopack` 9.5 with `serwist` 9.5, plus `esbuild` (dev) to bundle the worker.
  - A route handler (`src/app/serwist/[path]/route.ts`) builds and serves `/serwist/sw.js` at build time, with the precache manifest injected.
  - The worker source is `src/app/sw.ts`.
  - `withSerwist` wraps `next.config.ts`.
- **Spike:** a production build with `cacheComponents: true` built 64 precache entries, and served `/serwist/sw.js` with `Service-Worker-Allowed: /` through the existing `proxy.ts` matcher.
- **Caching:** the worker defines its own runtime caching instead of `defaultCache`:
  - app pages network-first into one pages cache;
  - `/api`, auth and marketing pages network-only;
  - a document fallback to `/offline`.
- **Updates:** `skipWaiting: false` and `clientsClaim: true`.
  - A new version waits for the next launch.
  - The first install still controls the page without a reload.
- **Registration:** `SerwistProvider` from `@serwist/turbopack/react`, disabled outside production, with `reloadOnOnline={false}` so a returning connection never reloads a running session.

## Consequences

- No hand-written precache list or revisioning. The build output is the manifest.
- Three new dev dependencies (`@serwist/turbopack`, `serwist`, `esbuild`). `esbuild` runs only during `next build`.
- The service worker exists only in production builds. Its e2e tests run against `next start` (CI, or `CI=1` locally after `pnpm build`).
- Cached pages reference the chunks of their build. The worker deletes the pages cache when a new version activates, so stale HTML never points at missing chunks.
- If Serwist stops supporting the Turbopack route, the fallback is the hand-written worker from the Next.js PWA guide with the same caching rules.
