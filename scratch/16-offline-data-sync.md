# 16-offline-data-sync — technical plan

Spec: `docs/specs/16-offline-data-sync.md`
ADR: `docs/adr/0005-local-first-outbox.md`
Design canvas: <https://claude.ai/artifact/Xd2qfoyciXTTwuatHC6Rg7> (boards D16.1–D16.8)

## 1. Summary

Move the gym data of the user onto the device and keep it in sync with the server.

- **Local database.** Dexie schema version 2 adds tables for workouts, schedule rules, exercises, measurements and a `meta` table. The outbox changes from REST replays to typed mutations.
- **Sync API.** `POST /api/v1/sync/push` applies outbox mutations idempotently by mutation id. `GET /api/v1/sync/pull` returns the rows changed after a cursor, in pages.
- **Sync engine.** `src/services/sync/` pushes the outbox, pulls changes, and prunes old local sessions. One sync runs at a time across tabs (Web Locks).
- **Reads.** The existing TanStack query hooks keep their names and result shape. Their `queryFn` reads Dexie, and a Dexie live query refreshes the cache.
- **Writes.** Sessions, set logs and measurements write locally and go through the outbox. Workouts, rules, own exercises, profile and gym profile stay REST writes, and the client puts each response into Dexie.
- **Initial download.** A full-screen progress screen shows until the first full pull ends (D16.1–D16.4).
- **Offline catalog.** The exercise library and the session picker show and search only the local exercises (D16.5–D16.8).

The device keeps:

| Data | Local copy |
| --- | --- |
| Workouts with their exercises | All workouts, deleted ones as tombstones (rules need their names) |
| Schedule rules | All non-deleted rules |
| Exercises | Exercises in live workouts, exercises in local sessions, all own exercises; both locales |
| Sessions and set logs | Sessions that started in the last 30 days, plus every `in_progress` session |
| Last performance | The latest completed session and the all-time bests of each exercise in a live workout |
| Body measurements | All live measurements |
| Profile, gym profile | One row each |

## 2. Acceptance criteria

- **AC1:** With the network off, the user starts a planned workout, logs all sets and finishes. History shows the session, and the progress range `1m` includes it. All of this comes from Dexie.
- **AC2:** When the network comes back, the outbox becomes empty. The server then has the same sessions and set logs as the device (E2E with `context.setOffline`).
- **AC3:** The server gets the same push batch twice. It stores no duplicate row, and the second response gives `duplicate` for each mutation (server test).
- **AC4:** The app stops during a push, after the server applied the batch but before the client got the response. On the next start, the sync completes with no duplicate and no lost row.
- **AC5:** Two devices of one user. A workout edited on device A shows on device B after the next pull on B. A workout deleted on A disappears from the lists on B.
- **AC6:** Two tabs never push at the same time. A second sync that starts during a running one returns `busy` and sends nothing.
- **AC7:** Unit tests cover outbox order, batches of at most 50, partial failure (one rejected mutation) and retry with backoff.
- **AC8:** A batch with one invalid mutation applies the other mutations. The invalid one comes back as `rejected` with its error code, and the client deletes it from the outbox.
- **AC9:** A server error (5xx) during a batch rolls back the whole batch. The client keeps every entry and retries later.
- **AC10:** After login on a device with an empty local database, the download screen shows until the download ends (D16.1). On a failure the error state shows (D16.2). Offline with an empty database, the offline state shows (D16.3).
- **AC11:** Offline, the exercise library and the session picker show and search only the local exercises, with the hint line and the offline empty state.
- **AC12:** Offline, the user adds, edits and deletes a body measurement. Back online, the server has the same live rows.
- **AC13:** After a sync, Dexie has no completed or abandoned session that started more than 30 days ago and has no outbox entry. History still loads older sessions online on scroll.
- **AC14:** A session that started on device A can be continued on device B. If B has its own active session, the session of A shows in History as in progress and is not the active session on B.
- **AC15:** A Dexie version 1 database (spec 10) with pending REST outbox entries upgrades to version 2. The entries sync with no loss and no duplicate.
- **AC16:** A pull whose window overlaps the previous one writes no duplicate row. A row committed late (its `updatedAt` is before the previous cursor) still comes in the next pull (server test).

## 3. Data

### Postgres (one migration, `pnpm db:generate`)

New table `sync_mutation` in `src/server/db/schema/sync.ts`, exported from `schema/index.ts`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | The client mutation id |
| `user_id` | text → `user.id`, `on delete cascade` | Same type as other `user_id` columns |
| `type` | text | One of `SYNC_MUTATION_TYPE` (check constraint) |
| `applied_at` | timestamptz, default `now()` | |

Index `sync_mutation_user_idx` on `(user_id)`.

New indexes for pull, because pull filters each table by user and `updated_at`:

- `schedule_rule_user_updated_idx` on `schedule_rule (user_id, updated_at)`;
- `exercise_owner_updated_idx` on `exercise (owner_id, updated_at)`;
- `body_measurement_user_updated_idx` on `body_measurement (user_id, updated_at)`;
- `set_log_session_updated_idx` on `set_log (session_id, updated_at)`.

`workout` and `workout_session` already have `(owner_id|user_id, updated_at)` indexes. No column changes. Review the generated SQL before the commit (`docs/development/backend/database.md`).

Constants in `src/constants/sync.ts`:

```ts
export const SYNC_MUTATION_TYPE = {
  SESSION_PUT: 'session.put',
  SESSION_PATCH: 'session.patch',
  SET_PUT: 'set.put',
  SET_PATCH: 'set.patch',
  SET_DELETE: 'set.delete',
  MEASUREMENT_PUT: 'measurement.put',
  MEASUREMENT_DELETE: 'measurement.delete',
} as const;
export const SYNC_PUSH_BATCH_MAX = 50;
export const SYNC_PULL_PAGE_ROWS = 500;
export const SYNC_PULL_OVERLAP_MS = 30_000;
export const SYNC_SESSION_WINDOW_DAYS = 30;
/** Raise to force a full download on every device after a local schema change. */
export const SYNC_DOWNLOAD_VERSION = 1;
```

### Shared Zod schemas — `src/shared/schemas/sync.ts` (new)

- `syncMutationTypeSchema`: enum of `SYNC_MUTATION_TYPE`.
- `syncMutationSchema`: `{ id: uuid, type, entityId: uuid, payload: unknown, createdAt: iso datetime }`, `.strict()`. The server parses `payload` per type (section 5), so one bad payload rejects only its mutation.
- `pushRequestSchema`: `{ mutations: syncMutationSchema[] }`, 1–50 items, `.strict()`.
- `pushResultSchema`: `{ id: uuid, status: 'applied' | 'duplicate' | 'rejected', error?: string }`.
- `pushResponseSchema`: `{ results: pushResultSchema[] }`.
- `pullQuerySchema`: `{ since?: string (max 512) }`.
- Row schemas for pull (section 4): `syncWorkoutSchema`, `syncScheduleRuleSchema`, `syncExerciseSchema`, `syncSessionSchema`, `syncSetLogSchema`, `syncMeasurementSchema`, `syncLastPerformanceSchema`.
- `pullResponseSchema`: `{ changes, cursor: string | null, nextCursor: string | null, totals?: SyncTotals }`.

### Dexie — `src/services/local-db/db.ts`, schema version 2

Keep the version 1 stores. Add:

```ts
this.version(2)
  .stores({
    sessions: 'id, status, startedAt',
    setLogs: 'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]',
    lastPerformance: 'exerciseId',
    outbox: '++seq, entityId',
    workouts: 'id',
    scheduleRules: 'id, workoutId',
    exercises: 'id, isOwn',
    measurements: 'id, [type+measuredOn]',
    meta: 'key',
  })
  .upgrade(convertOutboxToMutations);
```

Local row types (in `db.ts`, with Zod schemas for safe reads like the existing ones):

