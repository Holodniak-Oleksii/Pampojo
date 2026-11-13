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
| `GET /api/v1/exercises` | Catalog (system + own), filters, search; `gym=1` keeps exercises the saved gym allows (ignored without one) | 06, 08 |
| `GET /api/v1/exercises/{id}` | Exercise details | 06 |
| `PUT/PATCH/DELETE /api/v1/exercises/{id}` | Custom exercises (`PUT` creates with a client id) | 07 |
| `PUT/DELETE /api/v1/exercises/{id}/frames/{frameId}` | Upload (multipart) or remove one photo frame of an own exercise | 07 |
| `GET/PUT /api/v1/me/gym` | Gym equipment `{ equipment, updatedAt }`; `GET` is 404 `GYM_PROFILE_NOT_FOUND` before the first save; `PUT` upserts | 08 |
| `GET /api/v1/workouts`, `GET/PUT/PATCH/DELETE /api/v1/workouts/{id}` | Workouts with exercises | 09 |
| `PUT /api/v1/sessions/{id}`, `PATCH`, `GET` list/detail | Sessions | 10 |
| `PUT/PATCH/DELETE /api/v1/sets/{id}` | Set logs | 10 |
| `GET /api/v1/exercises/{id}/last-performance` | Previous values in session | 10 |
| `GET/PUT/PATCH/DELETE /api/v1/schedule-rules[/{id}]` | Plan rules | 11 |
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
