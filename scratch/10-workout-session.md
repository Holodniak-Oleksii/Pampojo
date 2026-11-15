# 10-workout-session — technical plan

Spec: `docs/specs/10-workout-session.md`

## 1. Summary

Session mode, local first:

- Starting a workout writes a session (with an immutable workout snapshot and an editable session plan) to a per-user Dexie database.
- Every write also appends an outbox entry in the same Dexie transaction. A small outbox runner replays the entries in order against new idempotent REST endpoints (`/api/v1/sessions`, `/api/v1/sets`). Spec 16 later moves it to `/sync/push`.
- The session screen `/session/[id]` is full screen, follows the system dark theme and reads everything through `useLiveQuery`. It covers:
  - prefilled set rows and one-tap logging;
  - a rest timer computed from `restEndsAt`, with vibration and sound;
  - the exercise list with reorder, add and remove;
  - the note, finish with a summary, and abandon;
  - Wake Lock;
  - a forgotten-session dialog;
  - minimizing into a session bar inside the app shell.
- Starting comes from the Start sheet, the workout card menu and the saved editor.
- Log out flushes the outbox, warns if entries remain and deletes the local database.
- Deleting an own exercise also removes its set logs and lists the completed sessions that logged it.

New dependencies: `dexie`, `dexie-react-hooks` (DECISIONS 2026-11-15 "Session plan choices").

## 2. Acceptance criteria

- **AC1:**
  - Starting a workout writes a local session and `PUT /api/v1/sessions/{id}`, then navigates to `/session/{id}`.
  - The session has `workoutSnapshot` (the workout as it was) and `exercises` (the session plan).
  - Editing or deleting the workout afterwards changes neither the snapshot, nor the plan, nor the session screen.
- **AC2:**
  - When a row is prefilled with the main metric, one tap on its check writes a set log locally and through the outbox (`PUT /api/v1/sets/{id}`), and starts the rest timer.
  - The timer length is 90 s, or the length last set with −15/+15 for that exercise on this device (`localStorage`).
- **AC3:** The remaining rest is computed from the stored `restEndsAt`, never from a counter. After the tab is hidden for longer than the rest, the timer shows "+m:ss" counting up and the "Час на підхід N" label.
- **AC4:**
  - Set row N prefills from set N of the last completed session with this exercise (performed `exerciseId`, abandoned and deleted excluded).
  - Without that set, it prefills from the targets: reps from `targetRepsMin`, weight from `targetWeightKg`, duration and distance from their targets. Otherwise the field is empty.
  - "Минулого разу: <first set>" shows the first set of that session, or nothing.
- **AC5:** A reload during a session restores, both online and with the network off:
  - all logged sets;
  - the plan order and added exercises;
  - the current exercise;
  - unlogged field edits;
  - the running rest timer.
- **AC6:**
  - The same `PUT /api/v1/sets/{id}` or `PUT /api/v1/sessions/{id}` sent twice leaves one row.
  - `DELETE /api/v1/sets/{id}` twice leaves one soft-deleted row and returns 204 both times.
- **AC7:** Sets logged with the network off stay in the outbox. When the network returns (the `online` event), the outbox sends them in order and empties, and the server has the same sets (e2e with `setOffline`).
- **AC8:**
  - "Завершити" with unchecked rows asks "Завершити тренування?" first. With no logged set it offers "Видалити тренування" / "Продовжити" instead.
  - After finishing, the same route shows the summary: duration, volume, sets, exercises, and a row per exercise.
  - The server row is `completed` with `finishedAt`. The Start sheet no longer offers to continue it.
  - Opening `/session/{id}` again shows the summary.
- **AC9:** "Видалити тренування" asks first, then:
  - sets `status = abandoned` and soft deletes its set logs (server, in one transaction, and locally);
  - goes to `/today`;
  - the session no longer appears in lists or in "last time", and its URL shows "Тренування не знайдено".
- **AC10:**
  - While a session is in progress (local, or on the server when online), the Start sheet shows only "Тренування триває" with the card, "Продовжити <name>" and the hint. "Почати" in the card menu and in the editor opens that session.
  - A session in progress for more than 12 hours shows the forgotten-session dialog when the Start sheet or the session opens. "Завершити" sets `finishedAt` to the last logged set's `completedAt` (or `startedAt` when none), and "Видалити" abandons it.
- **AC11:**
  - A row's check is disabled until its main metric is filled: reps (`weight_reps`, `reps`), duration (`time`) or distance (`distance`). Weight may be empty and is stored as `null`.
  - Tapping a logged row's check unlogs it: the set log is soft deleted (`DELETE`), the row keeps its values, and a rest timer started from that set stops.
- **AC12:**
  - Exercises can be reordered by drag in the list sheet or panel, added through the 09 picker (appended with default targets, weight empty) and removed when they have no logged sets. A reload keeps the result.
  - Limits are enforced by the client and the server (400): 30 exercises, 20 rows per exercise, weight 0–500 step 0.25, reps 1–100, duration 1–3600 s, distance 1–100 000 m, note 1000.
- **AC13:**
  - Another user's session id returns 404 `SESSION_NOT_FOUND` on `GET`/`PUT`/`PATCH /sessions/{id}`.
  - A set of another user's session returns 404 `SESSION_NOT_FOUND` on `PUT`/`PATCH`/`DELETE /sets/{id}`.
  - Set writes and plan or note `PATCH`es on a completed or abandoned session return 409 `SESSION_NOT_IN_PROGRESS`.
- **AC14:**
  - Log out first sends the outbox. If entries remain, the dialog "Вийти з акаунта?" appears.
  - After logging out, every `pampojo-*` IndexedDB database is deleted.
- **AC15:**
  - The own exercise delete dialog lists the completed sessions that logged the exercise (workout name and date), from `GET /api/v1/sessions?status=completed&exerciseId=`.
  - After confirming, those set logs are soft deleted, and the exercise is removed from `exercises` of the user's sessions in progress.
- **AC16:**
  - The session screen uses the dark session tokens when `prefers-color-scheme: dark`, and the app palette otherwise.
  - Mobile 390px is one column with 48px targets.
  - Desktop 1440px has three columns: exercise list, current exercise, and rest plus note.
  - No horizontal scroll in en and uk.
- **AC17:**
  - "Згорнути" goes to `/today` and the session keeps running.
  - A session bar sits above the mobile bottom nav and at the top of the desktop sidebar under "Почати тренування". It shows the name and the rest left (or the elapsed time). "Повернутися" opens `/session/{id}`.

## 3. Data

### Tables (migration `0005`, additive only) — `src/server/db/schema/session.ts`, re-exported from `schema/index.ts`

`workout_session`:

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | client id |
| user_id | uuid not null → user (cascade) | |
| workout_id | uuid null → workout (`set null`) | always set by spec 10 |
| scheduled_for | date null | unused until 11 |
| workout_snapshot | jsonb not null | `WorkoutSnapshot`, never updated |
| exercises | jsonb not null | `SessionExercise[]`, session order |
| status | text not null | check `in ('in_progress','completed','abandoned')` |
| started_at | timestamptz not null | |
| finished_at | timestamptz null | check: null iff status = in_progress, except abandoned may have null |
| notes | text null | check `char_length <= 1000` |
| created_at, updated_at | timestamptz not null default now() | |

Indexes:

- `workout_session_user_status_idx (user_id, status, started_at desc)`;
- `workout_session_user_updated_idx (user_id, updated_at)` for spec 16;
- an index on `workout_id`.

`set_log`:

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | client id |
| session_id | uuid not null → workout_session (cascade) | |
| session_exercise_id | uuid not null | an `exercises[].id` |
| exercise_id | uuid not null → exercise (cascade) | performed exercise |
| substituted_from_exercise_id | uuid null → exercise (`set null`) | unused until 18 |
| set_index | smallint not null | 0-based row, check 0–19 |
| weight_kg | numeric(5,2) null | check 0–500 |
| reps | smallint null | check 1–100 |
| duration_sec | integer null | check 1–3600 |
| distance_m | integer null | check 1–100000 |
| rpe | numeric(3,1) null | unused |
| completed_at | timestamptz not null | |
| created_at, updated_at, deleted_at | timestamptz | |

Indexes:

- `set_log_session_idx (session_id)`;
- `set_log_exercise_idx (exercise_id)`;
- a unique index on `(session_id, session_exercise_id, set_index) where deleted_at is null`.

