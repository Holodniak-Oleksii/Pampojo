# 07-custom-exercises — technical plan

Spec: `docs/specs/07-custom-exercises.md`

## 1. Summary

Users create, edit, duplicate and delete their own exercises, with up to 4 photo frames:

- write endpoints `PUT`, `PATCH` and `DELETE /api/v1/exercises/{id}`;
- frame upload and removal endpoints;
- a private Storage bucket with signed URLs;
- server-side WebP conversion with `sharp`, which becomes a runtime dependency;
- a full-page form at `/library/exercises/new` and `/library/exercises/[id]/edit`;
- catalog changes: a "Mine" chip, a "Mine" badge, a "Create exercise" button;
- details page actions: Edit, Delete, Duplicate as my own.

Frame animation from spec 06 is generalised from 2 frames to N.

Lead decisions this plan relies on (`DECISIONS.md`, 2026-11-11):

- deleting own exercises;
- own exercise photos;
- the server Storage key;
- own exercises in the catalog;
- own exercise rules;
- `sharp` at runtime;
- the discard-changes prompt.

## 2. Acceptance criteria

- **AC1:** Creating an exercise with only name, one primary muscle, one equipment value and a tracking type:
  - succeeds (`PUT` 200);
  - the exercise appears in `/library/exercises` in the section of its first primary muscle;
  - it also appears with `?mine=1`;
  - its row or card shows the "Mine" badge.
- **AC2:** For user B's exercise, user A gets:
  - no item in `GET /api/v1/exercises` (with or without `q`, `mine`);
  - 404 `EXERCISE_NOT_FOUND` from `GET`, `PATCH`, `DELETE /api/v1/exercises/{id}`, `PUT` and `DELETE …/frames/{frameId}`;
  - `PUT /api/v1/exercises/{id}` with B's id → 404, and B's row is unchanged.
- **AC3:** Editing and system exercises:
  - `PATCH` with `{ name }` changes only the name; every other column and translation field stays the same;
  - `PATCH`, `DELETE`, `PUT` and the frame endpoints on a system exercise return 403 `EXERCISE_READ_ONLY`;
  - the system details page shows no Edit or Delete button, only "Duplicate as my own".
- **AC4:** File checks:
  - in the form, a file over 5 MB shows "The image must be 5 MB or smaller.", and a non-JPEG/PNG/WebP file shows "Use a JPEG, PNG or WebP image."; neither is uploaded;
  - the frame endpoint returns 413 `IMAGE_TOO_LARGE` for a body over 5 MB, and 400 `IMAGE_INVALID` when sharp cannot read it or the format is not jpeg/png/webp;
  - a valid upload stores `…-thumb.webp` (160px wide) and `…-full.webp` (800px wide) in `exercise-user-media`, and `GET` returns signed URLs that load.
- **AC5:** Frames:
  - up to 4 per exercise; a 5th upload returns 422 `FRAME_LIMIT_REACHED`;
  - frames can be reordered (`PATCH frameOrder`) and removed, and the order survives a reload;
  - details and card hover cycle the frames in order every 1000ms; with reduced motion a tap shows the next frame;
  - 1 frame is static, 0 frames shows the placeholder.
- **AC6:** After the confirm dialog, `DELETE`:
  - soft deletes the row (`deleted_at` set);
  - the exercise is gone from lists and search, and `GET` by id → 404;
  - its Storage files are deleted (Storage delete called with all its keys).
- **AC7:** "Duplicate as my own" on a system exercise:
  - opens `/library/exercises/new?from=<id>` prefilled with its fields (current-locale text) and photos;
  - saving creates a new own row with `source_exercise_id = <system id>` and copies of the frame files under the user's prefix;
  - the system row and its files are unchanged.
- **AC8:** Name uniqueness:
  - creating or renaming to a name equal to another own non-deleted exercise's name after `normalizeSearch` → 409 `EXERCISE_NAME_TAKEN`, and the form shows "You already have an exercise with this name." under Name;
  - a name equal to a system exercise is accepted;
  - a name equal to a deleted own exercise is accepted.
- **AC9:** With 300 own non-deleted exercises, creating another → 422 `EXERCISE_LIMIT_REACHED`, and the form shows "You've reached 300 exercises of your own." above the Save button.
- **AC10:** Idempotency:
  - the same `PUT /exercises/{id}` twice → one row, the same response;
  - the same `PUT …/frames/{frameId}` twice → one frame entry in `media` (files overwritten).
- **AC11:** Offline (`navigator.onLine` false):
  - "Create exercise", "Edit", "Delete" and "Duplicate as my own" are disabled with the text "Needs internet";
  - the form's Save is disabled with the same hint.
- **AC12:** An exercise created with the `uk` locale shows its Ukrainian name, description and steps with the `en` locale too, and the reverse.
- **AC13:** Form layout and leaving:
  - at 390px and 1440px there is no horizontal scroll;
  - field errors show under their fields and the page scrolls to the first one;
  - with unsaved changes, Cancel and the form's back link open "Discard changes?", and reload or close triggers `beforeunload`.

## 3. Data

### Migration — no new columns

`media` already exists. The `exercise_media` shape widens in Zod only. No SQL migration is needed. Confirm with `pnpm db:generate`: it must say "No schema changes".

### Constants — `src/constants/exercise.ts` (add)

```ts
export const OWN_EXERCISE_LIMIT = 300;
export const FRAME_LIMIT = 4;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_UPLOAD_MAX_SIDE = 1600; // browser downscale
export const DESCRIPTION_MAX = 500;
export const STEP_MAX = 200;
export const STEPS_MAX_COUNT = 10;
export const MISTAKES_MAX_COUNT = 5;
export const EXERCISE_USER_MEDIA_BUCKET = 'exercise-user-media';
export const SIGNED_URL_TTL_SECONDS = 3600;
```

### Zod — `src/shared/schemas/exercise.ts`

