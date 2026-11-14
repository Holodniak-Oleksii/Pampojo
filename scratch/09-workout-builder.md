# 09-workout-builder — technical plan

Spec: `docs/specs/09-workout-builder.md`

## 1. Summary

Users build reusable workouts.

- **Server.** New `workout` and `workout_exercise` tables (migration `0004`), a `src/server/workouts` domain, and three handlers:
  - `GET /api/v1/workouts`;
  - `GET /api/v1/workouts/{id}`;
  - `PUT /api/v1/workouts/{id}`, idempotent create or replace of the workout with its full exercise list in one transaction;
  - `DELETE /api/v1/workouts/{id}`, soft delete.
- **Client.** A list at `/library/workouts` and an editor at `/library/workouts/new` and `/library/workouts/[id]`.
  - Each exercise row opens a sheet with its targets (bottom on mobile, right on desktop).
  - Reordering is by drag with `@dnd-kit`, including keyboard dragging.
  - On mobile, exercises are added through a full-screen multi-select picker. On desktop, a catalog column sits left of the workout, with "+" and drag-to-insert.
- **Other changes:**
  - `GET /api/v1/exercises` list items gain `trackingType` and `laterality`.
  - Deleting an own exercise removes it from the user's workouts, and the delete dialog lists those workouts.
  - Today marks the first two steps done once a workout exists.

## 2. Acceptance criteria

- **AC1:**
  - Create a workout with three exercises, tap "Зберегти", reopen it: the exercise order, targets and notes are the same.
  - A new workout left without saving (Cancel or the back link, after confirming discard) never appears in the list.
- **AC2:**
  - Exercise rows are reordered by dragging the 6-dot handle: touch on mobile, mouse on desktop, and the keyboard (focus the handle, Space, arrow keys, Space).
  - The screen reader hears `@dnd-kit` announcements in the current language.
  - After saving and reopening, the order matches.
  - There are no move-up or move-down buttons.
- **AC3:**
  - Tapping an exercise row opens its sheet.
  - The fields follow the exercise `trackingType`:
    - `weight_reps`: sets, reps from–to, weight kg;
    - `reps`: sets, reps from–to;
    - `time`: sets, duration;
    - `distance`: sets, distance.
  - There is never a rest field.
  - On add, the defaults are `weight_reps` 3 × 8–12, `reps` 3 × 10–15, `time` 3 × 30 s, `distance` 1 set. Weight and distance are always empty on add.
  - Every target can be cleared, and the workout saves with empty targets.
- **AC4:**
  - The same `PUT /api/v1/workouts/{id}` sent twice leaves one workout with the same content and returns 200 both times.
  - `DELETE` sent twice returns 204 both times and leaves one soft-deleted row.
- **AC5:**
  - `GET`, `PUT` and `DELETE` on another user's workout id return 404 `WORKOUT_NOT_FOUND`, and `PUT` does not overwrite it.
  - A `PUT` whose exercises reference another user's own exercise, or a deleted own exercise, returns 400 `VALIDATION_FAILED`.
- **AC6:**
  - The list shows each workout's name, "N вправ" and up to 3 primary muscle groups with family diamonds, newest `updatedAt` first.
  - With no workouts, it shows the empty state whose button opens the editor for a new workout.
- **AC7:**
  - With unsaved changes, the editor's "Скасувати" and back link open "Скасувати зміни?". "Продовжити редагування" stays, and "Скасувати зміни" leaves.
  - Reload or tab close triggers the browser `beforeunload` prompt.
  - Without changes, both leave at once.
- **AC8:**
  - On desktop (≥1024px), dragging a catalog row into the workout inserts it where it is dropped, shown by an accent drop line.
  - The catalog row's "+" appends the exercise to the end.
- **AC9:**
  - On mobile, "Додати вправи" opens the full-screen picker.
  - Tapping three rows numbers them 1, 2, 3, and "Додати 3 вправи" appends them in that order.
  - An exercise already in the workout can be picked again and appears twice.
- **AC10:**
  - "Зберегти" is disabled, with the hint "Додай назву й хоча б одну вправу, щоб зберегти.", while the trimmed name is empty or there are no exercises.
  - The client inputs cap: name 80, description 500, note 300, 30 exercises (the add controls disable at 30).
  - The server returns 400 for:
    - any of those lengths;
    - more than 30 or zero exercises;
    - targets outside the ranges in §3;
    - a target that does not fit the exercise's tracking type;
    - min reps > max reps.
  - The server returns 422 `WORKOUT_LIMIT_REACHED` for a 201st workout.
- **AC11:**
  - "Дублювати" creates "<name> (копія)" with a new id and opens it in the editor.
  - "Видалити" asks «Видалити «<name>»? Минулі тренування залишаться в історії.»; confirming removes the workout from the list.
- **AC12:**
  - Offline, the cached list and the cached editor open read-only.
  - "+", "Створити тренування", "Зберегти", "Дублювати", "Видалити", "Додати вправи", drag handles and inputs are disabled or hidden, with "Потрібен інтернет" under "Зберегти".
- **AC13:**
  - Deleting an own exercise used in workouts lists those workouts, with links, in its confirmation.
  - After confirming, the exercise is gone from those workouts.
  - A workout left with no exercises shows "0 вправ" and the "Додай вправи" tag in the list.
- **AC14:** With at least one workout, Today shows the empty-state card with the headline "Тренування готове", the first two steps done, and the button "Твої тренування" linking to `/library/workouts`.
- **AC15:** At 390px and 1440px, in en and uk, the list, the editor, the sheet and the picker have no horizontal scroll.

## 3. Data

### Tables (migration `0004`, additive only)

`src/server/db/schema/workout.ts`, re-exported from `schema/index.ts`.

**`workout`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Client generated |
| `owner_id` | uuid not null → `user.id` on delete cascade | |
| `name` | text not null | Check `char_length between 1 and 80` |
| `description` | text null | Check `char_length <= 500` |
| `source_workout_id` | uuid null | Spec 19; unused here |
| `source_owner_name` | text null | Spec 19; unused here |
| `created_at`, `updated_at` | timestamptz not null default now() | |
| `deleted_at` | timestamptz null | Soft delete |

Index `workout_owner_updated_idx` on `(owner_id, updated_at)`.