`exercise_position` from the draft model is not created (the order lives in `exercises`). Update `docs/tech/DATA_MODEL.md` (`workout_session.exercises`, `set_log.sessionExerciseId`, dropped `exercisePosition`, ranges) and `docs/tech/API.md` (the session rows) in the same step as the migration.

### Constants — `src/constants/session.ts`

```ts
export const SESSION_STATUS = { IN_PROGRESS: 'in_progress', COMPLETED: 'completed', ABANDONED: 'abandoned' } as const;
export const SESSION_EXERCISES_MAX = 30;      // = WORKOUT_EXERCISES_MAX
export const SESSION_SETS_MAX = 20;
export const SESSION_NOTE_MAX = 1000;
export const DEFAULT_PLANNED_SETS = 3;
export const SET_RANGE = {
  weightKg: { min: 0, max: 500, step: 0.25 },
  reps: { min: 1, max: 100 },
  durationSec: { min: 1, max: 3600 },
  distanceM: { min: 1, max: 100_000 },
} as const;
export const REST = { defaultSec: 90, stepSec: 15, minSec: 15, maxSec: 600 } as const;
export const FORGOTTEN_AFTER_MS = 12 * 60 * 60 * 1000;
export const CLOCK_SKEW_MS = 5 * 60 * 1000;   // client timestamps may be at most this far in the future
export const SESSION_LIST_LIMIT = 200;
/** The main metric that must be filled before a set can be logged. */
export const MAIN_METRIC = { weight_reps: 'reps', reps: 'reps', time: 'durationSec', distance: 'distanceM' } as const;
/** Value fields per tracking type. */
export const SET_FIELDS = {
  weight_reps: ['weightKg', 'reps'], reps: ['reps'], time: ['durationSec'], distance: ['distanceM'],
} as const;
```

### Zod — `src/shared/schemas/session.ts`

- `sessionIdParamsSchema`, `setIdParamsSchema` (`{ id: z.uuid() }`).
- `snapshotExerciseSchema`:
  - the workout entry fields `id, exerciseId, target…, notes`;
  - `exercise: { id, name, trackingType, laterality, thumbnailUrl }`.
- `workoutSnapshotSchema`: `{ workoutId, name (1–80), description|null, exercises: snapshotExerciseSchema[] (0–30) }`.
- `sessionExerciseSchema`:
  - `{ id: uuid, exerciseId: uuid, plannedSets: int 1–20, targetSets…targetDistanceM (nullable, same ranges as workouts), notes|null (≤300) }`;
  - `exercise: { id, name, trackingType, laterality, thumbnailUrl }`, so added exercises render without a lookup.
  - `.strict()`.
- `putSessionInputSchema`: `{ workoutId: uuid, workoutSnapshot, exercises: sessionExerciseSchema[] (1–30, unique ids), startedAt: iso datetime }`, `.strict()`.
- `patchSessionInputSchema`, `.strict()`, at least one key:
  - `{ exercises?: …(1–30), notes?: string ≤1000 | null, status?: 'completed' | 'abandoned', finishedAt?: iso }`;
  - a refine: `status === 'completed'` requires `finishedAt`.
- `putSetInputSchema`, `.strict()`:
  - `{ sessionId, sessionExerciseId, exerciseId, setIndex: int 0–19, weightKg: number|null (0–500, multipleOf 0.25), reps: int 1–100|null, durationSec: int 1–3600|null, distanceM: int 1–100000|null, completedAt: iso }`.
- `patchSetInputSchema`: the four value fields, optional, `.strict()`, at least one.
- `setLogSchema`: the put fields plus `id`.
- `sessionSchema`: `{ id, workoutId|null, workoutSnapshot, exercises, status, startedAt, finishedAt|null, notes|null, updatedAt, setLogs: setLogSchema[] }`.
- `sessionListQuerySchema`: `{ status?: 'in_progress' | 'completed', exerciseId?: uuid }`.
- `sessionListItemSchema`: `{ id, workoutId|null, workoutName, status, startedAt, finishedAt|null }`.
- `sessionListResponseSchema`: `{ items }`.
- `lastPerformanceResponseSchema`: `{ item: null | { sessionId, finishedAt, sets: { setIndex, weightKg, reps, durationSec, distanceM }[] } }`.
- Types via `z.infer` / `z.input`: `WorkoutSnapshot`, `SessionExercise`, `Session`, `SetLog`, `PutSessionInput`, `PatchSessionInput`, `PutSetInput`, `PatchSetInput`, `SessionListItem`, `LastPerformance`.

Server-side rules on top of the schema (in the service):

- **`PUT /sets` values:**
  - fields not in `SET_FIELDS[trackingType]` must be null;
  - the main metric must be non-null;
  - otherwise 400 `VALIDATION_FAILED` with the path.
- **Timestamps:** `startedAt`, `finishedAt` and `completedAt` must not be later than now + `CLOCK_SKEW_MS`, and `finishedAt ≥ startedAt`. Otherwise 400.

### Local database — `src/services/local-db/db.ts`

The Dexie database is named `pampojo-<userId>`, version 1:

```ts
sessions:        'id, status, startedAt'            // LocalSession
setLogs:         'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]'
lastPerformance: 'exerciseId'                       // { exerciseId, finishedAt, sets, fetchedAt }
outbox:          '++seq'                            // OutboxEntry
```

`LocalSession` is `Session` without `setLogs`, plus these device-only fields (never sent):

- `restEndsAt: string | null`;
- `restDurationSec: number`;
- `restSetId: string | null`;
- `currentEntryId: string | null`;
- `drafts: Record<string, { weightKg; reps; durationSec; distanceM }>`, keyed `${entryId}:${setIndex}`, the unlogged field edits.

`LocalSetLog` is `SetLog` plus `deletedAt: string | null`.

`OutboxEntry` is `{ seq?, id: uuid, method: 'PUT' | 'PATCH' | 'DELETE', path, body?, createdAt, attempts }`.

Rows read from IndexedDB are parsed with the Zod schemas before use (`typescript.md`).

## 4. API

All routes use `withHandler({ auth: 'required' })`, scope by `userId`, and send `Cache-Control: private, no-store`. Add the error codes to `ERROR_STATUS`: `SESSION_NOT_FOUND: 404`, `SESSION_NOT_IN_PROGRESS: 409`.

