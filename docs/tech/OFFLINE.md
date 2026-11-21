# Offline

Gyms are often in basements. The app must open, show today's workout and log a full session with no network, then sync without losing or duplicating anything.

## Building blocks

- **Web app manifest** — install to home screen, standalone display, icons. Spec 15.
- **Service worker** — Serwist (ADR 0008), production builds only.
  - It precaches the build output, `public/` and the `/offline` page.
  - It keeps visited app pages in `pampojo-pages`: network-first with a 4 s timeout, and `/offline` for pages never opened online. It never caches `/api`, auth or marketing pages.
  - Logout deletes `pampojo-pages`. A new version waits for the next launch and clears `pampojo-pages` when it activates.
  - Exercise images are runtime-cached in spec 17. Specs 15 and 17.
- **Dexie (IndexedDB)** — local copy of the user's data and the outbox. Spec 16.
- **Sync API** — `POST /api/v1/sync/push`, `GET /api/v1/sync/pull`. Spec 16.

## What is local

| Data | Local copy | Direction |
| --- | --- | --- |
| Workouts and their exercises | All workouts, deleted ones as tombstones | Pull; REST writes online |
| Schedule rules | All non-deleted rules | Pull; REST writes online |
| Exercises | Exercises in live workouts and local sessions, all own exercises; both locales | Pull; REST writes online |
| Sessions and set logs | Sessions of the last 30 days, plus every in-progress session | Push and pull |
| Last performance | Latest session and all-time bests per exercise of a live workout | Pull |
| Body measurements | All live measurements | Push and pull |
| Profile, gym profile | One row each | Pull; REST writes online |
| Share links, AI | No | Online only |

- The rest of the system catalog is online only. Offline, the library and the picker search only the local exercises.
- After a sync, the device deletes finished sessions older than 30 days that have nothing in the outbox.
- Online, calendar and progress use the server, merged with unsynced local sessions. Offline, they use the query cache or local data; the `1m` progress range is complete, other ranges and all-time records need the network.

## Offline rules

Allowed: view everything local, start and finish sessions, log and edit sets, swap exercises (deterministic suggestions), add measurements, use the rest timer.

Blocked: create or edit workouts and plans, custom exercise editing, the gym profile, sharing and importing by link, AI features, account and settings changes, and log out.

- A blocked control keeps its place and gets the dashed outline and the lucide `wifi-off` icon, with no text label. An icon-only control gets the icon in a corner badge.
- A tap shows the toast "Needs internet" and opens nothing. Desktop also shows a tooltip.
- `OnlineOnly` in `src/features/offline/` does this (spec 17).
- **Log out** is always blocked offline. Online with a non-empty outbox, a dialog offers "Sync now" and "Cancel". Logout continues after a sync that empties the outbox.

Offline, these pages open with no earlier visit: the main pages, the session shell, the page of each workout, the details of each exercise on the device and each measurement page. The app loads them into the page cache in the background.

## Status indicator

A pill in the top bar: `Online` / `Offline` and, when the outbox is not empty, a pending counter in both states. A tap opens the sync view: a bottom sheet on phones, a popover on desktop. It shows the state, the pending count, the last sync time, the last rejected change with its reason, and "Sync now" (blocked offline).

Detection: `navigator.onLine` plus a health ping. A request that fails with no answer starts a ping of `/api/v1/health` every 15 seconds. The app is offline until a ping gets any answer. The reason is that `onLine` can report true without real connectivity. `useIsOnline()` reads this store (`src/services/connectivity.ts`).

## Outbox and sync

1. Every local write runs in one Dexie transaction: update the local table and append a mutation `{ id, type, entityId, payload, createdAt }` to the outbox.
2. Sync runs on app open, on the `online` event, on `visibilitychange` to visible, after finishing a session, and on "Sync now". iOS has no Background Sync, so do not rely on it anywhere.
3. Push sends mutations in order, in batches. The server applies each one inside a transaction and records its id in `sync_mutation`; a replayed id is acknowledged without re-applying. Acknowledged mutations are removed locally.
4. Pull fetches rows changed since the last cursor (`updatedAt`, `id`) and upserts them locally, including tombstones (`deletedAt`).

## Conflicts

- Set logs and sessions are created on one device and append-mostly: conflicts are rare by design.
- For editable rows, last write wins on `updatedAt`, applied per row.
- A mutation for a row the user no longer owns or that was deleted is acknowledged and dropped; the client shows a notice if it affected visible data.

## Storage limits

- Call `navigator.storage.persist()` after install; show the install guide on iOS, because non-installed Safari storage is small and can be evicted after inactivity.
- The server is the source of truth. Losing local data costs a re-download, never history, as long as the outbox was synced.
- The service worker caches the images of the exercises in the user's workouts and local sessions, cache-first, up to 600 entries. The cache key has no query, so an own image stays after its signed URL expires. Missing image → placeholder with the exercise name. Logout deletes the image cache.

## Rest timer

Store `restEndsAt` (timestamp), not remaining seconds. On resume, recompute. A sound or notification when the screen is locked is not reliable for a PWA on iOS; we show the result when the user returns. Wake Lock keeps the screen on during a session where the browser supports it.

## Testing

- Playwright with `context.setOffline(true)` for the full session flow.
- Unit tests for the outbox: ordering, batching, idempotent replay, partial failure.
- Manual check on a real iPhone (installed PWA) before closing spec 17.