- `LocalWorkout`: `{ id, name, description, updatedAt, deletedAt, exercises: LocalWorkoutExercise[] }`. A `LocalWorkoutExercise` has `id`, `exerciseId`, the six targets and `notes`, in position order. It has no embedded exercise summary, because names depend on the locale.
- `LocalScheduleRule`: `{ id, workoutId, startDate, endDate, weekdays, intervalWeeks, updatedAt }`.
- `LocalExercise`: the `syncExerciseSchema` row (section 4) plus `isOwn: 0 | 1` for the index (IndexedDB cannot index booleans).
- `LocalMeasurement`: `Measurement` from `src/shared/schemas/measurement.ts`.
- `MetaRow`: `{ key: 'sync', value: SyncMeta } | { key: 'profile', value: Profile } | { key: 'gym', value: Gym | null }`.
- `SyncMeta`: `{ downloadVersion: number | null, download: DownloadState, cursor: string | null, pageToken: string | null, lastSyncAt: string | null, lastError: { code: string, at: string } | null }`.
- `DownloadState`: `{ status: 'idle' } | { status: 'running', received: SyncTotals, totals: SyncTotals | null } | { status: 'done' }`.

The new `OutboxEntry`:

```ts
export interface OutboxEntry {
  seq?: number;
  id: string;          // mutation id
  type: SyncMutationType;
  entityId: string;
  payload: unknown;    // the REST body, or undefined for a delete
  createdAt: string;
  attempts: number;
}
```

`convertOutboxToMutations` maps each version 1 entry and keeps its `id`, `seq` and `createdAt`:

| Version 1 entry | Version 2 `type` | `entityId` |
| --- | --- | --- |
| `PUT /api/v1/sessions/{id}` | `session.put` | `{id}` |
| `PATCH /api/v1/sessions/{id}` | `session.patch` | `{id}` |
| `PUT /api/v1/sets/{id}` | `set.put` | `{id}` |
| `PATCH /api/v1/sets/{id}` | `set.patch` | `{id}` |
| `DELETE /api/v1/sets/{id}` | `set.delete` | `{id}` |

An entry with another path is impossible in version 1. If one exists, delete it and log a warning.

## 4. API

Add both rows to the table in `docs/tech/API.md` with this text, and add a "Sync (spec 16)" section.

### `POST /api/v1/sync/push`

- Auth required. Body `pushRequestSchema`. A body that fails the schema is 400 `VALIDATION_FAILED`.
- The server applies the mutations in order, in one transaction, with one savepoint per mutation.
- For each mutation:
  1. If `sync_mutation` has the id for this user, the result is `duplicate`. Apply nothing.
  2. Parse `payload` with the schema of the type. A parse failure is `rejected` with `VALIDATION_FAILED`.
  3. Call the service function of the type (table below) with the savepoint transaction as `db`.
  4. On success, insert the id into `sync_mutation` in the same savepoint. The result is `applied`.
  5. On a `DomainError` whose HTTP status is 4xx, roll back the savepoint. The result is `rejected` with the error code. Do not record the id, so a replay gets the same answer.
  6. On any other error, roll back the whole transaction and answer 500 `INTERNAL`.
- If the id is in `sync_mutation` for another user, the insert fails on the primary key. Treat this as `rejected` with `CONFLICT`.
- Response 200 `{ results }`, one item per mutation, in request order. `Cache-Control: private, no-store`.

| `type` | Payload schema | Service call |
| --- | --- | --- |
| `session.put` | `putSessionInputSchema` | `putSession(userId, entityId, payload, tx)` |
| `session.patch` | `patchSessionInputSchema` | `patchSession(userId, entityId, payload, tx)` |
| `set.put` | `putSetInputSchema` | `putSet(userId, entityId, payload, tx)` |
| `set.patch` | `patchSetInputSchema` | `patchSet(userId, entityId, payload, tx)` |
| `set.delete` | none (`undefined`) | `deleteSet(userId, entityId, tx)` |
| `measurement.put` | `putMeasurementInputSchema` | `putMeasurement(userId, entityId, payload, tx)` |
| `measurement.delete` | none | `deleteMeasurement(userId, entityId, tx)` |

The services already call `db.transaction`. With a transaction as `db`, Drizzle opens a nested savepoint, so the current service code works as it is. The server sets `updatedAt` itself, so last write wins on server time.

### `GET /api/v1/sync/pull?since=`

- Auth required. `since` is an opaque cursor from an earlier response, or absent for a full download. An unknown or malformed cursor is 400 `INVALID_CURSOR`.
- Response 200, `Cache-Control: private, no-store`:

```ts
{
  changes: {
    profile: Profile | null;          // null when not changed
    gym: Gym | null;                  // null when not changed or not set up
    gymChanged: boolean;              // true when `gym` is the current value (also a null gym)
    workouts: SyncWorkout[];
    scheduleRules: SyncScheduleRule[];
    exercises: SyncExercise[];
    sessions: SyncSession[];
    setLogs: SyncSetLog[];
    measurements: SyncMeasurement[];
    lastPerformance: SyncLastPerformance[];
  };
  nextCursor: string | null;          // continue this pull; null on the last page
  cursor: string | null;              // store as the next `since`; set only on the last page
  totals?: SyncTotals;                // first page of a full download only
}
```

Row shapes:

- `SyncWorkout`: `{ id, name, description, updatedAt, deletedAt, exercises: [{ id, exerciseId, targetSets, targetRepsMin, targetRepsMax, targetWeightKg, targetDurationSec, targetDistanceM, notes }] }`, exercises in position order.
- `SyncScheduleRule`: `{ id, workoutId, startDate, endDate, weekdays, intervalWeeks, updatedAt, deletedAt }`.
- `SyncExercise`: `{ id, isOwn, primaryMuscles, secondaryMuscles, equipment, movementPattern, mechanic, laterality, trackingType, difficulty, popularity, frames, gymEquipment, sourceExerciseId, updatedAt, deletedAt, translations: [{ locale, name, aliases, description, instructions, commonMistakes, searchName, searchAliases }] }`. `frames` has the resolved URLs, the same as `exerciseSchema.frames`.
- `SyncSession`: `sessionSchema` without `setLogs`, plus `status` `abandoned` for a session to delete.
- `SyncSetLog`: `setLogSchema` plus `deletedAt`.
- `SyncMeasurement`: `measurementSchema` plus `updatedAt` and `deletedAt`.
- `SyncLastPerformance`: `{ exerciseId, item: { sessionId, finishedAt, sets } | null, bests }`, the same data as `GET /exercises/{id}/last-performance`.
- `SyncTotals`: `{ workouts, scheduleRules, exercises, sessions, setLogs, measurements, lastPerformance }` (row counts of the full download).

Paging:

- A pull run walks the phases in this order: `profile`, `gym`, `workouts`, `scheduleRules`, `exercises`, `lastPerformance`, `sessions`, `setLogs`, `measurements`. This is the order of the download steps.
- A page holds at most 500 rows in total. Inside a phase, rows are ordered by `(updated_at, id)`, or by `id` for `exercises` and `lastPerformance`.
- The cursor encodes `{ v: 1, low, high, phase, after }` as base64url JSON:
  - `low` is the lower bound: the previous `high` minus 30 seconds, or null for a full download;
  - `high` is `now()` when the run starts;
  - `phase` and `after` give the position inside the run.
- A row is in the run when `updated_at > low` (or always, for a full download) and `updated_at <= high`.
- The last page returns `cursor` = `{ v: 1, high }` only. The next run uses it as `since`, so its `low` is that `high` minus 30 seconds.
- The 30-second overlap catches rows that committed after an earlier run read the table, because Postgres `now()` is the start time of the transaction. The client upserts every row, so a row in two runs is not a duplicate.

What each phase returns (all queries scoped by the user):

- `profile`: the profile when `profile.updated_at` is in the run.
- `gym`: the gym profile when its `updated_at` is in the run. `gymChanged` is true then.
- `workouts`: rows of `owner_id = userId` with `updated_at` in the run. A full download sends only live rows.
- `scheduleRules`: rows of `user_id = userId` with `updated_at` in the run. A full download sends only non-deleted rows.
- `exercises`: the union of these sets, ordered by `id`:
  - own exercises (`owner_id = userId`) changed in the run, deleted ones included;
  - exercises that the user references, with the exercise or one of its translations changed in the run;
  - every exercise referenced by a workout, a session or a set log that is in this run.
  - "References" means the exercise is in a live workout, or in the `exercises` or a set log of a session in the window.
  - A full download sends all referenced and all live own exercises.
- `lastPerformance`: for each exercise in a live workout:
  - a full download sends all of them;
  - an incremental pull sends an exercise when a completed session in the run has a live set of it, or when a workout in the run references it.