- `exerciseMediaSchema` becomes `{ frames: { id?: uuid, thumb: string, full: string }[] }`. System frames have no `id`.
- `exerciseFrameSchema` (API) becomes `{ id: string | null, thumbUrl, fullUrl }`. `id` is null for system frames. It is used in both `exerciseSchema.frames` and `exerciseListItemSchema.frames`.
- `exerciseSchema` gains `sourceExerciseId: uuid | null`.
- `listExercisesQuerySchema` gains `mine: z.enum(['1']).optional()`.
- `exerciseFieldsSchema` (the shared form and body base):
  - `name`: trim, 1–80, error codes;
  - `primaryMuscles`: min 1, unique;
  - `secondaryMuscles`: unique, refined to exclude primary ones;
  - `equipment`: min 1;
  - `trackingType`;
  - `movementPattern`, `mechanic`, `laterality`: nullable;
  - `description`: trim, ≤500, default `''`;
  - `instructions`: ≤10 items, each trim 1–200;
  - `commonMistakes`: ≤5 items, each trim 1–200.
- `createExerciseInputSchema` is `exerciseFieldsSchema.extend({ sourceExerciseId: z.uuid().nullable().default(null) }).strict()`.
- `updateExerciseInputSchema` is `exerciseFieldsSchema.partial().extend({ frameOrder: z.array(z.uuid()).max(4).optional() }).strict()`, refined to need at least one key.
- `EXERCISE_FIELD_ERROR` codes follow the profile pattern (`name_required`, `name_too_long`, `primary_required`, `equipment_required`, `text_too_long`, `name_taken`); the form maps them to copy.
- `exerciseFrameParamsSchema`: `{ id: uuid, frameId: uuid }`.

### Storage layout

- **Private bucket `exercise-user-media`.** The media script and the server create it lazily with `public: false`.
- **Keys:** `users/<userId>/<exerciseId>/<frameId>-thumb.webp` and `…-full.webp`.
- **Bucket rule:** own rows (`owner_id` not null) always use the private bucket, system rows the public one.

## 4. API

Every route uses `auth: 'required'`. Write handlers follow `request-safety.md`: `PUT` with client ids, so retries are safe.

