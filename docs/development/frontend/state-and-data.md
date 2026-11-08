---
title: State and data
---

State lives in four places. Pick by where the truth is.

| Truth | Tool | Location |
| --- | --- | --- |
| Server, needs network (builder, sharing, AI, settings) | TanStack Query | `src/api/<domain>.ts` |
| On the device, works offline (sessions, sets, measurements, catalog copy) | Dexie + `useLiveQuery` through repositories | `src/services/local-db/` (spec 16) |
| UI state shared across components (open sheet, active tab, session UI) | Zustand | `src/stores/` |
| One component | `useState` | the component |
| Form | React Hook Form + Zod resolver | the form component |

Do not copy server data into a Zustand store. You would own caching, staleness and deduplication by hand, and two screens would disagree. Derived values are computed in selectors or `useMemo`, not stored.

## TanStack Query

- Each domain file exports query keys, fetchers and hooks: `workoutKeys`, `fetchWorkouts`, `useWorkoutsQuery`, `useUpdateWorkoutMutation`.
- Keys are arrays built by a key factory: `workoutKeys.detail(id)`. Never hand-write key arrays at call sites.
- A mutation invalidates exactly the keys it affects, and only on success.
- Disable a query until its input exists: `enabled: Boolean(id)`. A request with `undefined` in the URL is a bug.
- When the call site must react to failure, use `mutateAsync` inside `try/catch`, or the `onError` callback. Do not assume success.
- The `QueryClient` defaults live in `src/api/query-client.ts`; tests create their own client with retries off.

## Repositories (gym data)

Screens that must work offline call a repository, never `fetch` directly:

```ts
export interface SessionRepository {
  start(input: StartSessionInput): Promise<Session>;
  logSet(input: LogSetInput): Promise<SetLog>;
  finish(sessionId: string): Promise<void>;
  useSession(sessionId: string): Session | undefined;
}
```

Before spec 16 the implementation calls the API. Spec 16 replaces it with Dexie + outbox. UI code does not change. Every write generates its id on the client (`crypto.randomUUID()`).

## Zustand

- One store per concern (`useSessionUiStore`, `useConnectivityStore`), small and typed.
- Select narrow slices: `useSessionUiStore((s) => s.restEndsAt)`. Selecting the whole store re-renders on every change.
- Persist only small preferences, through the `persist` middleware with a `version` and `migrate`. Never persist server data.

## Transport

All API calls go through `src/api/http.ts`:

- adds JSON headers, parses the error envelope into an `ApiError` with `code`,
- retries only safe cases: network errors and 408/503, at most 2 times, exponential backoff with jitter,
- retries a write only if it is idempotent (`PUT` with a client id, or a request carrying `Idempotency-Key`). See `docs/development/request-safety.md`.

Do not disable retries to avoid duplicate writes; make the write idempotent instead.

## Forms

React Hook Form with `zodResolver` and the shared schema. Show field errors under the field; disable submit while submitting; keep form state out of stores.
