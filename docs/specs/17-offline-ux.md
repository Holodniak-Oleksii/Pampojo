# 17. Offline UX

## Goal

The user always knows whether they are online, what is waiting to sync, and why an action is unavailable.

## Scope

- `useConnectivity()` hook and store: `navigator.onLine` plus a health ping on request failures.
- `StatusPill` shows Online / Offline and "N changes pending" from the outbox count; tap opens a sheet with last sync time, pending count, "Sync now" (online only), last error if any.
- `OnlineOnly` wrapper / `useRequiresOnline()` to disable controls offline with the hint "Needs internet" (tooltip on desktop, inline text on mobile). Apply to the list in `OFFLINE.md`.
- Logout guard: with a non-empty outbox, the dialog explains that unsynced sessions will be lost and offers "Sync now" (online) or "Cancel"; logout is not possible offline with pending changes.
- Image caching: service worker runtime cache for exercise images of workouts planned in the next 14 days and the last 10 used; cache-first with a size cap; placeholder on miss.
- Session finish offline shows "Saved on this device. Will sync when online."

## Acceptance criteria

- [ ] AC1: Going offline switches the pill within 2 seconds; logging a set shows "1 change pending".
- [ ] AC2: Every action listed as online-only is disabled offline with the hint, and re-enabled online.
- [ ] AC3: Logout with pending changes is blocked offline and offers sync online.
- [ ] AC4: Images of planned exercises show offline after one online visit; others show the placeholder.
- [ ] AC5: Real iPhone check: installed PWA, airplane mode, full session, reopen online, data synced (review screenshots).

## Depends on

16.