**`workout_exercise`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | Client generated, stable for drag keys |
| `workout_id` | uuid not null → `workout.id` on delete cascade | |
| `exercise_id` | uuid not null → `exercise.id` on delete cascade | |
| `position` | smallint not null | 0-based order |
| `target_sets` | smallint null | Check 1–20 |
| `target_reps_min`, `target_reps_max` | smallint null | Check 1–100 and min ≤ max; both null or both set |
| `target_weight_kg` | numeric(5,2) null | Check 0–500 |
| `target_duration_sec` | integer null | Check 5–3600 |
| `target_distance_m` | integer null | Check 10–100000 |
| `notes` | text null | Check `char_length <= 300` |

- Unique index `(workout_id, position)`, and an index on `exercise_id` for removing an exercise from workouts.
- No `rest_sec` (decision 2026-11-14).
- Drizzle maps `numeric` to a string. Convert it to a number in the service.

### Constants (`src/constants/workout.ts`)

```ts
export const WORKOUT_NAME_MAX = 80;
export const WORKOUT_DESCRIPTION_MAX = 500;
export const WORKOUT_NOTE_MAX = 300;
export const WORKOUT_EXERCISES_MAX = 30;
export const WORKOUT_LIMIT = 200;
export const TARGET_RANGE = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  weightKg: { min: 0, max: 500, step: 0.25 },
  durationSec: { min: 5, max: 3600 },
  distanceM: { min: 10, max: 100_000 },
} as const;
/** Targets prefilled when an exercise is added (decision 2026-11-14). */
export const TARGET_DEFAULTS = {
  weight_reps: { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
  reps: { targetSets: 3, targetRepsMin: 10, targetRepsMax: 15 },
  time: { targetSets: 3, targetDurationSec: 30 },
  distance: { targetSets: 1 },
} as const satisfies Record<TrackingType, object>;
/** Which target fields each tracking type allows. */
export const TARGET_FIELDS = {
  weight_reps: ['sets', 'reps', 'weight'],
  reps: ['sets', 'reps'],
  time: ['sets', 'duration'],
  distance: ['sets', 'distance'],
} as const satisfies Record<TrackingType, readonly TargetField[]>;
```

### Zod (`src/shared/schemas/workout.ts`)

- `workoutIdParamsSchema = z.object({ id: z.uuid() })`.
- **`workoutExerciseInputSchema`**, `.strict()`:
  - `id` uuid, `exerciseId` uuid;
  - `targetSets`, `targetRepsMin`, `targetRepsMax`, `targetWeightKg` (`multipleOf(0.25)`), `targetDurationSec`, `targetDistanceM`: each optional, nullable, within its range;
  - `notes`: trimmed, max 300, `''` → null.
  - Refinements: both reps null or both set, and min ≤ max.
- **`putWorkoutInputSchema`**, `.strict()`:
  - `name`: trimmed, 1–80;
  - `description`: trimmed, max 500, `''` → null, optional;
  - `exercises`: an array of 1–30.
- **`workoutExerciseSchema`** (response):
  - `id`, `exerciseId`;
  - all `target*` fields as `number | null`, and `notes: string | null`;
  - `exercise: { id, name, trackingType, laterality (nullable), primaryMuscles, thumbnailUrl (nullable), isOwn }`.
- **`workoutSchema`**: `id`, `name`, `description` (nullable), `updatedAt` (ISO) and `exercises` (ordered).
- **`workoutListItemSchema`**:
  - `id`, `name`, `updatedAt`;
  - `exerciseCount`;
  - `exerciseIds`: the distinct ids;
  - `primaryMuscles`: at most 3;
  - `thumbnailUrls`: at most 4, from distinct exercises in order.
- `workoutListResponseSchema = { items }`.
- Export the input and output types.

### Exercise list item (additive)

- `exerciseListItemSchema` gains `trackingType: trackingTypeSchema` and `laterality: lateralitySchema.nullable()`.
- `listExerciseRows` selects `e.tracking_type, e.laterality`, and `listExercises` maps them.
- Update `getExerciseListItemMock` (defaults `weight_reps`, `bilateral`).

## 4. API

Update `docs/tech/API.md`. The row already reads `GET /api/v1/workouts`, `GET/PUT/DELETE /api/v1/workouts/{id}`. Add the shapes below, the `exercises` list item fields, and the error codes.