| Method and path | Body / query | Response | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/sessions` | `?status=&exerciseId=` | `{ items: SessionListItem[] }` | Never abandoned; without `status` both in_progress and completed; `exerciseId` = sessions with a non-deleted set of it; newest `startedAt` first; ≤200; one query |
| `GET /api/v1/sessions/{id}` | — | `Session` | 404 for missing, foreign or abandoned |
| `PUT /api/v1/sessions/{id}` | `PutSessionInput` | `Session` (200) | Creates; a repeat with an existing own id returns the row unchanged (first write wins); foreign id → 404; workout must be the user's (deleted allowed for replays) else 400; every `exercises[].exerciseId` and snapshot exercise must be system or own non-deleted else 400 |
| `PATCH /api/v1/sessions/{id}` | `PatchSessionInput` | `Session` | Writes only present fields. `exercises`/`notes` need `in_progress` (409). `status: completed` from `in_progress` sets `finishedAt`; repeat of the same status → 200 unchanged; `completed → abandoned` or the reverse → 409. `abandoned` soft deletes all its set logs in the same transaction and sets `finishedAt` if absent |
| `PUT /api/v1/sets/{id}` | `PutSetInput` | `SetLog` | Session must be own (404) and `in_progress` (409); `sessionExerciseId` must exist in `exercises` with the same `exerciseId` (400); values per tracking type (400). Upsert by id, clearing `deletedAt`; an id that belongs to another session → 404 |
| `PATCH /api/v1/sets/{id}` | `PatchSetInput` | `SetLog` | Own + in_progress; values re-validated with the merged row |
| `DELETE /api/v1/sets/{id}` | — | 204 | Own (404); already deleted → 204; otherwise needs in_progress (409) |
| `GET /api/v1/exercises/{id}/last-performance` | — | `LastPerformance` | Latest `completed` session (by `finished_at`) with a non-deleted set where `exercise_id = id`; its non-deleted sets of that exercise ordered by `set_index`; `item: null` when none or the exercise is not visible |

Idempotency (`request-safety.md`): every create is a `PUT` with a client id. `DELETE` and status repeats are no-ops. Each write endpoint test sends the same request twice.

## 5. Server

- **`src/server/sessions/errors.ts`:** `SESSION_ERROR = { NOT_FOUND: 'SESSION_NOT_FOUND', NOT_IN_PROGRESS: 'SESSION_NOT_IN_PROGRESS' }`.
- **`src/server/sessions/queries.ts`** (`import 'server-only'`, every query filters by `user_id` directly or through a join on `workout_session.user_id`):
  - `lockSessionRow(tx, id)` (`for update`, no owner filter; the service maps foreign to 404);
  - `insertSession`, `updateSessionColumns(tx, userId, id, fields)` (only present fields + `touch()`);
  - `findSessionRow(db, userId, id)`, `listSessionRows(db, userId, { status, exerciseId })`;
  - `listSetLogRows(db, sessionId)`, `lockSetRow(tx, id)`, `upsertSetLog(tx, values)`, `softDeleteSetLog(tx, id)`, `softDeleteSessionSetLogs(tx, sessionId)`;
  - `findLastPerformanceRows(db, userId, exerciseId)` (one SQL with a CTE: the latest session, then its sets);
  - `softDeleteExerciseSetLogs(tx, userId, exerciseId)`;
  - `removeExerciseFromInProgressSessions(tx, userId, exerciseId)`: one `update … set exercises = (select jsonb_agg(e) from jsonb_array_elements(exercises) e where e->>'exerciseId' <> $id)`, only for rows that contain it, with `updated_at = now()`.
- **`src/server/sessions/service.ts`:** `listSessions`, `getSession`, `putSession`, `patchSession`, `putSet`, `patchSet`, `deleteSet`, `getLastPerformance`.
  - Writes run in a transaction with `lockSessionRow`.
  - Tracking types come from `exercises[].exercise.trackingType` of the session, checked against the database for `PUT /sessions` only, through `findVisibleExercises` from `server/workouts/queries.ts`.
  - Numeric columns are converted with `Number()` as in workouts.
- **Routes:**
  - `src/app/api/v1/sessions/route.ts` (GET);
  - `src/app/api/v1/sessions/[id]/route.ts` (GET, PUT, PATCH);
  - `src/app/api/v1/sets/[id]/route.ts` (PUT, PATCH, DELETE);
  - `src/app/api/v1/exercises/[id]/last-performance/route.ts` (GET).
  - Each handler calls one service function.
- **Own exercise delete:** `src/server/exercises/write-service.ts` `deleteOwnExercise` also calls `softDeleteExerciseSetLogs` and `removeExerciseFromInProgressSessions` inside its existing transaction.

## 6. Client

### Dependencies

`pnpm add dexie dexie-react-hooks` (exact current versions in `package.json`).

### API module — `src/api/sessions.ts`

- `sessionKeys` (`all`, `list(filters)`, `detail(id)`, `lastPerformance(exerciseId)`).
- Fetchers through `http`: `fetchSessions(filters)`, `fetchSession(id)` (null on `SESSION_NOT_FOUND`), `fetchLastPerformance(exerciseId)`.
- Hook `useSessionsQuery(filters, { enabled })` for the delete dialog and the in-progress lookup.
- No mutation hooks: writes go through the repository and the outbox.

### Current user

- New `src/features/auth/CurrentUser/` (`CurrentUserProvider`, `useCurrentUserId`). It is a client context with the user id.
- `src/app/[lang]/(app)/session-gate.tsx` wraps its children in `<CurrentUserProvider userId={session.user.id}>`.
- The provider also mounts the outbox runner (below) once per signed-in tree.

### Local database and repository — `src/services/local-db/`

- `db.ts`: the `PampojoDb` Dexie class (section 3); `openLocalDb(userId)` is memoized per user.
- `outbox.ts`:
  - `enqueue(db, entry)` is only called inside a repository transaction;
  - `flushOutbox(db, { onDropped })` runs under `navigator.locks.request('pampojo-outbox-<userId>', { ifAvailable: true })` and is a no-op when the lock is taken. It takes the lowest `seq`, sends `http(path, { method, body })`, and handles the result:
    - 2xx: delete the entry;
    - `ApiError` with status 0 (network) or ≥ 500: stop and schedule a retry with backoff 2 s → 4 → 8 … max 60 s, reset on success;
    - 4xx: delete the entry and call `onDropped(entry, error)`.
  - `pendingCount(db)`.
- `useOutboxRunner(userId)` (in `src/services/local-db/useOutboxRunner.ts`):
  - flushes on mount, on `online`, on `visibilitychange` to visible, and after each enqueue (a Dexie `outbox` table hook or a module event);
  - `onDropped` shows the toast "Couldn't save a change to the server.";
  - a dropped entry for a set leaves the local row as is (spec 16 reconciles).
- `session-repository.ts`: `createSessionRepository(db)` implements the `SessionRepository` interface from `state-and-data.md`, extended. Every method is one `db.transaction('rw', …)` that updates local tables and calls `enqueue`.
  - **Reads:**
    - `useSession(id)`: `useLiveQuery` → `{ session, setLogs }`;
    - `useInProgressSession()`;
    - `findInProgress()`.
  - **Start:** `start({ workout, startedAt })`:
    - builds the snapshot and `exercises` (`plannedSets = targetSets ?? 3`, new entry ids);
    - writes the local row with `restEndsAt: null` and `currentEntryId: first`;
    - enqueues `PUT /sessions/{id}`.
  - **Sets:**
    - `logSet({ sessionId, entryId, setIndex, values })` reuses the id of an existing local set (also a deleted one) at that position, else a new UUID. It writes `deletedAt: null` and `completedAt: now`, enqueues `PUT /sets/{id}`, and sets `restEndsAt = now + restSec`, `restDurationSec`, `restSetId`.
    - `editSet(setId, values)` → `PATCH /sets/{id}`, debounced 600 ms per set in the UI.
    - `unlogSet(setId)` marks it deleted, enqueues `DELETE /sets/{id}`, and clears the rest if `restSetId === setId`.
  - **Plan:**
    - `setDraft(sessionId, key, values)` is local only;
    - `updatePlan(sessionId, exercises)` → `PATCH { exercises }`. It covers add or remove set (`plannedSets ± 1`), reorder, add exercises and remove an exercise.
    - `setCurrent(sessionId, entryId)` is local only.
  - **Rest:** `setRest(sessionId, { endsAt, durationSec })` and `clearRest` are local only.
  - **Note:** `setNote(sessionId, notes)` → `PATCH { notes }`.
  - **End:**
    - `finish(sessionId, finishedAt)` → `PATCH { status: 'completed', finishedAt }`, clears the rest, updates `lastPerformance` for its exercises from the local logs, then calls `flushOutbox`.
    - `abandon(sessionId)` → `PATCH { status: 'abandoned' }` and marks local set logs deleted.
  - **Remote:** `importRemote(session)` puts a server `Session` into Dexie, used when the in-progress session or `/session/{id}` is not local.
- `last-performance.ts`:
  - `prefetchLastPerformance(db, exerciseIds)` runs online, in parallel, ignores failures, and stores the results;
  - `lastPerformanceFor(db, exerciseId)` reads the stored row, else computes it from local completed sessions.
- `logout.ts`: `flushAllLocalDbs()` finds the databases with `Dexie.getDatabaseNames()` filtered by the `pampojo-` prefix, flushes each, and returns the remaining count; `deleteAllLocalDbs()`.

### Routes

- `src/app/[lang]/session/[id]/page.tsx`:
  - `params.id` is validated as a uuid, or `notFound()`;
  - renders `<ActiveSession sessionId={id} />`;
  - metadata title "Тренування | Pampojo" (`Workout`).
- `src/app/[lang]/session/layout.tsx`:
  - `<Suspense fallback={<SessionSkeleton />}><SessionGate>{children}</SessionGate></Suspense>`, with `SessionGate` imported from `../(app)/session-gate`;
  - the `viewport-fit=cover` viewport as in the app layout;
  - no app shell.

### Session theme

- In `globals.css`, a `.session-theme` class sets `--background`, `--foreground`, `--card`, `--muted-foreground`, `--border`, `--border-strong`, `--planned` and new `--input-surface`, `--disabled-outline`, `--placeholder`, `--destructive-text` under `@media (prefers-color-scheme: dark)`. The values are the dark session table in `VISUAL_LANGUAGE.md`:
  - background `#1E1C1A`, surface `#2A2724`, input `#353130`, text `#F3F1EC`, secondary `#B3ACA3`;
  - divider `#3A3633`, strong `#4A4541`, planned `#8C857D`, disabled `#5A544F`, placeholder `#6E6862`, destructive text `#F28A84`.
  - `--primary` is `#F3F1EC` and `--primary-foreground` `#1E1C1A`.