- `sessions`: sessions of the user in the window with `updated_at` in the run. The window is `started_at >= (today in the profile time zone − 30 days)` or `status = 'in_progress'`. A full download skips abandoned sessions.
- `setLogs`: set logs of window sessions with `updated_at` in the run. A full download sends only live rows.
- `measurements`: rows of the user with `updated_at` in the run. A full download sends only live rows.

Errors: `INVALID_CURSOR` (400). Add it to `src/server/sync/errors.ts` and to the table in `src/server/http/errors.ts`.

## 5. Server

New domain `src/server/sync/`:

- `errors.ts`: `SYNC_ERROR = { INVALID_CURSOR }`, the `invalidCursor()` helper.
- `cursor.ts`: `encodePullCursor`, `decodePullCursor` (Zod-checked, throws `invalidCursor()`).
- `push.ts`:
  - `applyPush(userId, mutations, db = getDb()): Promise<PushResult[]>` runs the push rules from section 4;
  - `MUTATION_HANDLERS`: a record from type to `{ schema, apply(userId, entityId, payload, tx) }`.
- `queries.ts`:
  - `findAppliedIds(tx, userId, ids)`, `insertApplied(tx, { id, userId, type })`;
  - one query function per phase, each taking `(db, userId, range, after, limit)`;
  - `countFullDownload(db, userId)` for `totals`.
- `pull.ts`: `pullChanges(userId, since, db = getDb()): Promise<PullResponse>`. It fills the page phase by phase until it reaches 500 rows, then returns `nextCursor`.
- `today.ts` reuse: the window start uses `userToday` from `src/server/plan/today.ts` (or the helper that `measurements` uses), minus 30 days. Compare to `started_at` with the profile time zone, the same way as `instantRange` in `src/shared/plan/statuses.ts`.

Reuse:

- Workouts: map rows to `SyncWorkout` in `src/server/workouts/service.ts` with a new exported `toSyncWorkout`. Read `workout_exercise` rows for all workouts of the page in one query (no N+1).
- Exercises: a new `listSyncExercises(db, userId, ids)` in `src/server/exercises/service.ts`. It reads the exercise rows and both translations in two queries, and resolves frames with the existing `resolveFrames`.
- Last performance: a new `listLastPerformance(userId, exerciseIds, db)` in `src/server/sessions/service.ts`. It does a constant number of queries: one `distinct on (exercise_id)` query for the latest completed sessions, one for their live sets, and the bests query of spec 13 grouped by exercise. Make `getLastPerformance` call it for one id, so both paths give the same result.
- Sessions and set logs: reuse `toSession` and `toSetLog`.
- Measurements: reuse `toMeasurement` and add `updatedAt` and `deletedAt`.

Routes:

- `src/app/api/v1/sync/push/route.ts`:
  `POST = withHandler({ auth: 'required', body: pushRequestSchema }, ({ userId, body }) => json({ results: await applyPush(userId, body.mutations) }))`.
- `src/app/api/v1/sync/pull/route.ts`:
  `GET = withHandler({ auth: 'required', query: pullQuerySchema }, ({ userId, query }) => json(await pullChanges(userId, query.since)))`.

Every query filters by `userId` (`owner_id` for workouts and own exercises). System exercises come only through the reference sets of the user. Add the `import 'server-only'` line to each file.

Docs in the same change:

- `docs/tech/DATA_MODEL.md`: the `sync_mutation` row gets `type` values and the index. Add the four new indexes to the tables they belong to.
- `docs/tech/API.md`: the sync section from section 4.
- `docs/tech/OFFLINE.md`: replace the "What is local" table with the table from section 1, and add the 30-day window. This is the spec text, so it needs no new decision.

## 6. Client

### 6.1 Local database access

- `src/services/local-db/LocalDbProvider.tsx` (new, `'use client'`): a context that holds the `PampojoDb` of the signed-in user. `CurrentUserProvider` renders it with `openLocalDb(userId)`.
- `useOptionalLocalDb(): PampojoDb | null` and `useRequiredLocalDb(): PampojoDb` read the context. Without a provider (tests, pages outside the app), `useOptionalLocalDb` returns null.
- `src/services/local-db/useLocalQuery.ts` (new):

```ts
/** A TanStack query whose data comes from Dexie and follows every local change. */
export function useLocalQuery<T>({ queryKey, read, enabled = true }: {
  queryKey: QueryKey;
  read: (db: PampojoDb) => Promise<T>;
  enabled?: boolean;
}): UseQueryResult<T>;
```

- It calls `useQuery({ queryKey, queryFn: () => read(db), networkMode: 'always', staleTime: Infinity, enabled: enabled && db !== null })`.
- In an effect, it subscribes to `liveQuery(() => read(db))` from `dexie`, and calls `queryClient.setQueryData(queryKey, value)` on each value.
- It unsubscribes on unmount or when `queryKey` changes. Compare keys with `hashKey` from TanStack.

### 6.2 Repositories (new files in `src/services/local-db/`)

Each repository is a set of plain async functions that take `db`. They have Vitest browser tests next to them.

- `workouts.ts`:
  - `listLocalWorkouts(db, lang): WorkoutListResponse` keeps live rows, newest `updatedAt` first, and builds list items with `summarizeWorkout`;
  - `getLocalWorkout(db, id, lang): Workout | null` embeds each exercise summary from the local `exercises` table. It uses `lang`, else the other locale.
  - `putLocalWorkout(db, row)`, `markLocalWorkoutDeleted(db, id, at)`, `fromWorkoutResponse(workout)` (maps a REST `Workout` to a `LocalWorkout`).
- `src/shared/workout-summary.ts` (new, pure):
  - `summarizeWorkout(exercises)` returns `{ exerciseCount, exerciseIds, primaryMuscles, thumbnailUrls }`;
  - move the logic of `listWorkouts` and `topMuscles` from `src/server/workouts/service.ts` into it, and make the server use it too, so the two cannot differ.
- `plan.ts`: `listLocalRules(db, lang): ScheduleRuleListResponse` keeps non-deleted rules by `startDate`, and joins `workout: { id, name, exerciseCount, deleted }` from local workouts. Also `putLocalRules(db, items)` and `applyLocalRuleDelete(db, id, today)`, which reuses `applyRuleDelete` from `src/api/plan.ts`.
- `exercises.ts`:
  - `searchLocalExercises(db, filters, lang, gym)` returns `ExerciseListItem[]` in the server order: `popularity` desc with nulls last, then name;
  - search uses `normalizeSearch` on `searchName` and `searchAliases` of the current locale, with the same contains rule as the server;
  - muscle, equipment, `mine` and `gym` filters use `isAvailableInGym` from `src/shared/gym.ts`;
  - `section` is the first primary muscle;
  - also `getLocalExercise(db, id, lang): Exercise | null`, `putLocalExercise(db, row)`, `fromExerciseResponse(exercise, lang)` and `countLocalExercises(db)`.
- `measurements.ts`, `createMeasurementRepository(db)`:
  - `save(input)`: if a live local row of the same `type` and `measuredOn` exists, update that row and reuse its id. Else, put a new row with `crypto.randomUUID()`. Enqueue `measurement.put` with the row id. This is the same day rule as the server.
  - `update(id, input)`: update value and date. Delete another local row of the same type on the new day. Enqueue `measurement.put`.
  - `remove(id)`: delete the local row and enqueue `measurement.delete`.
  - Each method runs in one Dexie transaction over `measurements` and `outbox`, then calls `notifyOutbox()`.
- `profile.ts`:
  - `getLocalProfile(db): Profile | null` reads `meta.profile`;
  - it computes `latestWeightKg` and `latestWeightOn` from the local `weight` measurements, so a measurement saved offline shows at once;
  - it also computes `age` from `birthDate` with today in the profile time zone;
  - also `putLocalProfile(db, profile)`, `getLocalGym(db)` and `putLocalGym(db, gym)`.
- `sessions.ts` (extend `scheduled.ts`):
  - `listLocalSessions(db, filters): SessionListResponse` supports `status: in_progress`, `status: completed` and `scheduledFor`, newest `startedAt` first, never abandoned;
  - `exerciseProgressLocal(db, exerciseId, today, timeZone)` builds the `1m` points with `pointOf` and `rangeStart` from `src/shared/progress/metrics.ts`;
  - `progressExercisesLocal(db, today, timeZone)` builds the list items and the month numbers.