| Method | Route | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/workouts` | — | 200 `{ items: WorkoutListItem[] }`, at most 200, `updatedAt` desc | — |
| GET | `/api/v1/workouts/{id}` | — | 200 `Workout` | 404 `WORKOUT_NOT_FOUND` (missing, deleted, foreign) |
| PUT | `/api/v1/workouts/{id}` | `PutWorkoutInput` | 200 `Workout` | 400 `VALIDATION_FAILED`, 404 `WORKOUT_NOT_FOUND` (foreign or deleted id), 422 `WORKOUT_LIMIT_REACHED` |
| DELETE | `/api/v1/workouts/{id}` | — | 204, also when already deleted | 404 `WORKOUT_NOT_FOUND` (missing or foreign) |

- **Idempotency** (`request-safety.md` rule 1): `PUT` with a client id is an upsert. A replay rewrites the same values and returns 200. `DELETE` of an already deleted own workout is a no-op 204.
- **Error map** (`src/server/http/errors.ts`): `WORKOUT_NOT_FOUND: 404` and `WORKOUT_LIMIT_REACHED: 422`. 422 matches `EXERCISE_LIMIT_REACHED`; the spec text said 409 `WORKOUT_LIMIT`. Fix the spec and `API.md` to the code used here (§11).
- **Target and tracking type mismatch:** `VALIDATION_FAILED` with details `path: ['exercises', i, '<field>']`, for example a weight on a `time` exercise.
- **Unknown or invisible `exerciseId`:** `VALIDATION_FAILED` with `path: ['exercises', i, 'exerciseId']`. Visible means a system exercise, or the user's own exercise that is not deleted.
- **Headers:** `Cache-Control: private, no-store`, as `json()` already sends.

## 5. Server

`src/server/workouts/`, every file starting with `import 'server-only'`.

- **`errors.ts`:** `WORKOUT_ERROR = { NOT_FOUND: 'WORKOUT_NOT_FOUND', LIMIT_REACHED: 'WORKOUT_LIMIT_REACHED' }`.
- **`queries.ts`** (Drizzle and raw SQL, each query scoped by `owner_id = userId`):
  - `lockWorkoutRow(tx, id)`: `select … for update` by id (owner checked in the service: foreign → not found);
  - `countActiveWorkouts(tx, userId)`;
  - `insertWorkout`, `updateWorkoutColumns(tx, id, { name, description })` with `touch()`;
  - `softDeleteWorkout(tx, id)`;
  - `replaceWorkoutExercises(tx, workoutId, rows)`: delete by `workout_id`, then a single multi-row insert;
  - `findVisibleExercises(tx, userId, ids)`: `id, tracking_type` for `(owner_id is null or owner_id = userId) and deleted_at is null`;
  - `listWorkoutRows(db, userId)`: active workouts, `updated_at desc limit 200`;
  - `listWorkoutExerciseRows(db, userId, workoutIds, locale)`: one query joining `workout_exercise` → `exercise` → translations. It returns `workout_id, position, ids, targets, notes, name, tracking_type, laterality, primary_muscles, media, owner_id`, ordered by `workout_id, position`. Reuse `translationJoins` exported from `src/server/exercises/queries.ts`;
  - `findWorkoutRow(db, userId, id)`: active and owned;
  - `removeExerciseFromWorkouts(tx, userId, exerciseId)`: deletes `workout_exercise` rows of the user's workouts and touches those workouts' `updated_at`, in one CTE statement.
- **`service.ts`:**
  - **`listWorkouts(userId, locale)`:** 2 SQL queries and 1 `resolveFrames` call, whatever the count.
    - `primaryMuscles`: count each primary muscle over the exercises, sort by count desc then first appearance, take 3.
    - `thumbnailUrls`: the first frame thumb of the first 4 distinct exercises.
  - **`getWorkout(userId, locale, id)`:** throws `NOT_FOUND`.
  - **`putWorkout(userId, locale, id, input)`**, in one transaction:
    1. `lockOwner(tx, userId)`, the advisory lock from `exercises/queries.ts`, renamed to a generic key or reused as is (the same per-user lock is fine);
    2. lock the row: foreign or deleted → `NOT_FOUND`; missing → `countActiveWorkouts ≥ 200` → `LIMIT_REACHED`;
    3. `findVisibleExercises` for the distinct ids: a missing id → `VALIDATION_FAILED` at its index; a field not in `TARGET_FIELDS[trackingType]` with a non-null value → `VALIDATION_FAILED`;
    4. insert, or update name and description with `touch`;
    5. `replaceWorkoutExercises` with `position = index`.

    It returns `getWorkout(...)` after commit.
  - **`deleteWorkout(userId, id)`:** a transaction that locks the row; missing or foreign → `NOT_FOUND`; already deleted → return; otherwise soft delete.
  - **`hasWorkouts(userId)`:** `exists` on active workouts, for Today.
- **Exercise delete** (`src/server/exercises/write-service.ts` `deleteOwnExercise`): in the same transaction, call `removeExerciseFromWorkouts(tx, userId, id)` from `@/server/workouts/queries`.
- **Routes:**
  - `src/app/api/v1/workouts/route.ts` (`GET`);
  - `src/app/api/v1/workouts/[id]/route.ts` (`GET`, `PUT`, `DELETE`).

  Both use `withHandler({ auth: 'required', params: workoutIdParamsSchema, body })` and `requestLocale(request)`, with one service call each. Comment on `PUT`: client id upsert (`request-safety.md`).

## 6. Client

### Dependencies

`@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0` and `@dnd-kit/utilities@3.2.2` (decision 2026-11-14).

### Data (`src/api/workouts.ts`)

- `workoutKeys = { all, list(), detail(id) }`.
- `fetchWorkouts`, `fetchWorkout(id)` (404 → `null`), `putWorkout(id, input)`, `deleteWorkout(id)`.
- `useWorkoutsQuery()` and `useWorkoutQuery(id, { enabled })`.
- `usePutWorkoutMutation()`: on success, set `detail(id)` and invalidate `list()`.
- `useDeleteWorkoutMutation()`: on success, invalidate `list()` and remove `detail(id)`.
- `useDeleteExerciseMutation` (in `src/api/exercises.ts`) also invalidates `workoutKeys.all`.

### Routes

- `src/app/[lang]/(app)/library/(tabs)/workouts/page.tsx` renders `<WorkoutList />`. The title stays "Library | Pampojo".
- New pages (outside `(tabs)`, like `exercises/[id]`):
  - `src/app/[lang]/(app)/library/workouts/new/page.tsx` renders `<WorkoutEditor mode="new" />`, title "New workout | Pampojo";
  - `src/app/[lang]/(app)/library/workouts/[id]/page.tsx` renders `<WorkoutEditor mode="edit" id={id} />`, title "Workout | Pampojo".
- Both editor pages are client data, like `/profile/gym`.
- An invalid id param (not a UUID) shows the not-found card without a request.

### Feature folder (`src/features/workouts/`)

- **`WorkoutList/`** (`'use client'`). Boards: «Список, моб», «Список, десктоп 1440», «Список, моб, порожній», «Список, моб, завантаження», «Список, моб, помилка», «Видалення, моб».
  - **Mobile:** one `bg-card rounded-lg` list with `divide-y divide-border`. Each row is a `Link` to `/library/workouts/{id}` with:
    - the first thumbnail (52px, `rounded-sm`), or for 0 exercises a 52px dashed `border-planned` square;
    - the name (`text-base font-bold`) and the count (`text-muted-foreground`);
    - the muscles row (`text-sm font-semibold`, each with `<Diamond tone="muscle" family=… />`);
    - for 0 exercises, the tag "Додай вправи" (`rounded-md bg-primary px-2 text-[13px] font-bold text-primary-foreground`).
    - A separate 44px "…" `DropdownMenu` button (`aria-label="Дії для {{name}}"`) with "Дублювати" and "Видалити" (destructive).
  - **Desktop (`lg`):** a `grid-cols-3 gap-4` of `rounded-lg bg-card p-[18px]` cards with the name (`text-lg font-extrabold`), the count, up to 4 thumbnails (56px), the muscles and the "…".
  - **Create:** the desktop header row has a primary `Button size="sm"` "Створити тренування" with `Plus`, right of the tabs (rendered by `LibraryTabs`, below).
  - **Empty:** a `WorkoutListEmpty` card using the spec 28 Today empty pattern:
    - the `WorkoutIcon` headline "Тренувань ще немає";
    - the line «Збери вправи в тренування один раз і повторюй його щотижня.»;
    - three numbered diamond steps, the first in accent;
    - an `OnlineLinkButton` "Створити тренування" to `/library/workouts/new`, full width below `sm`.
  - **Loading:** `WorkoutListSkeleton` with 3 rows (52px block, 3 bars).
  - **Error:** a card with "Не вдалося завантажити тренування." and a secondary "Спробувати ще раз" calling `refetch`.
  - **Offline with cache:** the list renders, the "…" buttons are disabled, and the create buttons are disabled via `OnlineLinkButton`.
  - **Duplicate:**
    - `putWorkout(crypto.randomUUID(), { name: '<name> (копія)', ... })`, built from `fetchWorkout(id)` (or the cached detail) with new row ids;
    - the name is cut to 80 characters before the suffix, so the copy stays within the limit;
    - then `router.push` to the copy.
  - **Delete:** `ConfirmDialog` with the delete copy; the confirm label is "Видалити". On error, the toast "Щось пішло не так. Спробуй ще раз." (existing key).
- **`WorkoutEditor/`** (`'use client'`, `mode: 'new' | 'edit'`, `id?`). Boards: «Редактор, моб», «Редактор, десктоп 1440», «Редактор, моб, офлайн», «Незбережені зміни, моб», «Тренування не знайдено, моб».
  - **State:** `useReducer` over `Draft = { id, name, description, items: DraftItem[] }`, where `DraftItem = { key (uuid), exercise: WorkoutExercise['exercise'], targets, notes }`.
    - In `new` mode the draft is created once with `crypto.randomUUID()`.
    - In `edit` mode it is seeded from `useWorkoutQuery` the first time data arrives.
    - `dirty` compares the serialized draft with the seed.
  - **Layout:**
    - a back link "Тренування" (`ArrowLeft`) to `/library/workouts`, going through the discard guard;
    - "Назва" and "Опис" are standard `Input`s (15px). Description is a single-line input on desktop and a 2-row `textarea` on mobile. On desktop they sit side by side under an h1 "Тренування" (`text-lg font-extrabold`); mobile has no visible h1 (`sr-only` h1 with the workout name);
    - the "Вправи" h2 with the count «N вправ» on the right. Desktop adds «Перетягни з каталогу або натисни +.»;
    - `WorkoutExerciseList`: a sortable list in one `rounded-lg bg-card` card;
    - on mobile, a secondary "Додати вправи" `Plus` button opens `ExercisePicker`;
    - actions at the end, not sticky: "Зберегти" (primary, full width on mobile, right-aligned on desktop) and "Скасувати" (ghost);
    - the hint under "Зберегти" when disabled.
  - **Desktop:** `lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6`, with `CatalogColumn` on the left.
  - **Save:**
    - `mutateAsync(putWorkoutInput(draft))`;
    - on success, `toast('Тренування збережено')` and `router.push('/library/workouts')`;
    - on 400, 422 or a network failure, the toast "Не вдалося зберегти тренування. Спробуй ще раз." or, for `WORKOUT_LIMIT_REACHED`, "Можна мати до 200 тренувань.". The draft stays.
  - **Discard:**
    - reuse `useDiscardGuard`, moved to `src/hooks/useDiscardGuard.ts` because a second feature now needs it, and update the `ExerciseForm` import;
    - `ConfirmDialog` with "Скасувати зміни?" / "Зміни буде втрачено." / "Скасувати зміни" / "Продовжити редагування".
  - **Not found** (`fetchWorkout` → null, or an invalid id): a card with an icon, h1 "Тренування не знайдено", «Можливо, його видалили або посилання неправильне.», and a primary link "До тренувань".
  - **Loading:** `WorkoutEditorSkeleton` with the field bars and 3 row bars.
  - **Offline** (`useIsOnline() === false`):
    - inputs `disabled` (fill `bg-input/50`);
    - no drag handles;
    - "Додати вправи", the catalog "+" and drag, and the sheet fields all disabled;
    - "Зберегти" disabled, with "Потрібен інтернет" under it.

    The sheet still opens read-only.
- **`WorkoutExerciseList/`:**
  - `DndContext` with `PointerSensor` (`activationConstraint: { distance: 6 }`), `TouchSensor` (`delay: 150, tolerance: 6`) and `KeyboardSensor` with `sortableKeyboardCoordinates`.
  - `accessibility.announcements` built from i18n strings:
    - "Підняли «{{name}}»."
    - "«{{name}}» на місці {{position}} з {{count}}."
    - "«{{name}}» поставили на місце {{position}}."
    - "Перетягування скасовано."
  - **Row** (`useSortable`, keyed by `item.key`):
    - a handle `button` (`aria-label="Перетягнути {{name}}"`, 28×44, `text-planned`, 6-dot `GripVertical`);
    - then a `button` covering the rest that opens the sheet: 52px thumbnail, name (`text-base font-bold`), summary (`text-[15px] font-semibold tabular-nums`), and the note (`text-sm text-muted-foreground`, one line, truncated) when present;
    - no chevron;
    - on desktop the summary is a right-aligned 180px column.
  - **Drag overlay:** `DragOverlay` renders a `rounded-lg bg-card shadow-soft rotate-[-1.5deg]` card with the thumbnail and name.
  - **Drop indicator:** a 3px `bg-accent` line with a 9px accent `Diamond` at its start, between rows at the over index.
  - Under `prefers-reduced-motion`, the sortable `transition` is null.
- **`ExerciseTargetsSheet/`.** Board «Редактор, моб, аркуш вправи».
  - **Container:** `Sheet` with `side={desktop ? 'right' : 'bottom'}`, `bg-background`, `rounded-t-xl` on the bottom, a grab bar, `max-h-[90dvh] overflow-y-auto`.
  - **Header:** a 56px thumbnail, the h2 name (`text-xl font-extrabold`), a link "Як виконувати" to `/library/exercises/{exerciseId}` (muted, `text-sm`), and the close X.
  - **Fields** in a `grid-cols-2 gap-3`, by `TARGET_FIELDS`:
    - "Підходи" (`inputmode=numeric`);
    - "Вага, кг" (`inputmode=decimal`, accepts a comma);
    - "Повтори" as a `fieldset` spanning both columns, with "Від" and "До" inputs, an en dash, and the hint «Для точної кількості впиши однакові числа.»;
    - "Тривалість, с" (`numeric`);
    - "Дистанція, м" (`numeric`);
    - "Нотатка" spanning both columns, maxLength 300.
  - For unilateral exercises, the reps and duration labels get «на кожну сторону» as a hint under the field.
  - Under the fields sits «Усі поля необовʼязкові.» (muted).
  - Out-of-range values show the field error «Від {{min}} до {{max}}» and block "Готово".
  - **Bottom:**
    - a `border-t border-border-strong` row with a destructive ghost "Прибрати з тренування" (`Trash2`);
    - "Готово" (primary, full width) closes the sheet. Edits apply to the draft live; "Готово" only closes.
- **`ExercisePicker/`** (mobile). Board «Пікер вправ, моб».
  - **Container:** `Sheet side="bottom"` at full height (`h-dvh rounded-none`) with the title "Додати вправи" and the close X.
  - **Search and filters:**
    - the search `Input` plus `FilterSheet` (from `features/exercises`);
    - filters are local state (`useState<CatalogFilters>`), not URL params, fed to `useExercisesInfiniteQuery`;
    - the search is debounced with `SEARCH_DEBOUNCE_MS`.
  - **Rows:**
    - sections with `Diamond` headings as in the catalog;
    - each row is a `button aria-pressed` with a thumbnail, the name and «Мʼяз. Обладнання» (sentence form, no dot separator);
    - unpicked: a 20px `rotate-45 rounded-md border-[1.5px] border-planned` outline;
    - picked: a 24px `bg-primary` diamond with the pick number in `text-primary-foreground text-xs font-extrabold`.
    - Tapping again unpicks and renumbers.
    - Infinite scroll uses the catalog sentinel pattern.
  - **Bottom:** a sticky bar (`border-t border-border-strong bg-background`) with "Додати {{count}} вправу/вправи/вправ", disabled at 0. It appends the picks in order with `TARGET_DEFAULTS` and closes.
  - Picks beyond the 30-exercise cap are disabled, with the hint «До 30 вправ у тренуванні.».
- **`CatalogColumn/`** (desktop). Board «Редактор, десктоп 1440».
  - **Header:** h2 "Каталог", then search.
  - **Chips:** "Мої" and the muscle chips (`MuscleChips` with `before`), plus a ghost "Усі фільтри" button that opens `FilterSheet`. Give `FilterSheet` an optional `side` prop: `right` here, `bottom` by default.
  - **Rows:** compact rows in one card (48px thumbnail, name, «Мʼяз. Обладнання», and a 44px "+" `aria-label="Додати {{name}}"`).
  - Each row is a `useDraggable` source with data `{ kind: 'catalog', item }`. While dragging, the source row dims to 40%.
  - The column scrolls on its own (`lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] overflow-y-auto`).
  - One `DndContext` in `WorkoutEditor` covers both columns.
  - **`onDragOver`:** when the active item is a catalog item over the workout list or a row, compute the insert index (before the over row when the pointer is above its middle).
  - **`onDragEnd`:** insert a new `DraftItem` with defaults at that index.
- **`utils.ts`:**
  - `targetSummary(item, t, locale)`:
    - `3 × 8–12, 80 кг`, `3 × 10` (equal reps), `3 × 45 с`, `2 × 30 с на кожну сторону`, `1 × 5 км` / `1 × 400 м`;
    - sets alone give `3 підходи` (plural);
    - weight alone gives `80 кг`;
    - nothing gives an empty string, and the row then shows only the name and note.
    - Numbers are formatted with `formatNumber(locale, …)`.
  - `defaultTargets(trackingType)`.
  - `toPutInput(draft)`: trims, maps `''` → null, sends only the fields allowed for the tracking type.
  - `topMuscles` is not needed on the client; the server sends `primaryMuscles`.
- **`hooks/useWorkoutDraft.ts`:** the reducer and actions `setName`, `setDescription`, `add(items, index?)`, `move(from, to)`, `remove(key)`, `setTargets(key, patch)`.

### Library tabs (`src/features/library/LibraryTabs/LibraryTabs.tsx`)

- On the Workouts tab, render the accent "+" `OnlineLinkButton` (`ariaLabel="Створити тренування"`, href `/library/workouts/new`, `lg:hidden`), like the Exercises tab.
- Desktop shows the labelled `OnlineLinkButton size="sm"` "Створити тренування" with `Plus`, `max-lg:hidden`, right of the tabs.

### Today

- `today/page.tsx` adds `hasWorkouts(session.user.id)` to the `Promise.all` and passes `hasWorkouts` to `TodayView` → `TodayEmpty`.
- With `hasWorkouts`:
  - the headline is "Тренування готове", the line «Лишилося поставити його в календар.»;
  - steps 1 and 2 show an accent diamond with a `Check` (14px, `text-foreground`), muted text, and a visually hidden "Виконано: " prefix;
  - step 3 is the dark numbered diamond;
  - the button "Твої тренування" goes to `/library/workouts`, and "Переглянути вправи" stays.

### Own exercise delete dialog

`DeleteExerciseDialog`:

- reads `useWorkoutsQuery()` and filters `items` whose `exerciseIds` include the exercise;
- when there are any, the description adds «Її також буде прибрано з цих тренувань:» and a list of `Link`s to `/library/workouts/{id}`.

### i18n

- Add every string in §7 to the catalogs (`pnpm i18n:extract`) and fill uk.
- Plurals use `_one/_few/_many/_other` in uk.

## 7. Copy

| en (key) | uk |
| --- | --- |
| Create workout | Створити тренування |
| New workout \| Pampojo | Нове тренування \| Pampojo |
| Workout \| Pampojo | Тренування \| Pampojo |
| {{count}} exercises (plural) | {{count}} вправа / вправи / вправ |
| Add exercises | Додати вправи |
| Add exercises (tag) — key `Add exercises tag` | Додай вправи |
| Add {{count}} exercises (plural) | Додати {{count}} вправу / вправи / вправ |
| Actions for {{name}} | Дії для {{name}} |
| Duplicate | Дублювати |
| {{name}} (copy) | {{name}} (копія) |
| Delete "{{name}}"? | Видалити «{{name}}»? |
| Past workouts stay in your history. | Минулі тренування залишаться в історії. |
| No workouts yet (existing key) | Тренувань ще немає |
| Build a workout once and repeat it every week. | Збери вправи в тренування один раз і повторюй його щотижня. |
| Name the workout | Назви тренування |
| Add exercises from the catalog | Додай вправи з каталогу |
| Set sets, reps and weight (existing key) | Задай підходи, повтори й вагу |
| Couldn't load workouts. | Не вдалося завантажити тренування. |
| Try again (existing "Retry" style; key `Try again`) | Спробувати ще раз |
| Workouts (back link, existing) | Тренування |
| Name (existing) | Назва |
| Description (existing) | Опис |
| Optional | Необовʼязково |
| Exercises (existing) | Вправи |
| Drag from the catalog or press +. | Перетягни з каталогу або натисни +. |
| Catalog | Каталог |
| All filters | Усі фільтри |
| Add {{name}} | Додати {{name}} |
| Drag {{name}} | Перетягнути {{name}} |
| Save (existing) | Зберегти |
| Cancel (existing) | Скасувати |
| Add a name and at least one exercise to save. | Додай назву й хоча б одну вправу, щоб зберегти. |
| Workout saved | Тренування збережено |
| Couldn't save the workout. Try again. | Не вдалося зберегти тренування. Спробуй ще раз. |
| You can have up to 200 workouts. | Можна мати до 200 тренувань. |
| Needs internet (existing) | Потрібен інтернет |
| Workout not found | Тренування не знайдено |
| It may have been deleted, or the link is wrong. | Можливо, його видалили або посилання неправильне. |
| Back to workouts | До тренувань |
| How to do it | Як виконувати |
| Sets | Підходи |
| Weight, kg | Вага, кг |
| Reps | Повтори |
| From / To | Від / До |
| For an exact number, enter the same value twice. | Для точної кількості впиши однакові числа. |
| Duration, s | Тривалість, с |
| Distance, m | Дистанція, м |
| Note | Нотатка |
| per side | на кожну сторону |
| All fields are optional. | Усі поля необовʼязкові. |
| From {{min}} to {{max}} | Від {{min}} до {{max}} |
| Remove from workout | Прибрати з тренування |
| Done | Готово |
| Close (existing) | Закрити |
| Up to 30 exercises in a workout. | До 30 вправ у тренуванні. |
| Picked up "{{name}}". | Підняли «{{name}}». |
| "{{name}}" is at position {{position}} of {{count}}. | «{{name}}» на місці {{position}} з {{count}}. |
| "{{name}}" was dropped at position {{position}}. | «{{name}}» поставили на місце {{position}}. |
| Dragging cancelled. | Перетягування скасовано. |
| {{sets}} × {{reps}} | {{sets}} × {{reps}} |
| {{count}} sets (plural) | {{count}} підхід / підходи / підходів |
| {{value}} kg / {{value}} s / {{value}} km / {{value}} m | {{value}} кг / {{value}} с / {{value}} км / {{value}} м |
| Workout ready | Тренування готове |
| Now put it on your calendar. | Лишилося поставити його в календар. |
| Done: (sr-only) | Виконано: |
| Your workouts | Твої тренування |
| It will also be removed from these workouts: | Її також буде прибрано з цих тренувань: |
| {{muscle}}. {{equipment}} (picker line) | {{muscle}}. {{equipment}} |

## 8. Steps

1. **Dependencies.**
   - Add `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0` and `@dnd-kit/utilities@3.2.2` (`pnpm add`).
   - Create `src/constants/workout.ts` and export `TargetField`.
2. **Schema and migration.**
   - `src/server/db/schema/workout.ts`, re-exported from `schema/index.ts`.
   - `pnpm db:generate` → `0004_*.sql`. Review it: only the two new tables and their indexes and checks.
   - `pnpm db:migrate`.
3. **Shared schemas.** Create `src/shared/schemas/workout.ts` and `src/shared/schemas/__tests__/workout.test.ts`.
4. **Exercise list fields.**
   - Add `trackingType` and `laterality` to `exerciseListItemSchema`, `listExerciseRows` and `listExercises`.
   - Update `getExerciseListItemMock` and existing tests and fixtures that build list items.
5. **Server domain.**
   - Create `src/server/workouts/{errors,queries,service}.ts`.
   - Add the error codes to `src/server/http/errors.ts`.
   - Export `translationJoins` from `exercises/queries.ts`.
   - Call `removeExerciseFromWorkouts` in `deleteOwnExercise`.
   - Add the service tests.
6. **Routes.** Create `src/app/api/v1/workouts/route.ts` and `[id]/route.ts` with handler tests.
7. **Client API.**
   - Create `src/api/workouts.ts`.
   - Add `getWorkoutMock`, `getWorkoutListItemMock` and `getWorkoutExerciseMock` in `src/test/mocks.ts`.
   - Invalidate workouts in `useDeleteExerciseMutation`.
8. **Shared hook.** Move `useDiscardGuard` to `src/hooks/` and update the `ExerciseForm` import.
9. **Workout utilities.** Create `features/workouts/utils.ts` and `hooks/useWorkoutDraft.ts` with node tests.
10. **List.**
    - `WorkoutList`, `WorkoutListEmpty`, `WorkoutListSkeleton`.
    - The duplicate and delete flows.
    - Update the list page.
    - Update `LibraryTabs`.
11. **Editor.** `WorkoutEditor`, `WorkoutEditorSkeleton`, `WorkoutExerciseList`, `ExerciseTargetsSheet`, the pages `new` and `[id]`, and the not-found card.
12. **Adding exercises.**
    - `ExercisePicker` (mobile).
    - `CatalogColumn` (desktop) with drag-to-insert.
    - The `FilterSheet` `side` prop.
13. **Today.** Add `hasWorkouts` to the page, `TodayView` and `TodayEmpty`.
14. **Delete dialog.** Add the workout list to `DeleteExerciseDialog`.
15. **i18n.** Run `pnpm i18n:extract`, fill uk, run `pnpm i18n:check`.
16. **Docs.**
    - `docs/tech/API.md`: workout shapes, error codes, list item fields.
    - `docs/specs/09-workout-builder.md`: `WORKOUT_LIMIT_REACHED` 422.
    - `DECISIONS.md`: entries were added by `/scratch`.
17. **e2e.** Create `e2e/09-workout-builder.spec.ts` and update the e2e tests touched by the list item fields, if any.
18. **Checks.** Run `pnpm lint`, `typecheck`, `format:check`, `i18n:check`, the touched unit tests and the e2e files `09`, `07` and `28`.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/09-workout-builder.spec.ts` "creates a workout with three exercises and reopens it": mobile picker and desktop "+", targets and a note set in the sheet, save, reopen, assert order, summaries and note. Also "a new workout left unsaved is not listed" |
| AC2 | `WorkoutExerciseList.test.tsx`: keyboard drag (focus the handle, Space, ArrowDown, Space) moves the row, and the live region text is announced. e2e: mouse drag on desktop and touch drag on mobile (`page.touchscreen` or a pointer drag with `hasTouch`) reorders, then save and reopen |
| AC3 | `ExerciseTargetsSheet.test.tsx`: fields per tracking type (4 cases), no rest field, cleared fields saved as null. `features/workouts/__tests__/utils.test.ts`: `defaultTargets`, `targetSummary` cases, `toPutInput` drops fields not allowed for the type |
| AC4 | `src/app/api/v1/workouts/[id]/__tests__/route.test.ts`: the same PUT twice gives one row and 200 twice; DELETE twice gives 204 twice, `deleted_at` set once |
| AC5 | Same route test: another user's id on GET/PUT/DELETE returns 404, the row is unchanged; a PUT with a foreign own exercise or a deleted own exercise returns 400 `VALIDATION_FAILED` with the path |
| AC6 | `WorkoutList.test.tsx`: renders names, the plural count, at most 3 muscles in the server order, and the "0 вправ" tag; the empty state links to `/library/workouts/new`. `src/server/workouts/__tests__/service.test.ts`: `listWorkouts` orders by `updatedAt` desc, the top-3 muscle rule and thumbnails, and the query count stays constant for 2 and 5 workouts |
| AC7 | `WorkoutEditor.test.tsx`: after editing the name, Cancel opens "Скасувати зміни?"; "Продовжити редагування" stays; "Скасувати зміни" navigates; without edits Cancel navigates at once; `beforeunload` is prevented when dirty |
| AC8 | e2e desktop: drag "Віджимання" from the catalog column between rows 1 and 2, assert it is row 2; "+" appends it last |
| AC9 | `ExercisePicker.test.tsx`: picking 3 rows shows 1, 2, 3; unpicking the 1st renumbers; "Додати 3 вправи" calls `onAdd` with them in order. e2e mobile: add the same exercise twice |
| AC10 | `WorkoutEditor.test.tsx`: Save disabled with the hint for an empty name or no exercises. `src/shared/schemas/__tests__/workout.test.ts`: lengths, ranges, reps pair and order, 0 and 31 exercises. Service test: tracking-type mismatch 400 and the 201st workout 422 |
| AC11 | `WorkoutList.test.tsx`: Duplicate calls `putWorkout` with a new id and "Push Day (copy)" then navigates; Delete confirms with the copy and calls `deleteWorkout`. e2e: duplicate then delete |
| AC12 | `WorkoutEditor.test.tsx` with `onlineManager.setOnline(false)` (the pattern from the catalog test): inputs disabled, no handles, Save disabled with "Потрібен інтернет". `WorkoutList.test.tsx`: "…" disabled offline. e2e: `context.setOffline(true)` after load, both screens read-only |
| AC13 | `src/server/exercises/__tests__/write-service.test.ts`: deleting an own exercise removes its `workout_exercise` rows and touches those workouts. `DeleteExerciseDialog` test: lists linked workouts from `useWorkoutsQuery`. e2e (`09`): create an own exercise, add it as the only exercise, delete it, the list shows "0 exercises" and "Add exercises" |
| AC14 | `TodayView.test.tsx`: `hasWorkouts` shows "Workout ready", two steps with "Done:" and the "Your workouts" link |
| AC15 | `e2e/09-workout-builder.spec.ts`: no overflow on the list, the editor, the open sheet and the open picker, in en and uk, on both projects |

