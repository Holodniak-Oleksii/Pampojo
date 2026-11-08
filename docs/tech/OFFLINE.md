# Offline

Gyms are often in basements. The app must open, show today's workout and log a full session with no network, then sync without losing or duplicating anything.

## Building blocks

- **Web app manifest** — install to home screen, standalone display, icons. Spec 15.
- **Service worker** — precaches the app shell; runtime-caches exercise images. Spec 15, 17.
- **Dexie (IndexedDB)** — local copy of the user's data and the outbox. Spec 16.
- **Sync API** — `POST /api/v1/sync/push`, `GET /api/v1/sync/pull`. Spec 16.

## What is local

| Data | Local | Direction |
| --- | --- | --- |
| Exercise catalog (system + own) | Yes | Pull |
| Workouts and their exercises | Yes (read-only offline) | Pull |
| Schedule rules | Yes (read-only offline) | Pull |
| Sessions and set logs | Yes | Push and pull |
| Body measurements | Yes | Push and pull |
| Profile, gym profile | Yes (read-only offline) | Pull |
| Share links, AI | No | Online only |

## Offline rules

Allowed: view everything local, start and finish sessions, log and edit sets, swap exercises (deterministic suggestions), add measurements, use the rest timer.

Blocked, with the control disabled and the hint "Needs internet": create or edit workouts and plans, custom exercise editing, sharing and importing by link, AI features, account and settings changes. **Log out** is blocked while the outbox is not empty; the dialog explains that unsynced sessions would be lost.

## Status indicator

A pill in the top bar: `Online` / `Offline` and, when the outbox is not empty, `3 changes pending`. Tapping it opens a small sheet with the last sync time and a "Sync now" button (online only). Detection: `navigator.onLine` plus a lightweight ping on failure, because `onLine` can report true without real connectivity.

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
- Cache images only for exercises in upcoming workouts (next 14 days of the plan plus the last used ones), compressed WebP. Missing image → placeholder with the exercise name.

## Rest timer

Store `restEndsAt` (timestamp), not remaining seconds. On resume, recompute. A sound or notification when the screen is locked is not reliable for a PWA on iOS; we show the result when the user returns. Wake Lock keeps the screen on during a session where the browser supports it.

## Testing

- Playwright with `context.setOffline(true)` for the full session flow.
- Unit tests for the outbox: ordering, batching, idempotent replay, partial failure.
- Manual check on a real iPhone (installed PWA) before closing spec 17.