- `session-repository.ts`:
  - replace `enqueue(db, { method, path, body })` with `enqueue(db, { type, entityId, payload })` in every method (types from section 3);
  - `importRemote` stays for callers that load one session from the server;
  - `findInProgress` returns the newest `in_progress` session that this device started or continued (6.6).

`outbox.ts` changes:

- `NewOutboxEntry = Pick<OutboxEntry, 'type' | 'entityId' | 'payload'>`.
- Delete `drain`, `flushOutbox` and `isPermanent`. The sync engine replaces them.
- Keep `notifyOutbox`, `onOutboxEnqueued` and `pendingCount`.
- Add `pendingEntityIds(db): Promise<Set<string>>`.

### 6.3 Sync engine — `src/services/sync/` (new)

- `push.ts`, `pushOutbox(db, options): Promise<'done' | 'failed'>`:
  1. Read the first 50 entries by `seq`. If there are none, return `done`.
  2. POST them to `/api/v1/sync/push` through `http`. Send no `Idempotency-Key` header, because the mutation ids make the push idempotent. `http` then does not retry the POST, and the sync runner retries instead.
  3. For each result: `applied` or `duplicate` deletes the entry. `rejected` deletes the entry, saves `meta.sync.lastError = { code, at }` and calls `options.onRejected(entry, code)`.
  4. Repeat until the outbox is empty.
  5. On a network error, a 5xx, or a 401, add 1 to `attempts` of the sent entries and return `failed`.
  - Call `options.onApplied(entry)` for an applied `session.patch` with `status: completed`, so the caller can refresh progress.
- `pull.ts`, `pullChanges(db, { full }): Promise<'done' | 'failed'>`:
  1. Start from `meta.sync.pageToken`, else `meta.sync.cursor`, else no `since` (full).
  2. GET a page and validate it with `pullResponseSchema`.
  3. Write the page in one Dexie transaction over all tables (`applyPullPage`).
  4. In the same transaction, save `pageToken = nextCursor`. On the last page, save `cursor`, clear `pageToken` and set `lastSyncAt`.
  5. Repeat while `nextCursor` is set. Report progress through `options.onPage(received, totals)`.
- `apply.ts`, `applyPullPage(db, changes, pending)`. `pending` is the set from `pendingEntityIds`. The rules:
  - A row whose id is in `pending` is skipped. Local changes that are not pushed yet win until the push.
  - **Workouts:** put a `LocalWorkout`. A row with `deletedAt` stays as a tombstone.
  - **Rules:** a row with `deletedAt` is deleted locally, else put.
  - **Exercises:** put. Set `isOwn` as `1` or `0`. An own exercise with `deletedAt` is deleted locally.
  - **Sessions:** an `abandoned` row deletes the local session and its set logs. Else put the server fields and keep the local fields `restEndsAt`, `restDurationSec`, `restSetId`, `currentEntryId`, `drafts` and `newRecords` (as `importRemote` does now).
  - **Set logs:** put with `deletedAt`.
  - **Measurements:** a row with `deletedAt` is deleted locally. Else, first delete each local row of the same `type` and `measuredOn` with another id that is not in `pending`. The server merged it into this row. Then put the row.
  - **Last performance:** put `{ exerciseId, ...item, fetchedAt: now, bests }`, or delete when `item` is null.
  - **Profile** and **gym:** put into `meta` when present (`gymChanged` for the gym).
- `prune.ts`, `pruneLocal(db, today)`:
  - delete completed and abandoned sessions with `startedAt` before `today − 30 days`, and their set logs, when no outbox entry has their id or the id of one of their sets;
  - delete exercises that are not own, not in a live local workout, and not in a local session or set log.
- `engine.ts`, `syncNow(db, options): Promise<'done' | 'failed' | 'busy'>`:
  - run `pushOutbox`, then `pullChanges`, then `pruneLocal`, under `navigator.locks.request(\`${db.name}-sync\`, { ifAvailable: true })`;
  - add an in-tab `Set` guard as `flushOutbox` has now;
  - if the push fails, skip the pull and return `failed`;
  - after a pull that changed sessions, call `options.onSessionsChanged()`.
- `download.ts`, `useInitialDownload(db)`:
  - the state comes from a live query on `meta.sync`;
  - "needs download" is true when `downloadVersion !== SYNC_DOWNLOAD_VERSION` or `download.status !== 'done'`;
  - `start()` sets `download = { status: 'running', received: zero, totals: null }`, keeps `cursor = null` and clears `pageToken` (only when `downloadVersion` changed);
  - it runs `syncNow` with `full: true`, which pushes the outbox first;
  - on success it sets `download = { status: 'done' }` and `downloadVersion = SYNC_DOWNLOAD_VERSION`;
  - on failure the state keeps `received` and `pageToken`, so "Спробувати ще раз" continues from the failed page.
  - It returns `{ state: 'running' | 'error' | 'offline' | 'done', steps, failedStep, retry }`. `offline` means `navigator.onLine === false` and nothing is received yet.
  - When the `online` event fires in the `offline` state, `start()` runs again.
- `useSyncRunner.ts` (replaces `useOutboxRunner`):
  - triggers: mount, `online`, `visibilitychange` to visible, `onOutboxEnqueued` (debounced by 300 ms), and `requestSync()`;
  - after a failure, retry with backoff from 2 s to 60 s, and after `busy` retry in 1 s (the logic of `useOutboxRunner`);
  - do nothing while the initial download is not done;
  - on a rejected mutation, show the existing toast "Couldn't save a change to the server." (spec 10 behaviour; spec 17 adds the sync sheet);
  - on `onApplied` of a finished session, invalidate `progressKeys.all`, `calendarKeys.all` and `sessionKeys.history()`;
  - on `onSessionsChanged`, invalidate the same keys.
- `request-sync.ts`: `requestSync()` dispatches an event that `useSyncRunner` listens to. The online REST mutations (6.4) and the session finish call it.
- `index.ts`: export `syncNow`, `requestSync`, `useSyncRunner`, `useInitialDownload`.

`src/services/local-db/logout.ts`:

- `flushAllLocalDbs()` calls `pushOutbox` for each database instead of `flushOutbox`.
- `deleteAllLocalDbs()` does not change.

`src/features/auth/CurrentUser/CurrentUser.tsx`:

- Render `LocalDbProvider` and `SyncRunner` (which calls `useSyncRunner`) instead of `OutboxRunner`.
- Delete `useOutboxRunner.ts` and its export.

### 6.4 Query hooks in `src/api/`

Keep every exported name, key and result shape. Each changed read hook uses `useLocalQuery` when `useOptionalLocalDb()` is not null, else the current network query (tests and the onboarding page).

| Hook | Local `read` | Notes |
| --- | --- | --- |
| `useWorkoutsQuery` | `listLocalWorkouts(db, lang)` | |
| `useWorkoutQuery(id)` | `getLocalWorkout(db, id, lang)` | The editor keeps it. Offline the editor is blocked as now |
| `useScheduleRulesQuery` | `listLocalRules(db, lang)` | |
| `useGymQuery` | `getLocalGym(db)` | Keep `initialData` |
| `useProfileQuery` | `getLocalProfile(db)` | Keep `initialData`. A null local profile falls back to `initialData` |
| `useMeasurementsQuery` | `measurements` table, live rows | |
| `useSessionsQuery(filters)` | `listLocalSessions` when `filters.status === 'in_progress'` or `filters.scheduledFor` is set | Other filters (`exerciseId`) stay on the network |

`lang` comes from `useTranslation().i18n.language`, and it is part of the query key (`[...workoutKeys.list(), lang]`). Update the key factories, so the existing invalidations by prefix still match.

Online REST mutations write their response into Dexie, then call `requestSync()`:

- `usePutWorkoutMutation`: `putLocalWorkout(db, fromWorkoutResponse(workout))`. The response embeds exercise summaries. Put an exercise into the local table if it is missing there, through `GET /api/v1/exercises/{id}` (only for ids not in Dexie). The next pull then brings `lastPerformance`.
- `useDeleteWorkoutMutation`: `markLocalWorkoutDeleted`. The pull brings the ended rules.
- `usePutScheduleRuleMutation`, `usePatchScheduleRuleMutation`: `putLocalRules(db, response.items)`.
- `useDeleteScheduleRuleMutation`: `applyLocalRuleDelete(db, id, today)` in `onSuccess`. Keep the optimistic cache update.
- `useSaveGymMutation`: `putLocalGym`. `useUpdateProfileMutation` and `useCompleteOnboardingMutation`: `putLocalProfile` when a db exists.
- Exercise create, update and frame changes: `putLocalExercise(db, fromExerciseResponse(...))`. Delete: delete the local row. The pull brings the changed workouts and set logs.