- In light mode the same variables fall back to the app tokens, with `--input-surface: var(--card)`, `--disabled-outline: var(--planned)`, `--placeholder: var(--muted-foreground)` and `--destructive-text: var(--destructive)`.
- Register the new variables in `@theme inline`.
- `ActiveSession`'s root, and portalled sheets and dialogs opened from it, carry `session-theme bg-background text-foreground`. Pass `className` to `SheetContent`, `DialogContent` and `DropdownMenuContent`.

### Feature folder — `src/features/session/`

Entry `ActiveSession/ActiveSession.tsx` (`'use client'`):

- reads `useSession(sessionId)` through the repository from `useCurrentUserId()`;
- when the session is missing locally, fetches `fetchSession(id)` (online) and calls `importRemote`.
- **States:**
  - loading (`SessionSkeleton`, board "Завантаження, моб");
  - not found or abandoned (`SessionNotFound`, board "Не знайдено, моб"): a `--planned` outline diamond 26px, "Тренування не знайдено" (30/800), "Можливо, його видалили або посилання неправильне.", and the primary "На головну" link to `/today`;
  - `completed` → `SessionSummary`;
  - `in_progress` → the session UI.
- **Hooks:** `useWakeLock()`, which requests `navigator.wakeLock.request('screen')` while visible and again on `visibilitychange`, and ignores errors. `useNow(1000)`.

Components (each in its own folder with `index.ts`):

- **`SessionHeader`** (64px; desktop 76px with a bottom divider):
  - "Згорнути" (`ChevronDown`, 44×48, aria "Згорнути") → `router.push('/today')`;
  - the name (17/800; desktop 22/800) and the elapsed `h:mm:ss` (14, `text-muted-foreground`, tabular), with a visually hidden "Минуло";
  - "…" (`MoreHorizontal`, 48px, aria "Ще") → `SessionMenu`;
  - "Завершити" as the primary button, h-11.
- **`SessionMenu`:** a `DropdownMenu` with:
  - "Нотатка" (`PenLine`) → `NoteSheet`, desktop: focus the panel note;
  - "Звук таймера" as a `menuitemcheckbox` with a square 4px switch, stored in `localStorage` `pampojo:session:sound` (default on);
  - a separator, then "Видалити тренування" (`Trash2`, `text-[--destructive-text]`) → `AbandonDialog`.
- **`ExerciseStrip`** (mobile only, `lg:hidden`):
  - a 48px outlined button `mx-4`, aria "Усі вправи, вправа N з M";
  - one 10px diamond per exercise: done = accent fill (all planned rows logged), current = 2px `--foreground` outline with an accent half fill once a set is logged (a `linear-gradient(135deg, accent 50%, transparent 50%)`), others = 1.5px `--planned` outline;
  - the text "Вправа N з M" (secondary) and a `Menu` icon;
  - opens `ExerciseListSheet`.
- **`ExerciseHeader`:**
  - a 64px thumbnail (desktop 80) through `ExerciseImage` (falls back to a placeholder when the URL fails, for example an expired signed URL of an own exercise);
  - the name (24/800; desktop 36/800);
  - "Минулого разу: {{value}}" (15/600 secondary) from `lastPerformanceFor`, else the entry note (14 secondary), else nothing;
  - for unilateral exercises, "на кожну сторону" under the name.
- **`SetTable`:** a `<table>` with a hidden "Готово" header for the check column.
  - **Columns:** "Підхід" (40px), then the fields per tracking type ("Вага, кг", "Повтори", "Тривалість, с", "Дистанція, км" when the target ≥ 1000 m else "Дистанція, м"), then the check (60px).
  - **Rows:** `SetRow` from `src/components/SetRow` (pure: props `index, fields, values, logged, current, canLog, onChange, onToggle`).
  - **Input:** 56px tall, 28/800, centered, tabular, `inputmode="decimal"` (weight, distance) or `"numeric"`.
    - unlogged rows: `bg-[--input-surface]`, no border;
    - logged rows: transparent with a 1px `--border` border;
    - aria `Підхід N, вага` and so on;
    - placeholder "—" (`--placeholder`).
  - **Row number:** bold `--foreground` for the current row (the first unlogged), else 600 secondary.
  - **Check** (56×56 button, a 30px rotated square, radius 4):
    - logged: accent fill with a dark `Check` (stroke 3), `aria-pressed="true"`, aria "Підхід N виконано, зняти позначку";
    - current: 2px `--foreground` outline, aria "Позначити підхід N";
    - other: 2px `--planned` outline;
    - disabled (`!canLog`): 2px dashed `--disabled-outline`, `disabled`, aria "Позначити підхід N: спершу впиши повтори" (or "…тривалість" / "…дистанцію").
    - The empty main input of a disabled row gets a 1px `--planned` border.
    - When any row is disabled, the hint "Вага необовʼязкова. Щоб позначити підхід, впиши повтори." appears under the table (only for `weight_reps`).
  - **"Set done" motion** on log: 220 ms keyframes scale 0.55 → 1.18 → 1, then the fill. Off under `prefers-reduced-motion`.
  - **Values:**
    - row values are the logged set's values, else `drafts[key]`, else `prefillRow(entry, index, lastPerformance)`;
    - editing an unlogged row writes `setDraft`, and editing a logged row calls `editSet` (debounced);
    - input parsing uses `parseDecimal` / `parseInteger` from `src/lib/units.ts`, clamped to `SET_RANGE`; weight is rounded to 0.25; distance is shown in km with up to 2 decimals when the column is km.
  - **Under the table:**
    - "Додати підхід" (outlined, `flex-1`, `Plus`) → `plannedSets + 1`, disabled at 20;
    - "Прибрати підхід" (ghost, secondary text, `Minus`) → `plannedSets − 1`, disabled when the last row is logged or `plannedSets === 1`.
- **`NextUp`:**
  - a top divider, a 40px thumbnail at 85% opacity, "Далі" (13/600 secondary) over the next exercise name (700, truncated), and its target summary on the right (secondary);
  - the whole row is a button that sets current;
  - on the last exercise it becomes the paragraph "Остання вправа. Коли закінчиш, натисни «Завершити»." with a top divider.
- **`RestBar`** (mobile, `lg:hidden`), shown while `restEndsAt` is set:
  - fixed bottom, `bg-card` (surface), top radius 8px, `shadow-soft`, padding `14px 16px max(26px, safe-area)`;
  - a `RestRing` (from `src/components/RestRing`: props `size, progress (0–1), over`) at 56px: track `--border`, stroke the accent, 4px, linear `stroke-dashoffset` updated per second with no transition, and a 10px accent diamond in the center;
  - time 28/800 tabular (`m:ss`) over "Відпочинок {{time}}" (the full length);
  - "−15" and "+15" (outlined 52×48, aria "Мінус 15 секунд" / "Плюс 15 секунд");
  - "Пропустити відпочинок" (a 48px light primary icon button, `SkipForward`).
  - **Past zero:** the ring is full accent with a dark diamond, the time is "+m:ss" in the accent over "Час на підхід {{n}}" (the next unlogged row of the current exercise, 1-based), and the skip control becomes the text button "Пропустити".
  - `role="timer"`, `aria-live="off"`.
  - Main content gets bottom padding while the bar shows.
- **`RestPanel`** (desktop, right column):
  - a `bg-card` 6px panel with a 168px `RestRing` (6px stroke) and the time 28/800 with "з {{time}}" inside;
  - "−15 с" / "+15 с" in two columns, and "Пропустити" across both;
  - with no rest running the panel shows the ring empty and "Відпочинок" with the controls disabled.
- **Rest behaviour** (`useRestTimer(session)`):
  - `remaining = restEndsAt − now`;
  - ±15 changes `restEndsAt` by ±15 s and `restDurationSec`, clamped so the duration stays within `REST.minSec`–`REST.maxSec`, and stores the duration in `localStorage` `pampojo:rest:<exerciseId>`;
  - log uses that stored value or 90;
  - skip calls `clearRest` and, if the current exercise has no unlogged row, moves current to the next exercise with unlogged rows;
  - the same advance happens when the rest is skipped or a new set is logged after zero; it does not happen on its own while the rest runs;
  - **at zero**, once per `restEndsAt` and only while `document.visibilityState === 'visible'`: `navigator.vibrate?.(200)` and, unless the sound is off, a 150 ms 880 Hz sine through Web Audio at gain 0.1. The `AudioContext` is created on the first log tap so iOS allows it.