## 10. Risks and open questions

- **Touch drag inside a scrolling page.** `TouchSensor` with a 150ms delay keeps scrolling usable. If e2e touch drag is flaky in Playwright, cover the touch path with the keyboard and pointer tests and record it in §11.
- **Desktop drag between two lists.** One `DndContext` with a catalog `useDraggable` and a sortable target needs custom collision handling (`closestCenter` over the workout rows only). Keep catalog rows out of `SortableContext`.
- **Drag in tests.** `@dnd-kit` keyboard dragging works in Vitest browser mode. Pointer drags are covered in e2e.
- **`numeric` from Drizzle is a string.** Convert it in the service with `Number()`, and keep the 0.25 step in Zod.
- **Locks.** `lockOwner` from exercises is an advisory lock keyed `exercise-owner:<id>`. Reusing it serializes exercise and workout writes per user, which is harmless and keeps the limit checks safe. Rename the key to `owner:<id>` only if it is touched anyway.
- **Error code naming.** The spec said 409 `WORKOUT_LIMIT`. The code follows the existing `EXERCISE_LIMIT_REACHED` 422 convention, and the spec and `API.md` are updated in step 16.
- **Rest timer** — no rest target here; spec 10 decides (`DECISIONS.md` open question).
- **Offline editing, start from a workout, scheduling** — specs 16, 10 and 11.