Measurement mutations become local and work offline:

- `useSaveMeasurementsMutation`, `useUpdateMeasurementMutation` and `useDeleteMeasurementMutation` call `createMeasurementRepository(db)`.
- Each one has `networkMode: 'always'`, because TanStack pauses mutations offline by default.
- They keep the invalidations, so `profileKeys.me()` and the live query both refresh.
- Without a db, they keep the REST calls.

History — `useSessionHistoryQuery`:

- Page 0 (`pageParam` null) is local. It holds the completed local sessions, newest first, mapped to list items, and it never calls the network.
- If the device is online, the next page param is `{ server: null }`, else there is no next page.
- A server page calls `fetchSessions({ status: completed, limit: HISTORY_PAGE_SIZE, cursor })`. It drops items whose id is in page 0 and returns `{ server: nextCursor }` while `nextCursor` is set.
- `HistoryList` keeps "Older workouts appear when you are online." for the offline end of the list.

Calendar — `useCalendarDays` already merges local sessions and the cached calendar with `computeCalendar`. The rules now come from Dexie, so an offline calendar has the rules too. Change nothing else.

Progress — `useProgressExercisesQuery` and `useExerciseProgressQuery`:

- Online, they use the server as now.
- If the fetch fails with a network error, or `navigator.onLine` is false, and the cache has no data, the hooks compute the result locally:
  - `progressExercisesLocal` gives the list and the month numbers from local sessions;
  - `exerciseProgressLocal` gives `range = '1m'` points and `records: null`.
- For other ranges, they throw `OfflineRangeError`, and the screen shows "Потрібен інтернет" as now.
- Change `ExerciseProgressResponse` on the client side to allow `records: null`. In `ProgressScreen`, a null `records` shows the existing "Needs internet" text in the records block, instead of the records.

Session start — `useStartSession`:

- `loadRules` reads `listLocalRules(db, lang)`.
- `planZoneForStart` reads the local profile.
- The workout comes from `getLocalWorkout`.
- `plannedDateFor` uses `findScheduledSessions` only. The local window has every session of today, so delete the network call.
- `makeUpDateFor` keeps the cached calendar and local sessions as now.
- `prefetchLastPerformance` stays for online starts. Offline, the pulled `lastPerformance` rows are already in Dexie.

Measurements UI:

- Remove the offline disable from `AddMeasurementSheet`, `EditMeasurementSheet`, `MeasurementHistory` and `MeasurementsSection` (the `useIsOnline` checks that disable add, edit and delete).
- Keep the rest of their UI.

### 6.5 Initial download screen — `src/features/sync/LocalDataGate/` (new)

- `LocalDataGate.tsx` (`'use client'`) wraps the children of `CurrentUserProvider`. It covers the app shell and the session route, because both use `SessionGate`.
- If `useInitialDownload` says `done`, it renders the children. Else it renders `DownloadScreen`.
- `DownloadScreen.tsx`. The layout, from D16.1–D16.4:
  - **Frame:** `min-h-dvh bg-background`, padding 16px on mobile, `24px 40px` on desktop (`lg:`). There is no app shell.
  - **Header:** the wordmark image `public/brand/pampojo-wordmark.svg` (dark theme: `pampojo-wordmark-dark.svg`), 28px high on mobile and 32px on desktop. Use a plain `<img>`, as the `/offline` page does (see `src/features/pwa/brand-assets.ts`).
  - **Card:** vertically centred, full width on mobile and `w-[480px]` on desktop. It has `bg-card`, a 6px radius and `overflow-hidden`.
  - **Bar:** the top 3px of the card. The track is `--border` and the fill is `--accent`, with width = progress percent. It is `role="progressbar"` with `aria-valuenow`. The progress is the received rows divided by the sum of `totals`. Under `prefers-reduced-motion` the width changes with no transition, else with a 240ms transition.
  - **Text:** the headline is 30/800 (36 on desktop). The body is 15/400 in `--muted-foreground`, 12px under it. Card padding is `24px 20px 8px` (desktop `32px 32px 8px`).
  - **Steps:** an ordered list (`<ol>`), each item at least 52px high with a 1px `--border` divider between items.
    - The diamond is 22px. Done: `--accent` fill with a `--foreground` check (reuse the set-done icon component). Current: a 2px `--foreground` outline, with `aria-current="step"`. Pending: a 2px `--planned` outline.
    - The label is 16/700. A pending label is `--muted-foreground`.
    - The value is 15/600 with tabular figures, right-aligned. Done steps show it in `--muted-foreground`, the current one in `--foreground`.
  - **Note:** under the card, 14px `--muted-foreground`, centred: "If the connection drops, we continue from the same place."
- **Steps and values.** Each step has its tables:

| Step | Tables | Done value | Current value |
| --- | --- | --- | --- |
| Profile and gym | `profile`, `gym` | "Done" | — |
| Workouts and plan | `workouts`, `scheduleRules` | "{{count}} workouts" | "{{done}} of {{total}}" (workouts) |
| Exercises | `exercises`, `lastPerformance` | "{{count}} exercises" | "{{done}} of {{total}}" (exercises) |
| History for 30 days | `sessions`, `setLogs` | "{{count}} workouts" (sessions) | "{{done}} of {{total}}" (sessions) |
| Body measurements | `measurements` | "Done" | — |

  A step is done when every one of its tables has received its total. The current step is the first step that is not done.
- **Error state (D16.2):**
  - the headline is the error title of the failed step;
  - the body is the error text in `role="alert"`;
  - the bar fill is `--planned`;
  - the failed step has a 2px `--destructive` outline diamond and the value "Not loaded" in `--foreground`;
  - under the list, with 20px padding, come the primary button "Try again" (48px, full width), which calls `retry()`, and the quiet link "Log out" (44px, centred, 15/600).
  - "Log out" calls `authClient.signOut()`, `deleteAllLocalDbs()`, `deletePageCaches()` and then `navigateAfterAuth('/')`, with no spec 17 guard. The outbox of a new device is empty. Reuse the `signOut` part of `LogOutButton`: move it to `src/features/auth/sign-out.ts` and call it from both places.
- **Offline state (D16.3):**
  - the header adds the offline pill on the right (`--foreground` background, an accent outline diamond and "Offline");
  - the card is centred text, padding `32px 20px 20px`;
  - it holds a 56px dashed `--planned` diamond (as on `OfflinePage`), the headline 24/800, the body, the primary button "Try again" (full width, 48px), and the note 14px muted;
  - there is no logout link;
  - "Try again" calls `retry()`, which starts when `navigator.onLine` is true;
  - the `online` event starts the download by itself.
- Desktop (D16.4) is the same card, 480px wide and centred on the page. The note is under the card.

### 6.6 Sessions on two devices

- `useLocalInProgress`, `findInProgress` and `useInProgress` pick the active session in this order:
  1. the session in `meta.activeSessionId` when it is still `in_progress`;
  2. else the newest `in_progress` session that has no `deviceOwned: false` flag.
- Set `meta.activeSessionId` when this device starts or opens a session. Clear it when the session ends.
- `applyPullPage` marks a pulled `in_progress` session as `deviceOwned: false` when the device has another active session.
- When the device has no active session, `useInProgress` takes the newest `in_progress` session, also one from another device. Opening it sets `activeSessionId`.
- History lists the `in_progress` sessions that are not active on this device above the completed ones, with the same row component. The secondary line is the existing string "Workout in progress" ("Тренування триває") instead of the date and set count. The row links to `/session/{id}`, and opening it makes the session active on this device when the device has no active session.
- The rest timer, the current exercise and the drafts are local fields, and pull keeps them (6.3).

Add `activeSessionId: string | null` to `SyncMeta` and the optional `deviceOwned?: boolean` to `LocalSession`.

### 6.7 Offline catalog — D16.5–D16.8

`src/api/exercises.ts`, `useExercisesInfiniteQuery(filters)`:

