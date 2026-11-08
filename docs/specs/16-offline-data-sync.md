# 16. Offline data and sync

## Goal

Everything needed in the gym lives on the device, sessions work with no network, and changes sync to the server without loss or duplicates. Design: `docs/tech/OFFLINE.md`, ADR 0005.

## Scope

- Dexie database in `src/services/local-db/` with tables mirroring the gym data and an `outbox` table; versioned schema with migrations.
- Repositories for catalog, workouts, schedule rules, sessions, set logs, measurements, profile: reads via `useLiveQuery`; writes in one transaction with an outbox entry. Replace the online implementations from earlier specs behind the same interfaces.
- Sync engine in `src/services/sync/`: triggers (open, `online`, visible, session finish, manual), push in ordered batches, pull since cursor, backoff on failure, single-flight lock across tabs (Web Locks or BroadcastChannel).
- Server: `POST /api/v1/sync/push` (apply mutations in order in a transaction per batch, record ids in `sync_mutation`, return per-mutation result), `GET /api/v1/sync/pull?since=` (changed rows including tombstones, paginated).
- Initial download after login with a progress indicator; incremental after that.
- Logging out clears the local database (guard in 17).

## Out of scope

UX around offline (status count, blocked actions, logout guard, images) — spec 17.

## Acceptance criteria

- [ ] AC1: With the network off, a user can start a planned workout, log all sets, finish, and see it in history and progress (from local data).
- [ ] AC2: Back online, the outbox empties and the server has exactly the same sessions and sets (e2e with `setOffline`).
- [ ] AC3: Replaying a push batch produces no duplicates (server test).
- [ ] AC4: Killing the app mid-push and reopening completes the sync without duplicates or losses.
- [ ] AC5: Two devices: a workout edited on one appears on the other after its next pull; a deleted one disappears.
- [ ] AC6: Two tabs never push concurrently.
- [ ] AC7: Unit tests cover outbox ordering, batching, partial failure and retry.

## Depends on

10–14, 15.

## Open questions

- If spec 10 already built the local layer (see its open question), this spec shrinks to sync for the remaining entities.