- **`ExerciseListSheet`** (mobile bottom sheet, `bg-card`, title "Вправи") and **`ExerciseListPanel`** (desktop left column, 340px, heading "Вправи"):
  - share one `SessionExerciseList`: `@dnd-kit/sortable` rows (68px);
  - each row has a 6-dot handle (`--planned`, aria "Перетягнути {{name}}", keyboard drag as in 09), a 44px thumbnail, the name, and "logged/planned" (700 for the current, else 600 secondary);
  - the current row is `bg-[--input-surface]` with `aria-current="step"` and "Зараз" under the name on mobile;
  - rows with no logged set get an "×" button aria "Прибрати {{name}}";
  - tapping a row sets current and closes the sheet;
  - "Додати вправу" (outlined, `Plus`) opens `ExercisePicker` from `@/features/workouts/ExercisePicker` with `room = 30 − count` inside a `session-theme` wrapper; new entries get `TARGET_DEFAULTS` from `src/constants/workout.ts`, `plannedSets = targetSets ?? 3`, no weight and no notes;
  - offline, "Додати вправу" is disabled with "Потрібен інтернет", because the picker needs the catalog.
- **`NoteSheet`:**
  - a bottom sheet titled "Нотатка", with a 5-row textarea on `--input-surface`, placeholder "Як пройшло тренування, що змінити наступного разу", max 1000, a counter "{{count}} / 1000", and the primary "Готово";
  - it saves on close or "Готово" when changed;
  - desktop shows the same field inline in the right column under the heading "Нотатка" and saves on blur.
- **Dialogs**, all through `ConfirmDialog`. Extend it with optional `className`, `destructive` (the confirm button uses `variant="destructive"`) and `stacked` (one column, confirm first) props; existing callers are unchanged.
  - `FinishDialog`: "Завершити тренування?" / "Залишилось {{count}} непозначених підходів. Вони не збережуться." / "Завершити" / "Продовжити";
  - `FinishEmptyDialog`: "Жодного підходу не позначено" / "Завершувати нічого. Можеш видалити це тренування або продовжити." / destructive "Видалити тренування" / "Продовжити";
  - `AbandonDialog`: "Видалити це тренування?" / "Залоговані підходи буде втрачено." / destructive "Видалити" / "Скасувати";
  - `ForgottenSessionDialog`: "Незавершене тренування від {{date}}" / "{{name}}, {{count}} підходів. Заверши його часом останнього підходу або видали." / "Завершити" / "Видалити" (outlined, `--destructive-text`). It opens when `now − startedAt > 12h` and is not dismissable without a choice.
- **`SessionSummary`** (boards "Підсумок, моб" / "Підсумок, десктоп 1440"):
  - a 34px accent diamond with a dark check (desktop 40), "Тренування завершено" (30/800; desktop 36), and "{{name}}, {{date}}" (weekday, day and month via `Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })`);
  - a `<dl>` 2×2 grid (desktop 4 columns) between top and bottom dividers: Тривалість `h:mm:ss`, Обʼєм `{{value}} кг` (`formatNumber`, grouping), Підходи, Вправи (24/800; desktop 28; the label under it in 14 secondary);
  - a divided list, one row per entry with logged sets: the name (700) and the result on the right (600 secondary), where the result is `N × <heaviest weight> кг`, or `N × <longest> с`, `N × <longest> км|м`, or `N × <most reps>` when no weight;
  - "Готово" (primary link to `/today`): full width fixed at the bottom on mobile, sized to its label under the list on desktop (`max-w-[720px] mx-auto`).
- **Layout:**
  - **mobile:** header, strip, `main` (px-4 pt-5, gap 18px): `ExerciseHeader`, `SetTable`, buttons, `NextUp`; plus `RestBar`;
  - **desktop `lg:`:** the header, then `grid-cols-[340px_minmax(0,1fr)_360px]`: `ExerciseListPanel` (border-r), the center `max-w-[680px] px-12 py-8` with `ExerciseHeader`, `SetTable` and the buttons (no `NextUp`), and the right column (border-l, px-7 py-8, gap 28) with `RestPanel` and the inline note.

Pure helpers in `src/features/session/utils.ts` (unit tested):

- `prefillRow(entry, setIndex, last)`;
- `canLog(trackingType, values)`;
- `isEntryDone(entry, logs)`;
- `nextEntryWithWork(session, logs, fromId)`;
- `summaryOf(session, logs)` → `{ durationSec, volumeKg, sets, exercises, rows }`;
- `restState(restEndsAt, durationSec, now)` → `{ remainingSec, over, progress }`;
- `isForgotten(session, now)`;
- `forgottenFinishedAt(session, logs)`;
- `buildSessionFromWorkout(workout, ids, startedAt)` → `{ workoutSnapshot, exercises }`;
- `formatClock(sec)` (`m:ss`, `h:mm:ss`).

### Starting — `src/features/session/hooks/useStartSession.ts`

`start(workoutId)`:

1. `findInProgress()` locally. If none and online, `fetchSessions({ status: 'in_progress' })`; when found, `importRemote(fetchSession(id))`. If either is found, `router.push('/session/<id>')` and stop.
2. Get the workout: online `queryClient.fetchQuery(workoutKeys.detail(id))`, offline `queryClient.getQueryData(workoutKeys.detail(id))`. Missing offline → toast "Потрібен інтернет" and stop. A workout with 0 exercises is never offered.
3. `repository.start({ workout, startedAt: now })`, then `prefetchLastPerformance` for its exercise ids without waiting, then `router.push('/session/<id>')`.

`useInProgress()` returns the local in-progress session through `useLiveQuery` and, online, the server lookup through `useSessionsQuery({ status: 'in_progress' })`.

### App shell changes

- **`StartWorkoutSheet`:**
  - **no in-progress session:** title "Обери тренування" and a list from `useWorkoutsQuery()` in one 6px card with dividers. Rows are 72px buttons: the first thumbnail 52px, the name (16/700), "{{count}} вправ" (secondary), and a 26px accent Play diamond (`PlayDiamond` scaled, `aria-hidden`). Tapping calls `start(id)` and closes the sheet.
    - A 0-exercise workout is disabled, with a dashed 52px square and "0 вправ. Додай вправи, щоб почати.".
    - Offline, a workout whose detail is not cached is disabled with "Потрібен інтернет".
    - With no workouts, the existing empty state stays.
    - Loading shows 3 skeleton rows.
  - **in progress:** title "Тренування триває", then a `bg-card` card with the 52px thumbnail, the name and "Іде {{min}} хв. {{done}} підходи з {{total}}". Below it, the primary link "Продовжити {{name}}" and the hint "Щоб почати інше тренування, спершу заверши або видали це." (14 secondary).
    - When the session is forgotten, `ForgottenSessionDialog` opens over the sheet.
- **`SessionBar`** (`src/features/session/SessionBar/`), rendered by `AppShell` when `useInProgress()` has a session:
  - a link `href="/session/<id>"` with aria "Повернутися до тренування {{name}}";
  - always dark, through new tokens in `globals.css` registered in `@theme inline`: `--session-surface: #1e1c1a`, `--session-foreground: #f3f1ec`, `--session-muted: #b3aca3`, `--session-track: #3a3633`. No hex in the component. 6px radius, `shadow-soft`, min-h 60, `px-3.5 py-2 gap-3`;
  - a 36px `RestRing` when a rest runs (3px stroke) else a small `PlayDiamond`, the name (700) over "Відпочинок {{time}}" or the elapsed `h:mm:ss` (14, `--session-muted`), and a light "Повернутися" 44px button-look span (4px radius, `--session-foreground` background, `--session-surface` text);
  - **mobile:** `fixed inset-x-3 bottom-[calc(112px+env(safe-area-inset-bottom))] z-30 lg:hidden`, and `main` bottom padding grows by 72px while it shows;
  - **desktop:** inside `SidebarNav` under the Start button (`hidden lg:flex`, full width).
- **`BottomNav` / `SidebarNav`:** the Start button keeps opening the sheet. Pass the in-progress state so its accessible name becomes "Продовжити тренування".

### Workouts feature changes