- When `useIsOnline()` is false and a db exists, use `useLocalQuery`. The `read` is `searchLocalExercises(db, filters, lang, gym)`, and the result has the infinite query shape `{ pages: [{ items, nextCursor: null }], pageParams: [undefined] }`. Return it as the same type, with `hasNextPage` false.
- Online, keep the network query.
- Export `useLocalExerciseCount()`, which returns `countLocalExercises(db)` through `useLocalQuery`.

`ExerciseCatalog` (library, D16.5, D16.6, D16.8):

- Offline: the search placeholder becomes "Search saved exercises".
- Under the search row, add the hint line: a 14px outline diamond in `--muted-foreground` and 14/20 `--muted-foreground` text. It has no card and no fill, with 12px gap to the search row.
- The list keeps its groups and rows.
- The "+" button (desktop: "New exercise") is already disabled offline by spec 07. Keep it.
- Offline with a query and no result (D16.6): replace the online "Nothing found" state with a card (`bg-card`, 6px radius, padding `24px 20px`). It holds the title 20/800, the body 15/22 muted, and the secondary button "Clear search" (44px, `border-strong` outline), which clears `q`.
- Desktop (D16.8): the same hint line under the toolbar, `max-w-[880px]`.

`ExercisePicker` and `usePickerCatalog` (session "Add exercise", D16.7):

- Offline: the same placeholder and hint line between the search and the list.
- The rows and pick diamonds do not change. The offline empty state is the same card as D16.6.

Spec 17 owns the status pill, the offline strip on Today and the hints on other disabled controls.

## 7. Copy

Add to `src/i18n/locales/en.json` and `uk.json`. The key is the English text. Plural keys use the i18next `_one/_few/_many/_other` forms that the catalog already uses.

| en | uk |
| --- | --- |
| Preparing your data for the gym | Готуємо дані для залу |
| We save your workouts on this phone so they work without a network. This happens only once. | Зберігаємо твої тренування на телефоні, щоб вони працювали без мережі. Це потрібно лише один раз. |
| We save your workouts on this device so they work without a network. This happens only once. | Зберігаємо твої тренування на цьому пристрої, щоб вони працювали без мережі. Це потрібно лише один раз. |
| Profile and gym | Профіль і зал |
| Workouts and plan | Тренування і план |
| Exercises | Вправи (the key exists; reuse it) |
| History for 30 days | Історія за 30 днів |
| Body measurements | Заміри тіла |
| Done | Готово |
| {{done}} of {{total}} | {{done}} з {{total}} |
| {{count}} workouts (plural) | {{count}} тренування / тренувань … (plural forms) |
| {{count}} exercises (plural) | {{count}} вправа / вправи / вправ (plural forms) |
| If the connection drops, we continue from the same place. | Якщо зʼєднання перерветься, продовжимо з того самого місця. |
| Could not load the profile | Не вдалося завантажити профіль |
| Could not load the workouts | Не вдалося завантажити тренування |
| Could not load the exercises | Не вдалося завантажити вправи |
| Could not load the history | Не вдалося завантажити історію |
| Could not load the measurements | Не вдалося завантажити заміри |
| The connection dropped. What is loaded is saved on this device. Try again when you have a network. | Зʼєднання перервалося. Те, що вже завантажено, збережено на телефоні. Спробуй ще раз, коли буде мережа. |
| Not loaded | Не завантажено |
| Try again | Спробувати ще раз (reuse the key if it exists) |
| Log out | Вийти з акаунта (use a new key `Log out_download` if `Log out` has another uk text) |
| The first start needs internet | Перший запуск потребує інтернету |
| This device has none of your data yet. Connect to a network once, and after that Pampojo works without it. | На цьому пристрої ще немає твоїх даних. Підʼєднайся до мережі один раз, і далі Pampojo працюватиме без неї. |
| The download starts by itself when the network is back. | Завантаження почнеться саме, щойно зʼявиться мережа. |
| Offline | Офлайн (exists) |
| Search saved exercises | Пошук серед збережених |
| Offline, there are {{count}} exercises from your workouts and history. The rest of the catalog appears when you are online. (plural) | Без мережі тут {{count}} вправ з твоїх тренувань та історії. Решта каталогу зʼявиться з інтернетом. (plural forms: вправа / вправи / вправ) |
| No saved exercise matches | Серед збережених вправ цього немає |
| Offline, search covers only the {{count}} exercises from your workouts and history. The full catalog appears when you are online. (plural) | Без мережі пошук іде лише по {{count}} вправах з твоїх тренувань та історії. Повний каталог зʼявиться, щойно буде інтернет. (plural forms: вправі / вправах) |
| Clear search | Очистити пошук |

Use the "phone" body text on screens narrower than `lg`, and the "device" text from `lg` up.

## 8. Steps

Each step ends with `pnpm typecheck` passing.

