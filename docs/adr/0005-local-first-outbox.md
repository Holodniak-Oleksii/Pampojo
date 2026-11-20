# 0005. Local database with an outbox for gym data

Date: 2026-11-08

## Context

Sessions happen without a network. iOS has no Background Sync. Lost or duplicated set logs would destroy trust.

## Decision

Gym data (catalog, workouts, plan, sessions, set logs, measurements) is mirrored in IndexedDB through Dexie. Local writes go to the local table and an outbox in one transaction. A custom sync engine pushes the outbox and pulls changes on app open, `online`, visibility change and session finish. The server applies mutations idempotently by mutation id.

## Consequences

- The UI reads from local data and is instant.
- We own a small sync engine instead of adopting a sync product (PowerSync, ElectricSQL, Replicache). That keeps the stack free and is a good engineering story, at the cost of writing and testing it.
- Conflicts are limited by design: set logs are append-mostly; editable rows use last write wins.
- Before spec 16, the same repository interface calls the API directly, so UI code does not change.

## Amendment (2026-11-15)

Sessions and set logs move to Dexie and the outbox in spec 10, ahead of spec 16. Until 16, the outbox replays the idempotent REST endpoints (`PUT`/`PATCH`/`DELETE` on `/sessions` and `/sets`) in order, and other repositories still call the API directly. Spec 16 switches the outbox to `/sync/push`, adds pull and the remaining entities.

## Amendment (2026-11-21)

The device keeps only the gym working set, not the whole catalog and history. Spec 16 implements this scope:

- Dexie keeps all live workouts, schedule rules, measurements, the profile and the gym profile.
- Dexie keeps the exercises that workouts and local sessions reference, and all own exercises. Offline search covers only these exercises.
- Dexie keeps the sessions of the last 30 days and every `in_progress` session. After a sync, the client deletes older synced sessions.
- Older history pages load on scroll into the query cache only.

The reason is that one month of history covers the gym, and the device keeps less data. Workouts, rules, own exercises, the profile and the gym profile stay REST writes. Sessions, set logs and measurements go through the outbox and `/sync/push`.