- **`WorkoutList`:** the "…" menu gets a first item "Почати" (a 14px accent `Diamond` as the icon, 700) → `useStartSession().start(id)`. It is disabled for 0-exercise workouts.
- **`WorkoutEditorForm`:** for a saved workout (not `/new`), a primary h-11 button "Почати" with a 12px accent diamond, opposite the back link. It is disabled while `dirty` (title "Спершу збережи зміни") and starts the session like above.

### Own exercise delete dialog

`DeleteExerciseDialog` also runs `useSessionsQuery({ status: 'completed', exerciseId }, { enabled: open })`. When there are items, it adds "Її підходи буде видалено з цих тренувань:" and a list of "{{name}}, {{date}}" (the date as day and short month, the year when it is not the current one). These are plain text: history links come in 12.

### Log out

In `LogOutButton.logOut` before `signOut`:

1. `remaining = await flushAllLocalDbs()`.
2. If `remaining > 0`, open a `ConfirmDialog` (destructive, stacked):
   - "Вийти з акаунта?";
   - "Незбережені на сервері дані тренувань буде втрачено. Підʼєднайся до мережі, щоб вони синхронізувались.";
   - "Вийти" / "Скасувати".
   - Cancel stops.
3. After a successful `signOut`, `await deleteAllLocalDbs()` together with the existing `clearOnboardingDrafts()`.

### i18n

Every string in section 7 goes to `en.json` and `uk.json`, with plural forms for count keys. `pnpm i18n:check` must pass.

### Layout checks

- 390px: one column, every control ≥ 48px in the session, no horizontal scroll with the longest uk labels ("Прибрати підхід", "Жим гантелей на похилій лаві" truncated in `NextUp`).
- 1440px: the three columns as above.

## 7. Copy

| en (key) | uk |
| --- | --- |
| Workout | Тренування |
| Start | Почати |
| Choose workout | Обери тренування (existing) |
| {{count}} exercises | existing plural |
| 0 exercises. Add exercises to start. | 0 вправ. Додай вправи, щоб почати. |
| Needs internet | Потрібен інтернет (existing) |
| Workout in progress | Тренування триває |
| {{min}} min in. {{done}} of {{total}} sets | Іде {{min}} хв. {{done}} підходи з {{total}} (plural on total: підхід/підходи/підходів) |
| Continue {{name}} | Продовжити {{name}} |
| To start another workout, finish or discard this one first. | Щоб почати інше тренування, спершу заверши або видали це. |
| Continue workout | Продовжити тренування |
| Back to workout {{name}} | Повернутися до тренування {{name}} |
| Back to workout | Повернутися |
| Rest {{time}} | Відпочинок {{time}} |
| Save your changes first | Спершу збережи зміни |
| Minimize | Згорнути |
| Elapsed | Минуло |
| More | Ще |
| Finish | Завершити |
| All exercises, exercise {{n}} of {{total}} | Усі вправи, вправа {{n}} з {{total}} |
| Exercise {{n}} of {{total}} | Вправа {{n}} з {{total}} |
| Last time: {{value}} | Минулого разу: {{value}} |
| per side | на кожну сторону (existing) |
| Set | Підхід |
| Weight, kg / Reps / Duration, s / Distance, km / Distance, m | Вага, кг / Повтори / Тривалість, с / Дистанція, км / Дистанція, м |
| Done (column, visually hidden) | Готово |
| Set {{n}}, weight / reps / duration / distance | Підхід {{n}}, вага / повтори / тривалість / дистанція |
| Check set {{n}} | Позначити підхід {{n}} |
| Set {{n}} done, uncheck | Підхід {{n}} виконано, зняти позначку |
| Check set {{n}}: enter the reps first / the duration first / the distance first | Позначити підхід {{n}}: спершу впиши повтори / тривалість / дистанцію |
| Weight is optional. To check a set, enter the reps. | Вага необовʼязкова. Щоб позначити підхід, впиши повтори. |
| Add set | Додати підхід |
| Remove set | Прибрати підхід |
| Next | Далі |
| Last exercise. When you are done, press "Finish". | Остання вправа. Коли закінчиш, натисни «Завершити». |
| Rest | Відпочинок |
| of {{time}} | з {{time}} |
| Minus 15 seconds / Plus 15 seconds | Мінус 15 секунд / Плюс 15 секунд |
| −15 s / +15 s | −15 с / +15 с |
| Skip rest | Пропустити відпочинок |
| Skip | Пропустити |
| Time for set {{n}} | Час на підхід {{n}} |
| Exercises | Вправи (existing) |
| Now | Зараз |
| Drag {{name}} | Перетягнути {{name}} (existing) |
| Remove {{name}} | Прибрати {{name}} |
| Add exercise | Додати вправу |
| Note | Нотатка (existing) |
| How did it go, what to change next time | Як пройшло тренування, що змінити наступного разу |
| {{count}} / {{max}} | {{count}} / {{max}} |
| Done | Готово (existing) |
| Timer sound | Звук таймера |
| Discard workout | Видалити тренування |
| Finish the workout? | Завершити тренування? |
| {{count}} sets are not checked. They won't be saved. | Залишилось {{count}} непозначених підходів. Вони не збережуться. (plural: непозначений підхід / непозначені підходи / непозначених підходів) |
| Keep going | Продовжити |
| No sets checked | Жодного підходу не позначено |
| Nothing to finish. You can discard this workout or keep going. | Завершувати нічого. Можеш видалити це тренування або продовжити. |
| Discard this workout? | Видалити це тренування? |
| Logged sets will be lost. | Залоговані підходи буде втрачено. |
| Delete | Видалити (existing) |
| Cancel | Скасувати (existing) |
| Unfinished workout from {{date}} | Незавершене тренування від {{date}} |
| {{name}}, {{count}} sets. Finish it at the time of the last set or discard it. | {{name}}, {{count}} підходів. Заверши його часом останнього підходу або видали. (plural) |
| Workout finished | Тренування завершено |
| {{name}}, {{date}} | {{name}}, {{date}} |
| Duration / Volume / Sets / Exercises | Тривалість / Обʼєм / Підходи / Вправи |
| {{value}} kg | {{value}} кг (existing if present) |
| {{count}} × {{value}} | {{count}} × {{value}} |
| Workout not found | Тренування не знайдено (existing) |
| It may have been deleted, or the link is wrong. | Можливо, його видалили або посилання неправильне. (existing) |
| Go to Today | На головну |
| Couldn't save a change to the server. | Не вдалося зберегти зміну на сервері. |
| Its sets will be removed from these workouts: | Її підходи буде видалено з цих тренувань: |
| Log out? | Вийти з акаунта? |
| Unsynced workout data will be lost. Connect to the internet so it can sync. | Незбережені на сервері дані тренувань буде втрачено. Підʼєднайся до мережі, щоб вони синхронізувались. |
| Log out | Вийти (existing) |

## 8. Steps

1. **Dependencies and constants.**
   - `pnpm add dexie dexie-react-hooks`.
   - `src/constants/session.ts`.
   - `src/shared/schemas/session.ts` with `__tests__/session.test.ts`.
2. **Schema and migration.**
   - `src/server/db/schema/session.ts` and the export in `schema/index.ts`.
   - `pnpm db:generate` → `0005_*.sql`; review that it only creates the two tables, their checks and their indexes.
   - Update `DATA_MODEL.md` and `API.md`.
3. **Server sessions domain.**
   - `src/server/sessions/{errors,queries,service}.ts`.
   - `ERROR_STATUS` codes.
   - `src/server/sessions/__tests__/service.test.ts`.
4. **Routes:** `sessions/route.ts`, `sessions/[id]/route.ts`, `sets/[id]/route.ts`, `exercises/[id]/last-performance/route.ts` with `__tests__/route.test.ts` under `src/app/api/v1/sessions/` and `src/app/api/v1/sets/`.
5. **Own exercise delete on the server:** extend `deleteOwnExercise` and add the cases to the sessions service tests.
6. **`src/api/sessions.ts`.**
7. **Local database:** `src/services/local-db/{db,outbox,session-repository,last-performance,logout,useOutboxRunner}.ts` and `index.ts`, with browser tests `src/services/local-db/__tests__/*.test.tsx`.
8. **Current user:** the `CurrentUser` provider in `src/features/auth/CurrentUser/`, wired into `session-gate.tsx`, mounting `useOutboxRunner`.
9. **Pure helpers and components:**
   - `src/features/session/utils.ts` with tests;
   - `src/components/RestRing`, `src/components/SetRow`;
   - the session theme in `globals.css`;
   - `ConfirmDialog` props (`className`, `destructive`, `stacked`).