1. **Constants and schemas.** Create `src/constants/sync.ts` and `src/shared/schemas/sync.ts` (section 3). Add schema tests in `src/shared/schemas/__tests__/sync.test.ts`.
2. **Migration.** Create `src/server/db/schema/sync.ts`, add the four indexes in their schema files, and export from `schema/index.ts`. Run `pnpm db:generate` and review the SQL. Ask the lead before `pnpm db:migrate` on the shared database.
3. **Shared workout summary.** Create `src/shared/workout-summary.ts` and make `listWorkouts` use it. The workout service tests must pass with no change.
4. **Server push.** Create `src/server/sync/{errors,push,queries}.ts` and `src/app/api/v1/sync/push/route.ts`. Add `INVALID_CURSOR` to `src/server/http/errors.ts`. Write the push tests.
5. **Server last performance.** Add `listLastPerformance` and make `getLastPerformance` use it. The existing last-performance tests must pass.
6. **Server pull.** Create `src/server/sync/{cursor,pull}.ts` and the phase queries, plus `toSyncWorkout` and `listSyncExercises`. Create `src/app/api/v1/sync/pull/route.ts`. Write the pull tests.
7. **Dexie version 2.** Change `db.ts` (stores, types, `convertOutboxToMutations`) and `outbox.ts`. Change `session-repository.ts` to enqueue typed mutations. Write the upgrade test.
8. **Repositories.** Create `workouts.ts`, `plan.ts`, `exercises.ts`, `measurements.ts` and `profile.ts` in `src/services/local-db/`, and extend `scheduled.ts`. Create `LocalDbProvider.tsx` and `useLocalQuery.ts`. Export them from `index.ts`.
9. **Sync engine.** Create `src/services/sync/{push,pull,apply,prune,engine,download,useSyncRunner,request-sync,index}.ts`. Change `logout.ts`. Delete `useOutboxRunner.ts`. Change `CurrentUser.tsx`.
10. **Query hooks.** Change `src/api/{workouts,plan,gym,profile,measurements,sessions,progress,exercises}.ts` as in 6.4 and 6.7. Change `useStartSession`.
11. **Two devices.** Add `activeSessionId` and `deviceOwned` and change the in-progress selection (6.6). Show other devices' `in_progress` sessions in `HistoryList`.
12. **Download screen.** Move the sign-out code to `src/features/auth/sign-out.ts`. Create `src/features/sync/LocalDataGate/` with `LocalDataGate.tsx`, `DownloadScreen.tsx`, `index.ts`, and render it in `CurrentUserProvider`.
13. **Offline catalog UI.** Change `ExerciseCatalog`, `ExercisePicker` and `usePickerCatalog` (6.7).
14. **Measurements offline.** Remove the offline disables in the four measurement components.
15. **Progress offline.** Allow `records: null` and show the "Needs internet" text in the records block of `ProgressScreen`.
16. **Copy.** Add the strings of section 7 to `en.json` and `uk.json`.
17. **Docs.** Update `docs/tech/API.md`, `docs/tech/DATA_MODEL.md` and `docs/tech/OFFLINE.md` (section 5).
18. **E2E.** Write `e2e/16-offline-data-sync.spec.ts`. Update the e2e helpers if a test needs a fresh device (a new browser context).
19. Run `pnpm lint`, `pnpm typecheck` and the touched test files.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/16-offline-data-sync.spec.ts` "offline session shows in history and 1m progress": seed a workout and rule, finish the download, `setOffline(true)`, start from Today, log all sets, finish, open History and Progress `1m`. |
| AC2 | Same e2e file, "outbox empties online": continue AC1, `setOffline(false)`, wait for zero outbox entries (read IndexedDB through `page.evaluate`), then compare `GET /api/v1/sessions/{id}` with the local session and sets. |
| AC3 | `src/server/sync/__tests__/push.test.ts` "a replayed batch is acknowledged as duplicate and stores one row per entity". |
| AC4 | `src/services/sync/__tests__/push.test.ts` "a lost response is retried and acknowledged as duplicate": mock `fetch` to reject after the server mock applied the batch, run `pushOutbox` twice, assert an empty outbox and one apply per mutation. Also `src/server/sync/__tests__/push.test.ts` covers the server half (AC3). |
| AC5 | `e2e/16-offline-data-sync.spec.ts` "two devices": two browser contexts of one user. Rename a workout in context A, trigger a sync in B (reload), assert the new name. Delete it in A, assert it is gone in B. |
| AC6 | `src/services/sync/__tests__/engine.test.ts` "a second sync during a running one returns busy and sends nothing" (browser mode, real Web Locks, two `PampojoDb` connections to one name). |
| AC7 | `src/services/sync/__tests__/push.test.ts`: "sends entries in seq order", "sends at most 50 per request", "deletes applied and duplicate entries", "deletes a rejected entry and keeps the others", "keeps entries and counts attempts on a 503". `src/services/sync/__tests__/useSyncRunner.test.tsx`: "retries with backoff from 2 s to 60 s" (fake timers). |
| AC8 | `src/server/sync/__tests__/push.test.ts` "a rejected mutation does not stop the batch": an invalid set payload in the middle. `src/services/sync/__tests__/push.test.ts` "deletes a rejected entry and saves lastError". |
| AC9 | `src/server/sync/__tests__/push.test.ts` "an unexpected error rolls back the batch": stub one handler to throw a plain `Error`, assert no row of the earlier mutations and no `sync_mutation` rows. Client: "keeps entries and counts attempts on a 503" (AC7). |
| AC10 | `src/features/sync/LocalDataGate/__tests__/LocalDataGate.test.tsx`: "shows the steps while downloading", "shows the error with retry and log out on a failure", "shows the offline state with no logout when offline and empty", "renders the children after the download". Mock `@/api/http` for the pull. E2E: "fresh device sees the download screen" (new context, login, screen visible, then Today). |
| AC11 | `src/features/exercises/ExerciseCatalog/__tests__/ExerciseCatalog.test.tsx` "offline shows local exercises, the hint and the offline empty state". `src/features/workouts/ExercisePicker/__tests__/ExercisePicker.test.tsx` "offline search covers only local exercises". Repository: `src/services/local-db/__tests__/exercises.test.ts` "search matches the normalized name and aliases of the locale". |
| AC12 | `src/services/local-db/__tests__/measurements.test.ts` "save on a day with a local row reuses its id", "remove enqueues measurement.delete". `src/features/measurements/MeasurementsSection/__tests__/MeasurementsSection.test.tsx` "add works offline". E2E "measurement offline syncs": add, edit and delete offline, go online, compare with `GET /api/v1/measurements`. |
| AC13 | `src/services/sync/__tests__/prune.test.ts` "deletes synced sessions older than 30 days and keeps pending ones". `src/features/history/HistoryList/__tests__/HistoryList.test.tsx` "loads older pages from the server and drops local duplicates". |
| AC14 | `src/services/sync/__tests__/apply.test.ts` "a pulled in-progress session keeps local rest and drafts" and "a pulled in-progress session is not active when this device has its own". `src/features/session/hooks/__tests__/useInProgress.test.tsx` "takes another device's session when there is no local one". |
| AC15 | `src/services/local-db/__tests__/db-upgrade.test.ts` "version 1 REST entries become typed mutations with the same ids and order": create a version 1 database with the old class, open it with `PampojoDb`, assert the entries. Push test: the converted entries push once each. |
| AC16 | `src/server/sync/__tests__/pull.test.ts`: "a row with updatedAt inside the overlap comes again and the client upsert keeps one row", "a row written with an updatedAt before the cursor but inside 30 s comes in the next pull", "a full download sends totals and only live rows", "an incremental pull sends tombstones", "rows of another user never come", "an exercise newly referenced by a workout comes", "the query count is constant for 2 and 20 workouts". `src/services/sync/__tests__/apply.test.ts` "applying the same page twice keeps one row". |

Other tests:

- `src/app/api/v1/sync/__tests__/push.test.ts` and `pull.test.ts`: auth required (401), invalid body (400), invalid cursor (400).
- `src/server/sync/__tests__/push.test.ts`: "a mutation id of another user is rejected", "measurement.put on a day with a row merges as the REST endpoint does".
- `src/services/sync/__tests__/apply.test.ts`: "a pulled measurement deletes the local row of the same day with another id", "a row with a pending outbox entry is not overwritten", "an abandoned session deletes the local copy".
- `src/services/local-db/__tests__/useLocalQuery.test.tsx`: "updates the result when the table changes".
- `src/shared/__tests__/workout-summary.test.ts`: thumbnails, unique ids and top muscles.

## 10. Risks and open questions

- **`navigator.onLine` is not reliable.** It can be true with no real network. The catalog then tries the server and shows an error, not the local list. Spec 17 adds the health ping, and `useIsOnline` then gets the better value with no change here.
- **The download blocks the app.** A user with much data waits on the first start. 30 days of sessions and 500-row pages keep the download to a few requests. Measure it on the seeded test account during `/review`.
- **Exercise details offline.** `ExerciseDetails` still reads the server with its cache. Opening the details of a local exercise offline with no cache shows the existing offline state. The spec does not list this screen. Spec 17 can move it to Dexie.
- **`http` retries.** `http.ts` retries a POST only with an `Idempotency-Key` header. The push sends none, so a lost response waits for the next sync run (2 s backoff). This is correct, because the replay comes back as `duplicate`.
- **System catalog changes.** The seed changes `updated_at` of system rows when it runs. The next pull then sends only the referenced exercises, because the phase filters by references.
- **ADR 0005.** The ADR says that the device mirrors the whole catalog and history. The lead has not answered the proposal to amend it. This does not block the implementation.
- **Out of scope:** the status pill, pending count, sync sheet and last error UI, the logout guard and image caching (spec 17). Clean-up of old `sync_mutation` rows and tombstones (spec 16 "Out of scope").

## 11. Implementation notes

- The lead approved `pnpm db:migrate` on the shared database. Migration `0008_flat_menace.sql` adds only `sync_mutation` and the four indexes.
- Dexie tests are `.test.tsx`, because the Vitest `browser` project includes only `.tsx` files.
- `applyRuleDelete` moved to `src/shared/plan/rule-delete.ts`, so `local-db` does not import `src/api`. `src/api/plan.ts` re-exports it.
- `toSyncWorkout` and `listSyncExercises` live in `src/server/sync/pull.ts` and `pull-queries.ts`, not in the workouts and exercises services.
- The pull cursor keeps `updated_at::text` with microseconds, so a page edge never repeats or skips a row.
- `findProfile` takes an optional `db`, so pull runs inside a test transaction.
- History: `useSessionHistoryQuery` did not change. `HistoryList` already merges the local sessions with the server pages, which gives the planned result.
- Progress offline: the screen uses two new hooks (`useLocalProgressExercisesQuery`, `useLocalExerciseProgressQuery`) instead of a fallback inside the server hooks.
- Own exercises reach Dexie through the next pull (`requestSync()`). After a workout save, `putMissingWorkoutExercises` stores a placeholder row for each new exercise from the response summary, so names show at once; the pull replaces it. The full e2e run found this gap (empty names in the reopened workout).
- `useInProgress` reads only Dexie; pull brings sessions of other devices. `activeSessionId` lives in `meta.sync`, and `repository.activate` runs when a session page opens.
- `useMeasurementsAvailable` is in `src/features/measurements/hooks/`, because tests mock `@/api/measurements`.
- No `useSyncRunner` backoff test: it needs our own engine mocked. Retry is covered by the push tests (entries stay, attempts grow).
- E2E AC1 checks the offline set log and finish on the session page. Offline navigation to History and Progress needs the service worker, which the dev server blocks; the local reads have unit tests.
- Three older e2e tests checked behaviour that spec 16 changed, so they were updated: `06` "offline notice" now checks the offline hint, `14` AC13 now checks that writes stay enabled offline, and `12` AC6 waits for the `session.put` mutation in `/sync/push` instead of `PUT /sessions`.

## 12. Review — 2026-11-21

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/16-offline-data-sync.spec.ts` "sets logged offline…"; History and `1m` progress from Dexie: `src/services/local-db/progress.ts`, `HistoryList` local merge (offline navigation not walkable on the dev server, see finding 6) |
| AC2 | Pass | `e2e/16-offline-data-sync.spec.ts` "sets logged offline…" (outbox empties, server session and sets match) |
| AC3 | Pass | `src/server/sync/__tests__/push.test.ts` "applies a batch and acknowledges a replay as duplicate" |
| AC4 | Pass | `src/services/sync/__tests__/push.test.tsx` "retries a batch whose response was lost" |
| AC5 | Pass | `e2e/16-offline-data-sync.spec.ts` "a workout changed on one device…" |
| AC6 | Pass | `src/services/sync/__tests__/engine.test.tsx` (two connections, real Web Locks) |
| AC7 | Pass | `src/services/sync/__tests__/push.test.tsx` (order, batches of 50, rejected, 503); no backoff timer test (Implementation notes) |
| AC8 | Pass | server and client push tests "rejected…" |
| AC9 | Pass | `push.test.ts` "rolls back the whole batch"; client "keeps every entry … on a 503" |
| AC10 | Pass | `LocalDataGate.test.tsx`; `AC10-{mobile,desktop}-{running,error,offline-empty}.png` match D16.1–D16.4 |
| AC11 | Fail (picker) | Library: `AC11-*-library-offline*.png`, `ExerciseCatalog.test.tsx`. Session picker: `AC11-desktop-session-offline.png`, finding 1 |
| AC12 | Pass | `e2e/16-offline-data-sync.spec.ts` "a measurement added offline…"; `AC12-*-add-offline.png` |
| AC13 | Pass | `src/services/sync/__tests__/prune.test.tsx`; history pages online: `HistoryList.test.tsx` |
| AC14 | Pass | `src/services/sync/__tests__/apply.test.tsx` (local fields kept, `deviceOwned: false`); `HistoryList` `OtherDeviceSessions` |
| AC15 | Pass | `src/services/local-db/__tests__/db-upgrade.test.tsx` |
| AC16 | Pass | `src/server/sync/__tests__/pull.test.ts` "overlap … late row", `apply.test.tsx` "same page twice" |