## 11. Implementation notes

- **Shared pieces extracted while building:**
  - `src/components/StepList` (numbered diamond steps), used by `TodayEmpty` and `WorkoutListEmpty`;
  - `usePickerCatalog` (local filters, sections, infinite scroll), `useExerciseLine`, `CatalogScopeChips` and `CatalogSectionHeading` in `features/workouts`.
- **Exported from `src/server/exercises`:** `knownTrackingType`, `only` and `orNull` (service) and `translationJoins` (queries), reused by the workouts domain.
- **Component changes:**
  - `ConfirmDialog` gains an optional `children` slot for the list of affected workouts.
  - `FilterSheet` gains `side` and `triggerLabel` (the desktop "Усі фільтри" text trigger).
- **The name field label** uses the existing `Name` with `context: 'exercise'` («Назва»), because the plain `Name` key is «Ім'я».
- **Extra copy:** `{{reps}} reps` («8–12 повторів») for a reps target without sets. The plan had no wording for that case.
- **Drag and drop:**
  - the workout list is a drop target only while empty (a dashed slot, hidden on mobile), so the rows decide the drop position;
  - the drop index is recomputed on every move and read from a ref on drop, because a drop can come before the re-render;
  - catalog rows drag with the pointer only, and keyboard users add with "+".
