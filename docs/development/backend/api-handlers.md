---
title: API handlers
---

Route handlers live in `src/app/api/v1/<resource>/route.ts`. Public contract: `docs/tech/API.md`.

## Shape

Every handler goes through `withHandler` from `src/server/http/handler.ts`. It resolves the session, parses params, query and body with Zod, maps domain errors to HTTP, and logs unexpected errors.

```ts
// src/app/api/v1/workouts/[id]/route.ts
export const PATCH = withHandler(
  { auth: 'required', params: idParamsSchema, body: updateWorkoutInputSchema },
  async ({ userId, params, body }) => {
    const workout = await workoutService.update(userId, params.id, body);
    return json(workout);
  },
);
```

A handler does not contain business rules, SQL, or calls to more than one service function.

## Errors

- Services throw `DomainError` with a code from the domain's `errors.ts` (`WORKOUT_NOT_FOUND`, `SHARE_LINK_EXPIRED`). `withHandler` maps codes to statuses through one table in `src/server/http/errors.ts`.
- Response body: `{ "error": { "code", "message", "details"? } }`. `message` is for logs and developers; the UI shows text based on `code`.
- Unexpected errors return 500 with code `INTERNAL` and no internals in the body.
- Not owned is not found: return 404, never 403, for another user's row.

## Auth

- `auth: 'required'` for everything under `/api/v1` except the share preview (`GET /api/v1/share/{token}`) and health.
- The handler passes `userId` to the service. Services never trust a `userId` from the body.

## Validation

- Every input is a Zod schema in `src/shared/schemas`, also used by the client.
- Strip unknown keys (`.strict()` on bodies), cap string lengths and array sizes, so a client cannot store megabytes in a name.

## Writes

Creates and actions follow `docs/development/request-safety.md`. A handler for a non-idempotent action declares `idempotency: true` in `withHandler` options.

## Rate limits

AI endpoints and share-link creation are rate limited per user (spec 20 decides the store). Return 429 with a `Retry-After` header.

## Caching

Responses with user data send `Cache-Control: private, no-store`. Public catalog media is served from Storage with long cache headers.