| Method and path | Body | 200 response | Errors |
| --- | --- | --- | --- |
| `PUT /api/v1/exercises/{id}` | `createExerciseInput` | `Exercise` | 403 READ_ONLY (system id), 404 (another user's id), 409 NAME_TAKEN, 422 LIMIT_REACHED, 400 VALIDATION_FAILED, 404 if `sourceExerciseId` is not a visible system exercise |
| `PATCH /api/v1/exercises/{id}` | `updateExerciseInput` | `Exercise` | 403, 404, 409, 400 (also: `frameOrder` must be a permutation of the current frame ids) |
| `DELETE /api/v1/exercises/{id}` | — | `204` | 403, 404 |
| `PUT /api/v1/exercises/{id}/frames/{frameId}` | multipart `file` | `Exercise` | 403, 404, 413 IMAGE_TOO_LARGE, 400 IMAGE_INVALID, 422 FRAME_LIMIT_REACHED |
| `DELETE /api/v1/exercises/{id}/frames/{frameId}` | — | `Exercise` | 403, 404 (exercise or frame) |

- `GET /api/v1/exercises?mine=1` filters to `owner_id = $userId`.

**`PUT` semantics (idempotent create):**

- No row with `id` → insert, with `owner_id = userId`, one translation row in `requestLocale(request)`, and `source_exercise_id`. When duplicating, copy the source's frames.
- The row exists and `owner_id = userId` → update the fields from the body, keep the frames, and return 200 with the same shape. A replay changes nothing.
- The row is a system row → 403. The row belongs to another user → 404.

**Frame `PUT`:**

- The handler reads `request.formData()`, takes `file` (a `File`), and checks `file.size ≤ IMAGE_MAX_BYTES` before reading the bytes (413).
- It passes `Buffer` + `file.type` to the service.
- When the frame id already exists: overwrite the files and keep its position.
- A new id: append at the end; the 5th → 422.

**Error codes** go into `ERROR_STATUS` in `src/server/http/errors.ts`: `EXERCISE_READ_ONLY: 403`, `EXERCISE_NAME_TAKEN: 409`, `EXERCISE_LIMIT_REACHED: 422`, `FRAME_LIMIT_REACHED: 422`, `IMAGE_INVALID: 400`, `IMAGE_TOO_LARGE: 413`, `FRAME_NOT_FOUND: 404`.

`withHandler` needs no change: the frame route declares no `body` schema and reads the form itself.

`docs/tech/API.md` is already updated by the drill.

## 5. Server

### Env

`src/server/env-schema.ts` adds `SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional()`.

- The key is used only by `src/server/storage/client.ts`.
- When it or `SUPABASE_URL` is missing, write operations throw `DomainError('STORAGE_UNAVAILABLE')`, mapped to 503 in `ERROR_STATUS`.
- Reads of own frames return no URLs (the placeholder).

`.env.example`: remove "never in Vercel", and describe the key as the server's dedicated secret key.

### `src/server/storage/` (new domain)

**`client.ts`** (`import 'server-only'`) uses the Storage REST API through `fetch`. Auth is the same rule as the seed script: `sb_…` keys go in `apikey` only, legacy JWTs in both headers.

| Function | Call |
| --- | --- |
| `ensureBucket(bucket, isPublic)` | `POST /storage/v1/bucket`, "already exists" counts as success; memoised per process |
| `putObject(bucket, key, body, contentType)` | `POST /storage/v1/object/{bucket}/{key}` with `x-upsert: true`, `cache-control: max-age=31536000` |
| `copyObject(fromBucket, fromKey, toBucket, toKey)` | `POST /storage/v1/object/copy` `{ bucketId, sourceKey, destinationBucket, destinationKey }`; on 400/404 falls back to `GET` public + `putObject` |
| `removeObjects(bucket, keys)` | `DELETE /storage/v1/object/{bucket}` `{ prefixes: keys }` |
| `signUrls(bucket, keys, ttl)` | `POST /storage/v1/object/sign/{bucket}` `{ expiresIn, paths }`; returns `Map<key, absoluteUrl>`; one call per response |

**`images.ts`:** `toWebpFrames(buffer, mimeType)`.

- Reject a type not in `IMAGE_TYPES`, or a sharp `metadata().format` not in `jpeg|png|webp` → `IMAGE_INVALID`.
- Run `sharp(buffer).rotate()` (EXIF orientation), then resize to widths 160 and 800 with `withoutEnlargement`, and `.webp({ quality: 75 })`.
- Return `{ thumb: Buffer, full: Buffer }`.

**`index.ts`:** re-export for the exercises domain.

### `src/server/exercises/` (extend)

**`errors.ts`** adds `READ_ONLY`, `NAME_TAKEN`, `LIMIT_REACHED`, `FRAME_LIMIT_REACHED`, `FRAME_NOT_FOUND`, `IMAGE_INVALID`, `IMAGE_TOO_LARGE`.

**`media.ts`:**

- `frameUrls(rows, userId)` collects own frame keys from every row, calls `signUrls` once, and maps.
- System frames keep `publicMediaUrl`.
- `listExercises` and `findExercise` both use it, so the list stays 1 SQL query plus at most 1 Storage call.

**`queries.ts`** (all scoped):

- `listExerciseRows` gains `mine: boolean`, which adds `and e.owner_id = ${userId}`.
- `lockExerciseRow(tx, id)` runs `select … for update`, without an owner filter, so the service can tell 403 from 404.
- `lockOwnerExercises(tx, userId)` runs `select pg_advisory_xact_lock(hashtext(${'exercise-owner:' + userId}))`, which serialises one user's create, rename and limit checks.
- `countOwn(tx, userId)` counts own rows where `deleted_at is null`.
- `ownNameTaken(tx, userId, normalizedName, exceptId)` checks for an `exists` own non-deleted translation with that `search_name`.
- `insertOwnExercise(tx, values)` and `insertTranslation(tx, values)`.
- `updateExerciseFields(tx, id, fields)` and `updateTranslationFields(tx, id, fields)` write only the given keys (`.set(pick…)` + `touch()`).
- `setMedia(tx, id, media)`.
- `softDelete(tx, id)`.

**`service.ts`:**

- `createOwnExercise(userId, locale, id, input)`, in a transaction:
  1. lock the owner and the row;
  2. if the row exists, branch per the `PUT` semantics;
  3. otherwise: limit → name check → insert row and translation → copy source frames when `sourceExerciseId`. The source is loaded with `findExerciseRow` and must have `owner_id is null`; new frame ids come from `randomUUID`.
  4. Storage copies run after the DB writes inside the transaction. If a copy fails, throw so the transaction rolls back, then remove the already copied keys (best effort).
- `updateOwnExercise(userId, id, input)`:
  - lock;
  - 403/404;
  - a name change runs the name check under the owner lock;
  - write the given fields;
  - `frameOrder` must contain exactly the current ids (else 400) and reorders `media.frames`.
- `deleteOwnExercise(userId, id)`:
  - lock;
  - 403/404;
  - soft delete;
  - after commit, `removeObjects` for every frame key; a failure is logged, not thrown, and leaves orphans (see Risks).
- `putFrame(userId, id, frameId, file)`:
  - convert first, outside the transaction;
  - then in a transaction: lock, 403/404, limit 4 unless `frameId` exists;
  - `putObject` both sizes;
  - update `media` (replace in place or append).
- `deleteFrame(userId, id, frameId)`: lock → 403/404 → `FRAME_NOT_FOUND` → remove from `media` → after commit, `removeObjects`.
- Every function returns `findExercise(userId, requestLocale, id)`, so clients get the fresh `Exercise`.
- Ownership: every read and write checks `owner_id = userId`. A foreign row → 404, a system row → 403 (spec AC3), only on write paths.

### Routes

- `src/app/api/v1/exercises/[id]/route.ts` adds `PUT`, `PATCH`, `DELETE` (`DELETE` returns `new Response(null, { status: 204 })`).
- New `src/app/api/v1/exercises/[id]/frames/[frameId]/route.ts` with `PUT` and `DELETE`.

### `package.json`

Move `sharp` from devDependencies to dependencies (`pnpm remove -D sharp && pnpm add sharp`, same version).

### Media script

`src/server/db/seed/media.ts` is unchanged. Optionally, `ensureBucket` for the private bucket can run from the server only.

## 6. Client

### API client — `src/api/exercises.ts` (extend)

- `exerciseKeys.detail(id)`.
- `createExercise(id, input)`, `updateExercise(id, input)`, `deleteExercise(id)`, `uploadFrame(id, frameId, blob)` (a `FormData` body; `http.ts` must not set a JSON `content-type` when the body is `FormData`, a small change in `http.ts`), `deleteFrame(id, frameId)`.
- `useSaveExerciseMutation()` runs the whole save as one mutation (below), and on success invalidates `exerciseKeys.lists()` and `exerciseKeys.detail(id)`.
- `useDeleteExerciseMutation()` invalidates the lists.
- `fetchExercises` adds `mine`.

### Save sequence (`src/features/exercises/ExerciseForm/save.ts`)

1. The exercise id: a new one from `crypto.randomUUID()`, created once when the page mounts (so a retry reuses it), or the existing id when editing.
2. `PUT` (create) or `PATCH` (edit, dirty fields only).
3. For each slot in form order:
   - a new local file → `uploadFrame(id, slot.id, compressed blob)`, where `slot.id` is generated when the file is picked;
   - a slot removed by the user that existed on the server (edit, or a copied duplicate frame) → `deleteFrame`.
4. If the final order differs from the server's order → `PATCH { frameOrder }`.
5. Steps run one after another. Each slot shows a spinner while it uploads, and an error with Retry if it fails.
6. Retry repeats the failed step with the same ids, which is idempotent.

Duplicate: the `PUT` response contains the copied frames in source order. The client maps them to its prefilled slots by index, then applies removals and reorders.

### Image preparation (`src/features/exercises/ExerciseForm/prepareImage.ts`)

- Reject when the type is not in `IMAGE_TYPES`, or `size > IMAGE_MAX_BYTES`.
- `createImageBitmap(file, { imageOrientation: 'from-image' })`, scale to a long side ≤1600, draw on a canvas, then `canvas.toBlob('image/jpeg', 0.85)`. JPEG because Safari cannot encode WebP from canvas.
- The preview uses `URL.createObjectURL`, revoked on unmount.

### Routes

- `src/app/[lang]/(app)/library/exercises/new/page.tsx`:
  - server component: reads `searchParams.from`;
  - when it is a uuid of a visible **system** exercise (`getRequestExercise` + `!isOwn`), passes it as `source`; otherwise the form is empty;
  - title `New exercise · Pampojo`;
  - `<Suspense>` + `ExerciseFormSkeleton`.
- `src/app/[lang]/(app)/library/exercises/[id]/edit/page.tsx`:
  - loads `getRequestExercise`; `notFound()` unless it exists and `isOwn`;
  - title `Edit exercise · Pampojo`.
- Both sit outside `(tabs)`, next to `[id]`. `new` must not clash with `[id]`: a static segment wins in the App Router. The `[id]` page already sends a non-uuid to not-found; check that `/library/exercises/new` renders the form.

### Feature — `src/features/exercises/`

| Item | Notes |
| --- | --- |
| `ExerciseForm/` | Client entry. React Hook Form + `zodResolver(exerciseFieldsSchema)`. Props `{ mode: 'create' \| 'edit', exercise?: Exercise, source?: Exercise }`. Field arrays for steps and mistakes (`useFieldArray`). Muscle pickers reuse `MuscleChips` (generalise: `selected`, `onToggle`, optional `label`); equipment uses a checkbox list (reuse the `EquipmentFilter` `list` variant through props `legend`). Selects for tracking, movement, type and sides use the native `<select>` styled like `Input` ("Not set" option), with no new shadcn component. Save is disabled while offline or submitting. Server errors map by code: `EXERCISE_NAME_TAKEN` → name field error; `EXERCISE_LIMIT_REACHED` → form-level error above Save; others → toast "Something went wrong. Try again." (existing key). |
| `ExerciseForm/PhotoSlots.tsx` | Up to 4 slots (2 shown at first), each with an `ExerciseImage` preview, Add/Replace (hidden `<input type="file" accept="image/jpeg,image/png,image/webp">`), Move up/down, Remove, a status of idle/uploading/error. Labels: Start position, End position, then "Frame {{n}}". |
| `ExerciseForm/useDiscardGuard.ts` | `beforeunload` while dirty; `confirmLeave()` opens the Discard dialog for Cancel and the back link. |
| `ExerciseFormSkeleton/` | |
| `DeleteExerciseDialog/` | shadcn `Dialog`; Delete calls the mutation, then the toast "Exercise deleted" and `router.push('/library/exercises')`. |
| `ExerciseDetails` | Own: Edit link and Delete button. System: Duplicate link (`/library/exercises/new?from=id`). All disabled offline with the hint "Needs internet". |
| `ExerciseFrames` | Generalised to N frames: cycle `index = (index + 1) % n`. Alt: 2 frames and system → Start/End position (unchanged); otherwise "{{name}}, frame {{n}} of {{total}}". Reduced motion: the button shows the next frame. |
| `ExerciseListItem` | Hover already cycles N frames. Add the "Mine" badge (`item.isOwn`). |
| `ExerciseCatalog` | "Create exercise" button (link styled as button, disabled offline with the hint), placed after the Equipment control on mobile and at the top of the filter column on desktop. A "Mine" chip before the muscle chips (an `aria-pressed` toggle, same style). Mine empty state when `filters.mine && items.length === 0 && !q/muscles/equipment`. `CatalogFilters` gains `mine: boolean`; `useCatalogParams` reads and writes `mine=1`. |

### Offline

`useIsOnline()` disables every write control and shows the hint. Requests are never sent offline.

### Layout

- 390px: one column, photo slots in a 2-column grid on top, fields below, a sticky Save bar at the bottom above the bottom nav (`sticky bottom-[calc(76px+inset)]`).
- ≥1024px: `grid lg:grid-cols-[minmax(0,420px)_1fr] gap-8`, photos left (sticky), fields right, Save and Cancel inline.

## 7. Copy

Exactly as in the spec table. Strings to add to `en.json` and `uk.json`:

| Key (en) | uk |
| --- | --- |
| Create exercise | Створити вправу |
| Mine | Мої |
| Mine_badge (context `badge`) | Моя |
| No exercises of your own yet | Власних вправ ще немає |
| Create one for anything the catalog misses. | Створи вправу, якої бракує в каталозі. |
| New exercise | Нова вправа |
| Edit exercise | Редагування вправи |
| New exercise · Pampojo | Нова вправа · Pampojo |
| Edit exercise · Pampojo | Редагування вправи · Pampojo |
| Name | Назва |
| Primary muscles | Основні м'язи |
| Secondary muscles | Допоміжні м'язи |
| Description | Опис |
| Steps | Кроки |
| Photos | Фото |
| Not set | Не вказано |
| Add step / Add mistake / Move up / Move down / Remove | Додати крок / Додати помилку / Вище / Нижче / Видалити |
| Frame {{n}} / Add frame / Add photo / Replace photo / Remove photo | Кадр {{n}} / Додати кадр / Додати фото / Замінити фото / Видалити фото |
| Use a JPEG, PNG or WebP image. | Використай зображення JPEG, PNG або WebP. |
| The image must be 5 MB or smaller. | Зображення має бути не більше 5 MB. |
| Upload failed. | Не вдалося завантажити. |
| Enter a name. | Введи назву. |
| Up to 80 characters. | Не більше 80 символів. |
| Pick at least one primary muscle. | Обери хоча б один основний м'яз. |
| Pick at least one piece of equipment. | Обери хоча б одне обладнання. |
| You already have an exercise with this name. | У тебе вже є вправа з такою назвою. |
| Up to {{max}} characters. | Не більше {{max}} символів. |
| You've reached 300 exercises of your own. | Ти досяг ліміту в 300 власних вправ. |
| Save / Cancel | Зберегти / Скасувати |
| Exercise saved | Вправу збережено |
| Discard changes? / Your changes will be lost. / Discard / Keep editing | Скасувати зміни? / Зміни буде втрачено. / Скасувати зміни / Продовжити редагування |
| Edit / Delete / Duplicate as my own | Редагувати / Видалити / Дублювати як мою |
| Delete this exercise? / It will be removed from your catalog. This can't be undone. | Видалити цю вправу? / Її буде прибрано з твого каталогу. Цю дію не можна скасувати. |
| Exercise deleted | Вправу видалено |
| Needs internet | Потрібен інтернет |
| {{name}}, frame {{n}} of {{total}} | {{name}}, кадр {{n}} з {{total}} |

Reuse the existing keys: Equipment, Tracking, Movement, Type, Sides, Common mistakes, Start position, End position, Retry, Cancel (if present).

"Mine" (chip) and "Mine" (badge) differ in Ukrainian, so the badge uses `t('Mine', { context: 'badge' })` (key `Mine_badge`). Context keys are known to extract (scratch 06).

## 8. Steps

Each step ends with `pnpm typecheck` passing.

1. **Dependencies and config.**
   - Move `sharp` to dependencies.
   - Add `SUPABASE_SERVICE_ROLE_KEY` (optional) to `env-schema.ts`; update `.env.example`.
   - Add the error codes, plus `STORAGE_UNAVAILABLE: 503`, to `ERROR_STATUS`.
2. **Constants and schemas.** Add the constants and the Zod changes from §3, and tests in `src/shared/schemas/__tests__/exercise.test.ts` (create/update rules, the secondary-vs-primary refine, the frameOrder max, `mine`).
3. **Storage domain.** `src/server/storage/{client,images,index}.ts`, with tests in `src/server/storage/__tests__/images.test.ts` (real sharp: a PNG → 2 WebP sizes; a text buffer → `IMAGE_INVALID`) and `client.test.ts` (`fetch` mocked: headers for `sb_` and legacy keys, sign mapping, copy fallback).
4. **Frame URLs.** `media.ts` `frameUrls` with signing; update `listExercises` and `findExercise`, add `mine` and `sourceExerciseId`. Extend the existing service tests (`mine`; signed URLs come from the mocked storage).
5. **Write service.** Queries and service functions from §5. Tests in `src/server/exercises/__tests__/write.test.ts`: real DB in `withRollback`, Storage mocked with `vi.mock('@/server/storage')`.
6. **Routes.** `[id]/route.ts` `PUT`, `PATCH`, `DELETE`; `[id]/frames/[frameId]/route.ts`. Tests in `src/app/api/v1/exercises/__tests__/write-route.test.ts` (committed rows under `test-exercises-write-` users, Storage mocked).
7. **Transport.** `src/api/http.ts` passes `FormData` without a JSON content type; add a test to the existing http tests if present.
8. **API client.** `src/api/exercises.ts` write functions and mutations; mocks.
9. **Frames generalisation.** `ExerciseFrames` (N frames, alt text), `ExerciseListItem` badge; update `ExerciseDetails.test.tsx` and `ExerciseListItem.test.tsx` (3 frames cycle 0→1→2→0; badge).
10. **Catalog.** "Mine" chip, the `mine` param, Create button, Mine empty state; update `ExerciseCatalog.test.tsx`.
11. **Form.** `prepareImage.ts` (unit-tested where canvas exists in browser mode), `PhotoSlots`, `ExerciseForm`, `save.ts`, `useDiscardGuard`, the skeleton; `ExerciseForm.test.tsx`.
12. **Pages.** `new/page.tsx`, `[id]/edit/page.tsx`; details actions and `DeleteExerciseDialog`.
13. **Copy.** `pnpm i18n:extract`, fill `uk.json`, `pnpm i18n:check`.
14. **e2e.** `e2e/07-custom-exercises.spec.ts`: create, edit, duplicate, delete, photo upload with a small fixture image in `e2e/fixtures/`, offline, the uk/en text, layout.
15. **Checks.** lint, typecheck, format:check, i18n:check, the touched tests, build, e2e 05/06/07.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `write.test.ts`: create with the minimal body → row with `owner_id`, one translation, `popularity` null; then `listExercises` with `mine` returns it with `isOwn`. `e2e/07`: create through the form → visible under "Mine" with the badge |
| AC2 | `write-route.test.ts`: user A on user B's id: `GET`, `PATCH`, `DELETE`, `PUT` (both routes), `DELETE` frame → 404; `PUT` create on B's id leaves B's row unchanged. `service.test.ts`: list and search with `mine` exclude foreign rows |
| AC3 | `write.test.ts`: `PATCH { name }` keeps every other field (compare the row before and after); system id → `EXERCISE_READ_ONLY` for update, delete, putFrame, deleteFrame. `ExerciseDetails.test.tsx`: system shows only Duplicate; own shows Edit and Delete |
| AC4 | `prepareImage` test (browser): 6 MB blob → size error; `text/plain` → type error; 3000×2000 PNG → JPEG ≤1600px. `images.test.ts`: invalid bytes → `IMAGE_INVALID`, widths 160/800. `write-route.test.ts`: 6 MB multipart → 413; text file → 400. `e2e/07`: upload a fixture JPEG, details show an `img` with a signed URL that loads (`naturalWidth > 0`) |
| AC5 | `write.test.ts`: 4 frames ok, 5th → `FRAME_LIMIT_REACHED`; `frameOrder` reorder kept; a bad permutation → 400; `deleteFrame` removes it and calls `removeObjects`. `ExerciseDetails.test.tsx` / `ExerciseListItem.test.tsx`: 3-frame cycle and the reduced-motion tap. `e2e/07`: reorder in the form, reload, order kept |
| AC6 | `write.test.ts`: delete → `deleted_at` set, `findExercise` → null, list excludes it, `removeObjects` called with all keys. `e2e/07`: delete dialog → back on the catalog, the item is gone, its URL → not-found |
| AC7 | `write.test.ts`: create with `sourceExerciseId` of a fixture system row → `source_exercise_id` set, `copyObject` called per source frame into the user prefix, the system row unchanged; an own or foreign source → 404. `e2e/07`: Duplicate → prefilled name → Save → a new own exercise, and the system one still shows no Mine badge |
| AC8 | `write.test.ts`: the same name with a different case or diacritics → `EXERCISE_NAME_TAKEN`; the same as a system name → ok; the same as a deleted own → ok; renaming onto another own name → 409. `ExerciseForm.test.tsx`: a 409 response shows the error under Name |
| AC9 | `write.test.ts`: insert 300 own rows in `withRollback` (one bulk insert), the next create → `EXERCISE_LIMIT_REACHED`. `ExerciseForm.test.tsx`: 422 → the limit message above Save |
| AC10 | `write.test.ts`: the same create twice → 1 row and equal responses; the same frame twice → `media.frames.length` 1. `write-route.test.ts`: the `PUT` replay returns 200 both times |
| AC11 | `ExerciseCatalog.test.tsx`, `ExerciseDetails.test.tsx`, `ExerciseForm.test.tsx`: `navigator.onLine` false → buttons disabled with "Needs internet". `e2e/07`: `context.setOffline(true)` on details and catalog |
| AC12 | `write.test.ts`: create with locale `uk` → `findExercise(…, 'en')` returns the uk text. `e2e/07`: create in uk-UA, switch to en, details show the same name |
| AC13 | `ExerciseForm.test.tsx`: an empty submit shows the required errors and focuses Name; dirty + Cancel → "Discard changes?"; `beforeunload` listener added when dirty. `e2e/07`: no horizontal scroll at both widths in `en-US` and `uk-UA` |

Testing rules:

- Storage is mocked in unit and route tests (`docs/development/backend/testing.md`).
- e2e uses real Storage. CI needs `SUPABASE_SERVICE_ROLE_KEY` as a GitHub secret, or those e2e cases skip with a clear message.

## 10. Risks and open questions

- **Lead action before e2e and deploy.** Create a dedicated Supabase secret key and set `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production, Preview, encrypted) and in GitHub Actions secrets, then pass it in `ci.yml` and `main.yml` env. Without it, uploads return 503 and the photo e2e cases skip.
- **Storage copy API.** Cross-bucket `object/copy` depends on the Storage version. The fallback is download and upload. Both paths are covered by `client.test.ts`.
- **Orphan files.** If Storage removal fails after a DB commit, the files stay. That is logged, and acceptable for now; a cleanup job can come later (no spec).
- **Signed URL churn.** Each list fetch signs new URLs, so the browser cache misses after an hour or a refetch. That is acceptable for now; offline caching of own images is spec 17.
- **Body size.** The browser compression keeps uploads around 0.3–1 MB, well under Vercel's 4.5 MB. A client that skips compression gets 413 above 5 MB, or the platform error above 4.5 MB; the form handles both as "Upload failed." with Retry.
- **HEIC.** iOS converts HEIC to JPEG for file inputs; other HEIC sources get `IMAGE_INVALID`.
- **`new` vs `[id]`.** The static segment should win; step 12 verifies it.
- **Partial save.** If the exercise saves but a frame upload fails, the exercise exists without that frame. The form stays open with the slot error and Retry; leaving keeps what was saved.
- **Later specs:**
  - the "used in" lists and removal from workouts (09) and history (10);
  - offline create and edit (17);
  - sharing own exercises (19).

No open question blocks implementation.

## 11. Implementation notes
- **Write service file.** The write logic lives in `src/server/exercises/write-service.ts` instead of growing `service.ts`.
- **Executor parameter.** Every write function and `getExercise` take an optional `db: Executor`. That lets `write.test.ts` run in `withRollback`; nested transactions become savepoints.
- **Zod partial bug.** `.partial()` in zod 4 keeps `.default()` values, so a `PATCH { name }` reset description, steps and sides (caught by `write.test.ts`).
  - The schema now has a default-free `exerciseFieldShape`. `exerciseFieldsSchema` (form and create) adds the defaults, and `updateExerciseInputSchema` is built from the bare shape.
  - A regression test is in `src/shared/schemas/__tests__/exercise.test.ts`.
- **Blank list items.** They are dropped by the schema (`textList`), not reported as errors. So the form needs no "empty step" copy, and error indexes are mapped back to the original rows.
- **Frame URLs.** `media.ts` exports `resolveFrames` (public URLs for system rows, one batched sign call for own rows) instead of `toFrames` / `firstFrame`. List items take the thumbnail and image from the first resolved frame.
- **Shared helper.** `scrollToFirstError` moved to `src/lib/scroll-to-first-error.ts`, because a second feature uses it. `features/profile/index.ts` re-exports it, so onboarding is unchanged.
- **New component.** `OnlineLinkButton`: a link styled as a button that becomes a disabled button with "Needs internet" offline. It is used for Create, Edit and Duplicate. Delete is disabled offline without its own hint; the hint shows once, next to Edit.
- **`MuscleChips` props.** It gained `label`, `before` (the Mine chip) and `wrap` (form use), and exports `chipClass`.
- **Copy.**
  - The exercise Name field uses `t('Name', { context: 'exercise' })` (`Name_exercise`), because `Name` is already "Ім'я" for the profile.
  - `Mine` (chip) and `Mine_badge` differ in Ukrainian.
- **Frame alt text.** A single frame uses the exercise name; two frames use Start/End position; three or four use "frame n of N".
- **Race fix in photo slots.** `PhotoSlots` updates slots through functional updaters keyed by slot key. Two quick picks used to overwrite each other, because the async scaling closed over stale state (caught by e2e on mobile).
- **Duplicates.** Source frames are capped at `FRAME_LIMIT` when copied.
- **Edit not-found.** The edit page reuses `[id]/not-found.tsx`; system and foreign ids are not found there.
- **CI.** `ci.yml` and `main.yml` pass `SUPABASE_SERVICE_ROLE_KEY` from GitHub secrets. The two photo e2e cases skip with a message when the key is missing.
- **Dependency.** `sharp` is pinned at `0.35.5` in dependencies.
- **Lead action.** Add `SUPABASE_SERVICE_ROLE_KEY` (a dedicated secret key) to the GitHub Actions secrets and to Vercel (Production and Preview).
- **Checks:**
  - lint, typecheck, format:check, i18n:check: pass.
  - `pnpm test`: 56 files, 343 tests passed.
  - `pnpm build`: pass; `/library/exercises/new` and `/[id]/edit` are separate routes.
  - e2e on the lead's dev server: `04`, `05`, `06`, `07` — 69 passed, 5 skipped (viewport-specific in 05); `07` alone: 10 passed.

## 12. Review — 2026-11-11

**Verdict:** Pass with notes.

- Every AC works at 390px and 1440px in `en` and `uk` against real Storage.
- No blockers. Five minor findings.
- The UI walk ran on the lead's running dev server, which was left running.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `write.test.ts` (create → listed under `mine` with `isOwn`); `e2e/07` "creates an exercise with photos…". Walk: the own exercise sits in the Chest section after the system ones (position 22 of 23, as decided), with the "Mine" badge; the Mine chip comes first (`AC1-*-catalog-mine.png`, `AC1-*-catalog-create-button.png`) |
| AC2 | Pass | `write-route.test.ts` "hides a foreign exercise behind 404 on every endpoint"; `write.test.ts` (foreign PUT/PATCH → 404, `mine` list empty for a stranger) |
| AC3 | Pass | `write.test.ts` "changes only the given fields" (the full object stays equal except the name); system → `EXERCISE_READ_ONLY` (service and route); `ExerciseDetails.test.tsx` (system shows only Duplicate). Walk: `AC3-*-system-details.png` |
| AC4 | Pass | `prepareImage.test.tsx` (type, 5 MB, 1600px JPEG); `images.test.ts`; `write-route.test.ts` (413, 400). Walk: a text file shows "Use a JPEG, PNG or WebP image." (`AC4-*-type-error.png`); after save, 3 of 3 signed images loaded (`naturalWidth > 0`) at both widths |
| AC5 | Pass | `write.test.ts` (4 frames, 5th → 422, reorder, bad permutation → 400, delete frame); `ExerciseDetails.test.tsx` and `ExerciseListItem.test.tsx` (3-frame cycle). Walk: 3 frames, the details alt goes "frame 1 of 3" → "frame 2 of 3" after 1.1s (`AC5-*-form-three-frames.png`, `AC1-*-details-own.png`); `e2e/07` keeps the reorder after reload |
| AC6 | Pass | `write.test.ts` (soft delete, hidden, `removeObjects` with the keys); `e2e/07`. Walk: confirm dialog (`AC6-*-delete-dialog.png`), then `GET` → 404 |
| AC7 | Pass | `write.test.ts` (copies into the user prefix, source unchanged, own or unknown source → 404); `e2e/07` "duplicates a system exercise as my own" (2 frames copied). Walk: prefilled form with both photos (`AC7-*-duplicate-form.png`) |
| AC8 | Pass | `write.test.ts` (case and diacritics, system name ok, deleted name ok, rename conflict); `ExerciseForm.test.tsx`. Walk: "CABLE hug" → the error under Name (`AC8-*-name-taken.png`) |
| AC9 | Pass | `write.test.ts` "stops at 300 own exercises"; `ExerciseForm.test.tsx` (the limit message above Save) |
| AC10 | Pass | `write.test.ts` (the same create twice → 1 row; frame replay in place); `write-route.test.ts` (PUT twice → 200, equal bodies) |
| AC11 | Pass | `ExerciseCatalog.test.tsx`, `ExerciseDetails.test.tsx`, `ExerciseForm.test.tsx`; `e2e/07` "disables changes offline". Walk: `AC11-*-details-offline.png` (Edit disabled with "Needs internet"; Delete is disabled too, but the screenshot caught its 150ms opacity transition) |
| AC12 | Pass | `write.test.ts` (uk text with the en locale); `e2e/07` "keeps the text it was written in…". Walk: the Ukrainian form at both widths with overflow 0 (`AC12-*-uk-form.png`) |
| AC13 | Pass with note | `ExerciseForm.test.tsx` (required errors, discard dialog, `beforeunload`); `e2e/07` (discard, layout). Walk: overflow 0 at both widths, errors under the fields (`AC13-*-form-errors.png`), discard dialog (`AC13-*-discard-dialog.png`). Errors stay stale after the field is fixed (finding 1) |

Screenshots: `scratch/review/07-custom-exercises/` (git-ignored).

### Findings

1. [minor] Field errors are not cleared when the user fixes the field; they go away only on the next Save — `src/features/exercises/ExerciseForm/ExerciseForm.tsx:193`, `:447`.
   - The form validates manually with `safeParse` on submit. Without a resolver, `shouldValidate` does nothing.
   - In `AC5-desktop-form-three-frames.png`, "Pick at least one piece of equipment." still shows after Cable was checked.
   - Fix: clear the field's error in `toggle`, the equipment `onChange` and on input change (or re-run the schema for that field once submitted).
2. [minor] On mobile the four photo buttons (Replace, Up, Down, Remove, 48px each) do not fit under a 170px tile, so Remove wraps to a second row — `src/features/exercises/ExerciseForm/PhotoSlots.tsx:191`. It looks untidy (`AC5-mobile-form-three-frames.png`). Use `size-10` icon buttons with `gap-0`, or a single "…" menu.
3. [minor] A duplicate form counts as dirty before any edit, so Cancel on an untouched duplicate asks "Discard changes?" — `src/features/exercises/ExerciseForm/ExerciseForm.tsx:140`. Arguably nothing would be lost; it is the lead's call.
4. [minor] "Duplicate as my own" fails with 503 `STORAGE_UNAVAILABLE` where the server has no Storage key, even though the text could be copied — `src/server/exercises/write-service.ts:174`. In production the key will be set; it matters on previews or envs without it. Option: copy without photos when Storage is not configured.
5. [minor, a11y] The "Mine" chip is rendered inside the group labelled "Muscles", so screen readers announce it as a muscle — `src/features/exercises/ExerciseCatalog/ExerciseCatalog.tsx:208`. Wrap it in its own element outside the group, or label the group "Filters".

Code checks:

- **Scoping.**
  - Every write locks the row and checks `owner_id` (system → 403, foreign or deleted → 404).
  - Lists and search filter `owner_id is null or = $userId`.
  - The name and limit checks run under a per-user advisory lock.
  - Storage keys are prefixed with the user id.
  - The private bucket is served only through 1-hour signed URLs in `no-store` responses.
- **Idempotency.** Create and frame upload are `PUT` with client ids, matching `request-safety.md`; replays are tested.
- **Secrets.** The service key is read only in `src/server/storage/client.ts` (`server-only`). The diff has no secrets, `.env*` files or build output.
- **Structure.** Handlers call one service function. The frame route reads multipart and checks the size before buffering. Zod schemas are shared with the form.
- **Deviations.** All are listed in Implementation notes, including two real bugs fixed with tests: the zod `.partial()` defaults and the photo-pick race.

### Checks

- lint: pass.
- typecheck: pass.
- tests: the spec's suites passed (15 files, 111 tests); the full `pnpm test` from implement: 56 files, 343 tests passed.
- e2e on the lead's dev server: `07` — 10 passed; `04`–`07` together — 69 passed, 5 skipped. Not run against `pnpm start`.

### Out of scope

- **Lead action.** Set `SUPABASE_SERVICE_ROLE_KEY` (a dedicated secret key) in GitHub Actions secrets and Vercel (Production and Preview). Without it the photo e2e cases skip in CI, and uploads and duplicates return 503.
- **Orphan cleanup.** Storage files can be orphaned if a cleanup fails after a commit; a periodic cleanup could come later.
- **Later specs.** The "used in" lists and removal from workouts and history (09, 10); offline editing (17).

## 13. Form polish after review — 2026-11-11

The lead walked the form and asked for changes (`DECISIONS.md`, "Exercise form polish").

- **Selects.** New `src/components/Select` is a native select with `appearance-none` and an inset `ChevronDown`; the chevron no longer sits on the rounded edge.
- **Type label.** The mechanic label uses `t('Type', { context: 'mechanic' })` (`Type_mechanic` = «Тип»). The shared `Type` key is "Типографіка" on the dev UI page, which leaked into the form and the spec 06 details page.
- **Drag to reorder.** New `src/features/exercises/hooks/useDragReorder.ts`, with no dependency:
  - a six-dot handle with a 200ms hold, then the item under the pointer swaps live;
  - it works for the steps list and the 2-column photo grid;
  - arrow keys on the focused handle move the item;
  - `touch-action: none` sits on the handle only.
  - Up and down buttons are gone, which also fixes review finding 2 (the photo buttons wrapping on mobile).
- **Common mistakes.** One textarea, one mistake per line, with the hint «Кожна помилка з нового рядка.». It still saves as a list (blank lines dropped, up to 5, error "Up to 5 mistakes, one per line."). The API and the data are unchanged.
- **Photo slots.**
  - "Add frame" inserts before the last slot.
  - Labels follow the position: first = Start position, last = End position, between = "Frame n".
  - The drag handle sits on the photo; Replace and Remove stay under it.
- **Dialogs.** New `src/components/ConfirmDialog`: `sm:max-w-md`, buttons stacked on mobile or in two equal columns, wrapping long Ukrainian labels. It is used by Discard and Delete.
- **Checks.**
  - lint, typecheck, i18n:check: pass.
  - `src/features/exercises` tests: 41 passed, with new ones for mistakes per line, frame insertion and keyboard step reorder.
  - e2e `06` + `07`: 30 passed. The e2e reorder now uses the handle with ArrowRight.
  - Screenshots: `Polish-*.png`.
- **Still open from the review.** Findings 1 (stale field errors), 3 (duplicate counts as dirty), 4 (duplicate without a Storage key) and 5 (the Mine chip inside the Muscles group).

## 14. Review findings fixed — 2026-11-11

- **Finding 1 (stale errors).** `ExerciseForm` subscribes to value changes (`form.subscribe`) and clears that field's error; the rest wait for Save. Test: "clears a field error as soon as the field is edited".
- **Finding 3 (duplicate counted as dirty).** Lead's choice: do not ask when nothing changed. `dirty` is now `isDirty || slotsDirty`. Test: "leaves an untouched duplicate without asking".
- **Finding 4 (duplicate without Storage).** `createOwnExercise` copies the text and skips the frames when Storage is not configured. Test in `write.test.ts`.
- **Finding 5 (Mine chip a11y).** `MuscleChips` renders `before` chips outside its `role="group"` (an inner `display: contents` group keeps the layout). Test in `ExerciseCatalog.test.tsx`.
- **Photo slots, lead's request.**
  - Slots stack in one column, each at full column width and 4:3.
  - The drag handle is top-left on the photo; a "…" menu top-right ("Photo actions") holds Replace photo and Remove photo.
  - New copy: «Дії з фото».
- **Checks.**
  - lint, typecheck, i18n:check: pass.
  - exercises feature and server tests: 68 passed.
  - e2e `06` + `07`: 30 passed.
  - Screenshots: `Photos2-*.png`.
