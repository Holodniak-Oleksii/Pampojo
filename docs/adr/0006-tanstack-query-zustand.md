# 0006. TanStack Query for server state, Zustand for UI state

Date: 2026-11-08

## Context

The reference architecture separates server data (a query cache) from UI state (a store). It uses RTK Query and Redux in a large app. Pampojo is smaller and mixes online data with local IndexedDB data.

## Decision

Keep the separation, with lighter tools: TanStack Query for online server data, Zustand for shared UI state, Dexie live queries for local gym data.

## Consequences

- The rule "server data is never copied into a store" still holds.
- Less boilerplate than Redux Toolkit; no global store wiring.
- Patterns from the reference (key factories, invalidation on success, typed selectors, versioned persistence) carry over; see `docs/development/frontend/state-and-data.md`.
