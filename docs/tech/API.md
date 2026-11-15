# API

JSON over HTTPS under `/api/v1`. Auth by Better Auth session cookie. Conventions for writing handlers: `docs/development/backend/api-handlers.md`. Request and response bodies are Zod schemas in `src/shared/schemas`; this page lists the surface, the schemas are the contract.

## Conventions

- Plural nouns: `/api/v1/workouts`, `/api/v1/workouts/{id}`.
- Sub-resources for ownership: `/api/v1/workouts/{id}/share-links`.
- Actions that are not CRUD use a verb sub-path: `POST /api/v1/share/{token}/import`.
- Create with a client id uses `PUT /resource/{id}` (idempotent upsert). Create with a server id uses `POST` plus an `Idempotency-Key` header.
- Partial update is `PATCH` with only the changed fields.
- Lists: `?limit=` (default 50, max 200) and `?cursor=`; response `{ items, nextCursor }`.
- Filtering by query params named after the field: `?muscle=chest&equipment=dumbbell`. Search: `?q=`.
- Errors: `{ "error": { "code": "WORKOUT_NOT_FOUND", "message": "…", "details"?: … } }`.

| Status | When |
| --- | --- |
| 400 | Validation failed (`details` holds Zod issues) |
| 401 | No session (`UNAUTHORIZED`; every `/api/v1` route except health and the share preview declares `auth: 'required'`) |
| 403 | Authenticated but not allowed (for example, offline-only client trying an online action is not a server concern) |
| 404 | Not found **or not owned** — never reveal other users' rows |
| 409 | Conflicting state (revoked link, stale version) |
| 410 | Share link expired or revoked |
| 422 | Valid shape, invalid business rule |
| 429 | Rate limit (AI) |

## Surface

| Method and path | Purpose | Spec |
| --- | --- | --- |
| `/api/auth/*` | Better Auth endpoints (sign-up, sign-in, Google, sign-out, session) | 03 |
| `GET/PUT/PATCH /api/v1/me/profile` | Profile; `PUT` finishes onboarding | 04 |
| `GET /api/v1/exercises` | Catalog (system + own), filters, search; `gym=1` keeps exercises the saved gym allows (ignored without one); items carry `trackingType` and `laterality` (09) | 06, 08, 09 |
| `GET /api/v1/exercises/{id}` | Exercise details | 06 |
| `PUT/PATCH/DELETE /api/v1/exercises/{id}` | Custom exercises (`PUT` creates with a client id) | 07 |
| `PUT/DELETE /api/v1/exercises/{id}/frames/{frameId}` | Upload (multipart) or remove one photo frame of an own exercise | 07 |
| `GET/PUT /api/v1/me/gym` | Gym equipment `{ equipment, updatedAt }`; `GET` is 404 `GYM_PROFILE_NOT_FOUND` before the first save; `PUT` upserts | 08 |
| `GET /api/v1/workouts`, `GET/PUT/DELETE /api/v1/workouts/{id}` | Workouts with exercises, see below | 09 |
| `GET /api/v1/sessions` (`?status=&exerciseId=&scheduledFor=`), `GET/PUT/PATCH /api/v1/sessions/{id}` | Sessions, see below | 10, 11 |
| `PUT/PATCH/DELETE /api/v1/sets/{id}` | Set logs | 10 |
| `GET /api/v1/exercises/{id}/last-performance` | Previous values in session | 10 |
| `GET /api/v1/schedule-rules`, `PUT/PATCH/DELETE /api/v1/schedule-rules/{id}` | Plan rules, see below | 11 |
| `GET /api/v1/calendar?from=&to=` | Occurrences joined with sessions and statuses | 12 |
| `GET /api/v1/progress/exercises/{id}` | Series and records | 13 |
| `GET/PUT/DELETE /api/v1/measurements[/{id}]` | Body measurements | 14 |
| `POST /api/v1/sync/push`, `GET /api/v1/sync/pull?since=` | Offline sync | 16 |
| `GET /api/v1/exercises/{id}/substitutes` | Deterministic suggestions | 18 |
| `POST /api/v1/workouts/{id}/share-links`, `DELETE …/{linkId}` | Share links | 19 |
| `GET /api/v1/share/{token}`, `POST /api/v1/share/{token}/import` | Preview and import | 19 |
| `GET /api/v1/workouts/{id}/export`, `POST /api/v1/workouts/import` | File export and import | 19 |
| `POST /api/v1/ai/workouts/generate` | AI workout draft | 21 |
| `POST /api/v1/ai/substitutes` | AI re-ranking | 22 |
| `POST /api/v1/ai/exercises/tags` | Tag suggestions | 23 |
| `POST /api/v1/ai/exercises/from-voice` | Voice → exercise draft | 24 |

## Workouts (spec 09)