10. **Session screen:**
    - `src/features/session/ActiveSession` and its child components and hooks (`useRestTimer`, `useWakeLock`, `useNow`, `useStartSession`, `useInProgress`);
    - `SessionSummary`, `SessionSkeleton`, `SessionNotFound`, the dialogs;
    - the routes `src/app/[lang]/session/layout.tsx` and `session/[id]/page.tsx`.
11. **Start points and minimizing:**
    - `StartWorkoutSheet`;
    - `SessionBar` with `AppShell`, `BottomNav` and `SidebarNav`;
    - the `WorkoutList` menu item;
    - the `WorkoutEditorForm` button.
12. **Delete dialog and log out:** `DeleteExerciseDialog` session list; `LogOutButton` flush, warning and deletion.
13. **i18n:** `en.json`, `uk.json`, `pnpm i18n:check`.
14. **e2e:** `e2e/10-workout-session.spec.ts`. Run `pnpm lint`, `pnpm typecheck` and the touched tests.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/server/sessions/__tests__/service.test.ts` "put stores snapshot; later workout PUT leaves it"; `e2e/10-workout-session.spec.ts` "start from the sheet, then rename the workout, the session keeps the old name" |
| AC2 | `src/features/session/ActiveSession/__tests__/ActiveSession.test.tsx` "one tap logs a prefilled set and starts a 90 s rest; a stored length is used"; `src/services/local-db/__tests__/session-repository.test.tsx` "logSet writes the row and one outbox entry" |
| AC3 | `src/features/session/__tests__/utils.test.ts` `restState`; `ActiveSession.test.tsx` with fake timers "after 100 s of a 90 s rest shows +0:10 and Час на підхід" |
| AC4 | `utils.test.ts` `prefillRow` cases; `service.test.ts` "last-performance ignores abandoned and deleted sets, returns null for none"; `ActiveSession.test.tsx` "Минулого разу" shown and hidden |
| AC5 | `e2e/10-workout-session.spec.ts` "reload keeps sets, order, added exercise, drafts and the rest" (online and `setOffline(true)`) |
| AC6 | `src/app/api/v1/sets/__tests__/route.test.ts` "PUT twice one row; DELETE twice 204 one deleted row"; `src/app/api/v1/sessions/__tests__/route.test.ts` "PUT twice one row" |
| AC7 | `session-repository.test.tsx` / `outbox.test.tsx` "flush sends in order, stops on network error, drops 4xx with callback, single flight under the lock"; e2e "offline logging syncs after online" (`page.request` checks the server sets) |
| AC8 | `ActiveSession.test.tsx` "finish asks with unchecked count; empty finish offers discard"; `SessionSummary` cases in `ActiveSession.test.tsx`; `service.test.ts` "patch completed sets finishedAt; repeat is a no-op"; e2e "finish shows the summary and the sheet offers workouts again" |
| AC9 | `service.test.ts` "abandon soft deletes set logs in one transaction; GET returns 404; list excludes it"; e2e "discard returns to Today" |
| AC10 | `src/features/app-shell/StartWorkoutSheet/__tests__/StartWorkoutSheet.test.tsx` "lists workouts; in-progress shows continue; forgotten opens the dialog; 0-exercise disabled; offline uncached disabled"; `utils.test.ts` `isForgotten`, `forgottenFinishedAt` |
| AC11 | `utils.test.ts` `canLog`; `ActiveSession.test.tsx` "check disabled until reps; uncheck keeps values and stops the rest" |
| AC12 | `service.test.ts` "range and limit validation 400"; `ActiveSession.test.tsx` "add set to 20 then disabled; remove exercise only without sets"; e2e "add an exercise through the picker and reorder, reload keeps it" |
| AC13 | `sessions/__tests__/route.test.ts` and `sets/__tests__/route.test.ts` "another user's id 404; writes on a completed session 409" |
| AC14 | `src/features/auth/LogOutButton/__tests__/LogOutButton.test.tsx` "pending outbox shows the warning; logout deletes pampojo databases" |
| AC15 | `service.test.ts` "deleteOwnExercise soft deletes its set logs and removes it from in-progress plans"; `src/features/exercises/DeleteExerciseDialog/__tests__/DeleteExerciseDialog.test.tsx` "lists completed sessions" |
| AC16 | e2e at `mobile` and `desktop` projects with `page.emulateMedia({ colorScheme: 'dark' })`: background `rgb(30, 28, 26)`, three columns visible on desktop, no horizontal overflow in en and uk |
| AC17 | `src/features/session/SessionBar/__tests__/SessionBar.test.tsx` "shows rest or elapsed and links to the session"; e2e "minimize goes to Today and the bar returns" |

## 10. Risks and open questions

- **Signed thumbnail URLs** of own exercises expire after 1 hour, and the snapshot stores the URL from the start. `ExerciseImage` falls back to the placeholder. Spec 17 caches images; a fresh URL can come from `GET /sessions/{id}` later.
- **Before spec 16,** a 4xx-dropped outbox entry leaves the local row different from the server. The toast tells the user; spec 16 adds pull to reconcile.
- **Starting offline** works only from the TanStack Query cache, which does not survive a reload. A full offline start is spec 16.
- **`navigator.locks`** exists in every target browser (Safari 15.4+). Without it, `flushOutbox` falls back to an in-memory flag (single tab only).
- **Sound on iOS** needs an `AudioContext` resumed in a user gesture. It is created on the first log tap; if the screen is locked, nothing plays (`OFFLINE.md`).
- **Two devices** can each start a session, because the server does not enforce one in progress (spec decision). The Start sheet shows the newest.
- **One Dexie version** is used now; spec 16 adds tables with a version bump and an upgrade.
- **Later specs:** records in the summary (13), `scheduledFor` (11, 12), substitution (18), history links in the delete dialog (12), the full logout guard and pending count (17).

## 11. Implementation notes

- **Repository API.** `start()` takes the snapshot and plan already built (`buildSessionFromWorkout` lives in `features/session/utils.ts`), so `services/` does not import from `features/`. Reads are hooks in `services/local-db/hooks.ts` (`useLocalSession`, `useLocalInProgress`, `useLastPerformance`) rather than repository methods.
- **Unlog keeps values.** `unlogSet` writes the set's values into `drafts`, so the row keeps them after the check is removed. The plan only said the row keeps its values.
- **Set writes lock order.** `putSet`, `patchSet` and `deleteSet` lock the session row before the set row, the same order as `patchSession`, to avoid deadlocks. `putSet` frees a live row at the same position (`softDeleteSetAtPosition`) before the upsert, so a replay never hits the partial unique index.
- **`findWorkoutOwner`** was added to `server/workouts/queries.ts`. `PUT /sessions` accepts a deleted workout of the user, so an outbox replay after a delete still lands.
- **Outbox.** 401 is not dropped: the entry waits for the user to sign in again. A `busy` flush result retries after 1 s, because a running flush may have finished before the new entry committed.
- **Current user.** `CurrentUserIdProvider` (id only, no runner) was added for tests. `src/test/render.tsx` wraps every render in it with `TEST_USER_ID` and accepts `userId` and `client`.
- **Button and tokens.** A `destructive` variant was added to `components/ui/button.tsx` (`bg-destructive text-destructive-foreground`), with `--destructive-foreground` `#24221F` light and `#1E1C1A` dark. The log out dialog therefore uses dark text on `#E5534B`, not the mockup's `#C2413A` with light text. `--destructive-text` light is `#C2413A`.
- **Finish label.** "Finish" already means "Готово" in onboarding, so the session uses `t('Finish', { context: 'session' })` → «Завершити».
- **Plurals.** The plural keys for unchecked sets, "N min in. X of Y sets" and the forgotten-session text use `_one/_few/_many/_other` forms. The note counter and summary rows use `{{length}}` and `{{sets}}` to avoid plural keys.
- **Distance header.** It is "Дистанція, км" when the target is ≥ 1000 m, else "Дистанція, м". Weight is rounded to 0.25 and values are clamped to the ranges while typing.
- **Server-only boundary.** `SessionSkeleton` and `SessionNotFound` are client components, because the session route's server files import them.
- **e2e:**
  - "Finish" is clicked with `dispatchEvent`, because in dev the Next.js indicator covers the top-right corner at 390px.
  - A reload with the network off cannot be tested before the service worker (spec 15). AC5 offline is covered by the Dexie repository tests and an online reload in e2e.