- **AC2 keyboard test** lives in `WorkoutEditor.test.tsx`, not a separate `WorkoutExerciseList` test, because it needs the editor's `DndContext`.
- **e2e:**
  - `e2e/09` waits 300ms after a mouse drop: `@dnd-kit` swallows a click fired in the same moment as the drop;
  - touch drag on mobile passes with Playwright's mouse on the `hasTouch` project.
- **Today's empty-state button** "Create your first workout" still links to `/library/workouts`, as spec 28 tests it; the empty list there leads to `/library/workouts/new`.
- **`/library/workouts/new`** awaits `connection()`, because the editor makes the client id on render and must not run at build time.
- **The workout limit check** applies only to new workouts; editing an existing one at 200 still saves.

## 12. Review — 2026-11-14

**Verdict:** Pass with notes

Reviewed the uncommitted spec 09 change set on `feat/09-workout-builder`: migration `0004`, the `workouts` domain and routes, `features/workouts`, the Today and delete-dialog changes, and the docs. Screenshots are in `scratch/review/09-workout-builder/` (uk, 390×844 and 1440×900).

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/09` "creates a workout with three exercises and reopens it", "a new workout left without saving is not listed" |
| AC2 | Pass | `WorkoutEditor.test.tsx` keyboard reorder with announcement; `e2e/09` mouse (desktop) and touch-project drag |
| AC3 | Pass | `ExerciseTargetsSheet.test.tsx`, `features/workouts/__tests__/utils.test.ts`, `AC3-sheet-time-*.png` |
| AC4 | Pass | `src/app/api/v1/workouts/__tests__/route.test.ts` (PUT twice, DELETE twice) |
| AC5 | Pass | Same route test: foreign workout 404 on GET/PUT/DELETE; foreign and deleted own exercise 400 |
| AC6 | Pass | `WorkoutList.test.tsx`, `src/server/workouts/__tests__/service.test.ts` (order, top muscles, constant queries), `AC6-empty-*.png` |
| AC7 | Pass | `WorkoutEditor.test.tsx`, `AC7-discard-*.png`. See finding 2 for one leak. |
| AC8 | Pass | `e2e/09` desktop drop between rows and "+" |
| AC9 | Pass | `ExercisePicker.test.tsx`, `e2e/09` mobile picker adds the same exercise twice |
| AC10 | Pass | `src/shared/schemas/__tests__/workout.test.ts`, route and service tests (type mismatch 400, 201st workout 422), `AC10-new-disabled-*.png` |
| AC11 | Pass | `WorkoutList.test.tsx`, `e2e/09` duplicate then delete, `AC11-menu-*.png` |
| AC12 | Partial | Going offline on an open list or editor works (`e2e/09`, `WorkoutEditor.test.tsx`), but opening the editor from the list while offline shows a blank page (finding 1, `AC12-editor-offline-*.png`) |
| AC13 | Pass | `src/server/workouts/__tests__/service.test.ts`, `DeleteExerciseDialog.test.tsx`, `e2e/09` |
| AC14 | Pass | `TodayView.test.tsx` "marks the first two steps done" |
| AC15 | Pass | `e2e/09` no-overflow test, en and uk, both projects |

### Findings

1. [major] **Opening a workout offline shows a blank white page** — `src/features/workouts/WorkoutList/WorkoutList.tsx` (row `Link`).
   - The list renders from the TanStack Query cache offline, but its rows stay links. A client navigation needs the route's server payload, so the editor never loads and the screen goes white on both viewports.
   - The spec says the cached editor opens read-only. Today that holds only when the editor was already open.
   - The real fix belongs to the offline shell (spec 15 or 16, route caching). Until then, the rows could be disabled offline with "Потрібен інтернет", like the other actions.
2. [major] **"Як виконувати" in the exercise sheet leaves the editor without the discard prompt** — `src/features/workouts/ExerciseTargetsSheet/ExerciseTargetsSheet.tsx:96`.
   - It is a plain `Link` to the exercise page. With unsaved edits, the draft is lost silently.
   - The 2026-11-11 rule lets only shell navigation and browser Back skip the prompt; this is a link inside the editor.
   - Fix: route it through the editor's discard guard, or open the details in a new tab.
3. [minor] **The exercise sheet autofocuses "Підходи" and selects its value** (Radix default; `AC3-sheet-time-desktop.png`). On a phone this opens the keyboard over half the sheet on every tap of a row. Fix: `onOpenAutoFocus` → focus the sheet title or nothing.
4. [minor] **The mobile offline "+" pushes "Потрібен інтернет" under itself in the tabs row** — `src/features/library/LibraryTabs/LibraryTabs.tsx:57` (`AC12-list-offline-mobile.png`). `OnlineLinkButton`'s hint wraps beside the tabs and breaks the row. For the icon-only "+" the hint could be omitted, or shown as a tooltip.
5. [minor] **The Save hint sits under "Скасувати", not under "Зберегти"** — `src/features/workouts/WorkoutEditor/WorkoutEditorForm.tsx:306` (`AC10-new-disabled-mobile.png`). On mobile it reads as belonging to Cancel. Put it directly under the Save button.
6. [minor] **A new mobile workout has no visual slot for exercises.** The empty list is hidden below `lg`, so "Вправи 0 вправ" sits right above "Додати вправи" (`AC10-new-disabled-mobile.png`). Acceptable, but the design board always showed rows.
7. [minor] **The reps fields do not mirror each other on screen.** Typing only "Від 8" stores 8–8 (summary "3 × 8"), but the "До" field stays visually empty. The data is right; the field looks unfilled.

The code checks found no issues:

- every query is scoped by `owner_id`, and a foreign row is reported as 404;
- `PUT` is an idempotent upsert in one transaction with the per-user advisory lock;
- `DELETE` is repeat-safe;
- the list makes 2 queries plus 1 Storage call (tested);
- no secrets or build output are in the diff;
- comments follow `CLAUDE.md`;
- the deviations are recorded in §11.

### Checks

- lint: pass
- typecheck: pass
- format and i18n: pass
- tests: 79 files, 490 tests pass
- e2e:
  - `09`: 16 passed, 2 skipped (viewport-specific);
  - full run on `pnpm dev`: 164 passed, 11 skipped, 3 failed:
    - `05` placeholder (twice): expected, the test asserted "Workout builder is coming soon."; updated, passes now;
    - `02` mobile menu: the known dev-indicator overlap.

### Out of scope

- **Offline route caching** (finding 1) belongs to the PWA and offline specs (15 and 16).
- **The dev server cached an old build** of the new `GET /api/v1/workouts` and returned 500 until the file was recompiled. Restart `pnpm dev` after pulling this branch.
- **Rest timer length** is still open for spec 10 (`DECISIONS.md`).