- **List.** `GET /api/v1/workouts` returns `{ items }`: at most 200, newest `updatedAt` first. Each item has `id`, `name`, `updatedAt`, `exerciseCount`, `exerciseIds` (distinct), `primaryMuscles` (at most 3, most frequent first) and `thumbnailUrls` (at most 4).
- **Detail.** `GET /api/v1/workouts/{id}` returns `{ id, name, description, updatedAt, exercises }`, in order.
  - Each exercise has `id`, `exerciseId`, `targetSets`, `targetRepsMin`, `targetRepsMax`, `targetWeightKg`, `targetDurationSec`, `targetDistanceM`, `notes` (all nullable).
  - It also embeds `exercise`: `{ id, name, trackingType, laterality, primaryMuscles, thumbnailUrl, isOwn }`.
- **`PUT /api/v1/workouts/{id}`** creates or replaces the workout and its whole exercise list, idempotent by the client id.
  - Body: `{ name (1–80), description?, exercises: [{ id, exerciseId, target…?, notes? }] (1–30) }`.
  - Targets the exercise's tracking type does not allow, an unknown exercise, or another user's or deleted own exercise give 400 `VALIDATION_FAILED`, with the path.
- **`DELETE`** soft deletes and returns 204, also on a repeat.
- **Errors:** `WORKOUT_NOT_FOUND` (404, also for another user's id) and `WORKOUT_LIMIT_REACHED` (422 at 200 workouts).

## Sessions (spec 10)

- **List.** `GET /api/v1/sessions` returns `{ items: [{ id, workoutId, workoutName, scheduledFor, status, startedAt, finishedAt }] }`, newest `startedAt` first, at most 200, never abandoned. `status` is `in_progress` or `completed`; `exerciseId` keeps sessions with a live set of that exercise; `scheduledFor` keeps sessions linked to that planned date (spec 11).
- **Detail.** `GET /api/v1/sessions/{id}` returns the session with `workoutSnapshot`, `exercises` and its live `setLogs`. Abandoned is 404.
- **`PUT /api/v1/sessions/{id}`** creates the session with a client id; a repeat returns the existing row. The optional `scheduledFor` (spec 11) must equal the date of `startedAt` in the profile time zone, so a late outbox replay still passes.
- **`PATCH /api/v1/sessions/{id}`** writes `exercises`, `notes`, or `status` (`completed` with `finishedAt`, or `abandoned`, which soft deletes its set logs). Plan and note changes need `in_progress`.
- **`PUT/PATCH/DELETE /api/v1/sets/{id}`**: create or replace (clears `deletedAt`), change values, soft delete (204 on repeat). Values must match the exercise tracking type and the main metric is required.
- **`GET /api/v1/exercises/{id}/last-performance`** returns `{ item: null | { sessionId, finishedAt, sets } }` from the latest completed session with a live set of the exercise.
- **Errors:** `SESSION_NOT_FOUND` (404, also for another user's id), `SESSION_NOT_IN_PROGRESS` (409), validation 400.

## Schedule rules (spec 11)

- **List.** `GET /api/v1/schedule-rules` returns `{ items }`: the user's non-deleted rules, ended ones included, by `startDate`. Each item has `id`, `workoutId`, `startDate`, `endDate` (null = never), `weekdays` (ISO 1–7; empty = one-off), `intervalWeeks` (1–4), `updatedAt` and `workout: { id, name, exerciseCount, deleted }`.
- **`PUT /api/v1/schedule-rules/{id}`** creates with a client id: `{ workoutId, startDate, weekdays, intervalWeeks, endDate, endAfter? }`. `endAfter` (1–100) is stored as the date of that occurrence. 201 on create, 200 with the stored rule on a repeat. Returns `{ items: [rule] }`.
- **`PATCH /api/v1/schedule-rules/{id}`** takes the same fields plus `newId`. A rule that started before today ends yesterday and `newId` is created with the new settings; a future rule changes in place. A repeat with the same `newId` returns the same rules. Returns `{ items }` (the rule, then the split one). An ended rule is 400.
- **`DELETE /api/v1/schedule-rules/{id}`**: a started rule ends yesterday, a future one is soft deleted; repeats and ended rules are 204.
- **Rules:** the start is today or later in the profile time zone; the end is at most 2 years after the start; the workout is the user's, live and not empty; the rule has at least one date. Deleting a workout ends its rules the same way.
- **Errors:** `SCHEDULE_RULE_NOT_FOUND` (404, also for another user's id), `SCHEDULE_OVERLAP` (422, the same workout twice on one date; `details.workoutName`), `SCHEDULE_LIMIT_REACHED` (422 at 100 active rules; `details.max`), validation 400.

## Export file format

`WorkoutExportV1` in `src/shared/schemas/workout-export.ts`:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-08T10:00:00Z",
  "workout": { "name": "Push Day", "description": null,
    "exercises": [ { "exerciseRef": { "slug": "bench-press" }, "position": 0,
      "targetSets": 4, "targetRepsMin": 6, "targetRepsMax": 8, "targetWeightKg": 80, "restSec": 120 } ] },
  "customExercises": [ { "localRef": "c1", "name": "…", "primaryMuscles": ["chest"], "…": "…" } ]
}
```

`exerciseRef` is either `{ slug }` for a system exercise or `{ localRef }` pointing into `customExercises`. The same schema is the target for AI workout generation (with catalog ids instead of slugs).