- **AppShell test** now stubs `fetch` and `useRouter`, because the Start sheet loads workouts and the in-progress session.
- **Migration `0005`** was applied with `pnpm db:migrate` (additive).
- **Flaky DB tests.** One full `pnpm test` run hung for 15 minutes in `server/sessions` and `server/exercises/write.test.ts` running in parallel: Supavisor backends stalled in `ClientRead`. Re-runs, serial and parallel, pass. It looks like the transaction pooler stall from 2026-11-10, not a lock (no blocked pids).

## 12. Review — 2026-11-15

**Verdict:** Pass with notes. Two major layout findings should be fixed before merge: the mobile set table is wider than 390px, and the desktop sidebar is too narrow for the in-progress state.

Screenshots: `scratch/review/10-workout-session/` (uk, dark system theme unless named `light`, 390×844 and 1440×900). The second mobile walk failed on sign-up, so the mobile summary, dialogs and not-found screens were not captured. Their behaviour is covered by e2e on the `mobile` project.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `service.test.ts` "stores the snapshot…"; e2e renames the workout during the session; `AC1-session-start-*.png` |
| AC2 | Pass | `ActiveSession.test.tsx` (one tap, 90 s, stored length); `AC2-set-logged-rest-*.png` |
| AC3 | Pass | `utils.test.ts` `restState`; `ActiveSession.test.tsx` "+0:10"; `AC3-rest-over-desktop.png` ("+0:02 Час на підхід 2") |
| AC4 | Pass | `utils.test.ts` `prefillRow`; `service.test.ts` last-performance; "Минулого разу: 80 кг × 8" in `AC9-abandon-dialog-desktop.png` |
| AC5 | Pass (online) | e2e reload keeps the set and the edited reps. The offline reload cannot be tested before spec 15; the Dexie tests cover persistence |
| AC6 | Pass | `sets/__tests__/route.test.ts`, `sessions/__tests__/route.test.ts` |
| AC7 | Pass | e2e "logs sets offline and syncs them" (both projects); `session-repository.test.tsx` outbox |
| AC8 | Pass | `ActiveSession.test.tsx`; e2e; `AC8-finish-dialog-desktop.png`, `AC8-summary-desktop.png` |
| AC9 | Pass | `service.test.ts` abandon; e2e discard + 404; `AC9-abandon-dialog-desktop.png`, `AC9-not-found-desktop.png` |
| AC10 | Pass | `StartWorkoutSheet.test.tsx`; `AC10-start-list-*.png`, `AC10-start-continue-desktop.png`; editor and list "Почати" through `useStartSession` |
| AC11 | Pass | `ActiveSession.test.tsx`; walk counted 3 disabled checks on the exercise without targets |
| AC12 | Pass with finding 4 | `ActiveSession.test.tsx`, `service.test.ts`; `AC12-exercise-list-mobile.png` |
| AC13 | Pass | route tests (404 and 409) |
| AC14 | Pass | `LogOutButton.test.tsx`, `session-repository.test.tsx` |
| AC15 | Pass | `service.test.ts` "deleting an own exercise"; `DeleteExerciseDialog.test.tsx` |
| AC16 | Fail (mobile) | Dark and light themes are correct (`rgb(30, 28, 26)`; `AC16-summary-light-desktop.png`), but the 390px layout overflows (finding 1) |
| AC17 | Pass with finding 2 | `SessionBar.test.tsx`; e2e; `AC17-session-bar-mobile.png` is correct, the desktop sidebar is not |

### Findings

1. [major] **The set table is wider than 390px in uk.** `src/features/session/ActiveSession/SetTable.tsx:150`: "Додати підхід" (`flex-1`) plus "Прибрати підхід" (`whitespace-nowrap`, ghost padding) need more than 358px. Mobile Chrome zooms the page out to fit, so the rest bar buttons (−15, +15, skip) and the exercise list sheet are clipped at the right and bottom. See `AC2-set-logged-rest-mobile.png`, `AC3-rest-over-mobile.png`, `AC12-exercise-list-mobile.png`. `scrollWidth − innerWidth` reports 0 because the layout viewport grows with it. Breaks AC16 and AC9 of the plan ("no horizontal scroll").
2. [major] **The desktop sidebar cannot fit the in-progress state.**
   - "Продовжити тренування" overflows the 224px Start button: `src/features/app-shell/SidebarNav/SidebarNav.tsx:47`.
   - The `SessionBar` in the sidebar squeezes the name and time to "P…" and "0:00" next to "Повернутися": `src/features/session/SessionBar/SessionBar.tsx`.
   - See `AC17-session-bar-desktop.png` and `AC10-start-continue-desktop.png`. The design puts the bar under Start but did not size it for 224px. A sidebar variant should stack the button under the text (or show only the ring, name and time).
3. [minor] **Rapid −15/+15 taps lose updates.** `src/features/session/ActiveSession/SessionView.tsx:184` computes the new length from `session.restDurationSec` in the render. Taps faster than the Dexie live query refresh read a stale value. In the walk, six taps moved 90 s only to 30 s. Read and update the row inside one Dexie transaction instead.
4. [minor] **The server does not protect logged sets on plan edits.** `src/server/sessions/service.ts:254` `PATCH /sessions` accepts an `exercises` list that drops an entry with logged sets, or changes an existing entry's `trackingType`. The client never sends that, but the set logs would be orphaned or validated against the wrong type. Reject both with 400.
5. [minor] **The dialog footer has a different surface.** `src/components/ConfirmDialog/ConfirmDialog.tsx`: in the dark session the footer area of `DialogFooter` uses its own background, so the dialog reads as two blocks (`AC9-abandon-dialog-desktop.png`). The design has one `#2A2724` surface.
6. [minor] **The picker room uses a literal.** `SessionView.tsx:346` `room={30 - exercises.length}` should use `SESSION_EXERCISES_MAX`.

### Checks

- lint: pass.
- typecheck: pass.
- tests: the 13 spec 10 and touched files pass (91 tests). Full `pnpm test`: 552 pass after the last test edits. One earlier full run hung 15 minutes on Supavisor `ClientRead` in the parallel DB tests (Implementation notes); not reproduced since.
- e2e: `e2e/10-workout-session.spec.ts` 6/6 (mobile and desktop); specs 05, 07, 09 49/49.
- Diff: no secrets, `.env*` or build output. Queries are scoped by user (sessions through `user_id`, sets through their session). Every write is an idempotent `PUT` or a repeat-safe `PATCH`/`DELETE`.

### Out of scope

- **App-wide dark theme** with a Profile switch (system / light / dark, stored on the device): the lead's decision of 2026-11-15, which needs its own spec (drill → design for every screen).
- **Dev overlay:** the Next.js dev indicator covers the top-right "Завершити" at 390px in dev only.

## 12. Review — 2026-11-15 (fixes)

**Verdict:** Pass.

All six findings from the first review are fixed:

1. **Fixed.** `SetTable.tsx`: the set buttons use tighter padding (`px-3 gap-1.5`), with "Додати підхід" `min-w-0 flex-1` and "Прибрати підхід" `shrink-0`. The new uk e2e "the set controls and the rest bar fit the screen" fails on the old layout (right edge at 415px) and passes now. See `AC1-session-start-mobile.png` and `AC8-finish-dialog-mobile.png`.
2. **Fixed.**
   - The sidebar Start button wraps its label (`SidebarNav.tsx`).
   - `SessionBar` has a `sidebar` variant that stacks "Повернутися" under the name and time (`SessionBar.tsx`, `AppShell.tsx`).
   - See `AC10-start-continue-desktop.png`.
3. **Fixed.** The repository's `adjustRest` and `changePlannedSets` read and write the stored row in one Dexie transaction. A test sends parallel taps.
4. **Fixed.** `assertPlanKeepsLogs` in `server/sessions/service.ts` rejects dropping an entry with live set logs or changing an entry's exercise or tracking type (400), with a service test.
5. **Fixed.** Stacked `ConfirmDialog`s have no footer band (`border-t-0 bg-transparent`).
6. **Fixed.** `SESSION_EXERCISES_MAX` replaces the literal.

### Checks

- lint: pass.
- typecheck: pass.
- tests: 33 touched test files pass (186 tests).
- e2e: specs 10 and 05 pass, 30 tests with 6 skips by viewport design.
- Screenshots refreshed at 390 and 1440, with no page errors.