### Findings

1. [major] The session "Add exercise" button stays disabled offline, so the offline picker (D16.7, part of AC11) cannot open — `src/features/session/ActiveSession/SessionExerciseList.tsx:211`. The spec 10 rule was not lifted. Session plan edits already go through the outbox (`updatePlan`), and the server validates the new exercises, so the button can be enabled when the device has a local database.
2. [major] A device that updates to this version while offline cannot open the app — `src/services/sync/download.ts:48`, `src/features/sync/LocalDataGate/LocalDataGate.tsx:13`. A spec 10 database has no `downloadVersion`, so the gate asks for a full download and shows "The first start needs internet", also over an in-progress session in its local copy. Spec 15 activates a new worker on the next launch, which can be in the gym. A database that already has sessions or an outbox can open at once and run the download in the background.
3. [minor] `pushOutbox` loops on the same batch if the server answers without some ids — `src/services/sync/push.ts:77`. Only an empty answer stops the loop. The server answers every id today, so this is defensive.
4. [minor] On desktop the offline hint sits in the filter column, not under the toolbar as in D16.8 — `src/features/exercises/ExerciseCatalog/ExerciseCatalog.tsx:268`, `AC11-desktop-library-offline.png`. The text is right; the place differs.
5. [minor] The gate renders nothing while it reads `meta` — `src/features/sync/LocalDataGate/LocalDataGate.tsx:11`. On a slow device this is a short blank screen before every app page.
6. [minor] Offline with local history but no server page, the list has no "Older workouts appear when you are online." line — `src/features/history/HistoryList/HistoryList.tsx:203`. The user cannot tell that older sessions exist.
7. [minor] Four e2e tests fail only in the full parallel run and pass alone: `06` offline hint, `06` Ukrainian content, `07` duplicate exercise, `09` drag to reorder. Not compared with `main`.

### Checks

- lint: pass (`pnpm lint`).
- typecheck: pass (`pnpm typecheck`).
- tests: pass, 146 files, 892 tests (`pnpm test`).
- e2e: `e2e/16-offline-data-sync.spec.ts` 8/8 (mobile, desktop). Full suite: 207 passed, 4 failed (finding 7), 23 skipped.
- Scope: every pull query filters by the user (`src/server/sync/pull-queries.ts`), push calls the user-scoped services, and `sync_mutation` lookups use `userId`. No secrets or build output in the diff.

### Out of scope

- Exercise images offline: thumbnails are not cached, and own-exercise frames have signed URLs that expire after 1 hour (`SIGNED_URL_TTL_SECONDS`). Desktop cards show large empty tiles offline (`AC11-desktop-library-offline.png`). Spec 17.
- `touch()` uses the Node clock, and the pull cursor uses the database clock. A skew above 30 seconds can miss rows. A later change can set `updated_at = now()` in SQL.
- The ADR 0005 amendment that `/grilling 16` proposed is still open.

## 13. Review fixes — 2026-11-21

The lead asked to fix every finding of section 12.

1. Fixed. With a local database, the session "Add exercise" button stays enabled offline, so the offline picker (D16.7) opens — `SessionExerciseList.tsx`.
2. Fixed. A download that starts while the device already has sessions or an outbox stores `background: true`. The gate then shows the app and the download runs behind it — `download.ts`, `LocalDataGate.tsx`, test "opens the app during the download…". A retry also keeps the received counts instead of setting them to zero.
3. Fixed. `pushOutbox` stops with `failed` when the answer misses an id of the batch — `push.ts`, test "stops instead of resending…".
4. Fixed. On desktop the hint leads the results column, as in D16.8. On a phone it stays under the search.
5. Fixed. The gate shows the layout skeleton (`AppShellSkeleton`, `SessionSkeleton`) while it reads the device state. `SessionGate` and `CurrentUserProvider` pass it as `fallback`.
6. Fixed. Offline with local rows and no server page, History shows "Older workouts appear when you are online."
7. Partly fixed. A full download that fits one page now counts its own rows and does not run every phase a second time. E2E with `--retries=1` on the local dev server, same machine:
   - `main`: 198 passed, 1 failed, 4 flaky, 4.0 min.
   - this branch: 199 passed, 0 failed, 12 flaky, 5.3 min.
   - Each test is a new device, so it waits for the first download (about 15 sequential SQL queries) before the first app page. Every flaky test passes alone. CI runs a production build with one retry.

Checks after the fixes: lint pass, typecheck pass, `pnpm test` 146 files and 895 tests pass, `e2e/16-offline-data-sync.spec.ts` and `06:154` pass.

## 14. Offline fixes on the production build — 2026-11-21

A check on `next build` with the service worker found that AC1 failed. The dev server blocks the worker, so the e2e run did not find it.

1. Fixed. The "Choose workout" sheet showed "Needs internet" for every workout offline. This was the spec 10 rule for a cache-only device. With a local database, the sheet now lets the user start any workout — `StartWorkoutSheet.tsx`.
2. Fixed. A session started offline opened the offline fallback, because its new URL had no stored copy. The worker now serves the shared session shell, and `ActiveSession` reads the id from the address bar — `src/app/sw.ts`, `ActiveSession.tsx`.
3. Fixed. Pages not opened online showed the offline fallback. The app now loads the main pages in the background — `useWarmAppPages`, `warmMissingPages`. The page rule ignores the query.
4. Fixed. `touch()` sets `updated_at` with the database `now()`, which removes the clock skew risk of section 12.
5. The spec 15 e2e test AC2 now uses `/profile/gym` as the page with no visit, because the app loads `/progress` in the background.

New e2e test: "a workout started offline opens, finishes and shows in history and progress (AC1)". It runs on the production build only.

Checks: lint, typecheck and format pass. `pnpm test` passes 146 files and 899 tests. `CI=1` e2e for specs 15 and 16 on `next build` passes 18 of 18. Full e2e on the dev server with one retry: 204 passed, 0 failed, 7 flaky.
