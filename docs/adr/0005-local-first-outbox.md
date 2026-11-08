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
