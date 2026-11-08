---
title: Request safety
---

A client may send the same write twice: a retry after a timeout whose response was lost, a double tap, or an outbox replay after the app was killed mid-sync. The server may already have committed the first one. Every write must therefore be safe to repeat.

## Rules

1. **Creates from the client use client ids.** The client generates a UUID and calls `PUT /resource/{id}`. The server upserts: a second identical call finds the row and returns it. This covers sessions, set logs, measurements, workouts and schedule rules.
2. **Non-idempotent actions carry `Idempotency-Key`.** Actions without a natural id (import a shared workout, create a share link, AI generation) send a UUID header generated once per user intent and reused on every retry. The server stores `(userId, key) → response` for 24 hours and returns the stored response on a repeat. `withHandler({ idempotency: true })` does this.
3. **Sync mutations are idempotent by mutation id.** `sync_mutation` records applied ids; a replay is acknowledged without being applied again.
4. **Counters and order changes use single statements or row locks**, never read-modify-write in application code.

## Client side

- Retries happen in `src/api/http.ts` only for network errors and 408/503, at most twice, with backoff and jitter.
- The retry re-sends the same request object, so the `Idempotency-Key` header travels with it. Never regenerate the key on retry.
- Buttons that trigger writes are disabled while the request is in flight; that reduces duplicates but does not replace the rules above.

## Testing

Every write endpoint test includes "same request twice → one effect".
