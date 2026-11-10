# 06-exercise-catalog — technical plan

Spec: `docs/specs/06-exercise-catalog.md`

## 1. Summary

Build the system exercise catalog end to end:

- two tables (`exercise`, `exercise_translation`) with a migration;
- a repeatable seed of about 200 strength exercises from free-exercise-db, with English and Ukrainian text written by the agent;
- a separate media script that converts the dataset photos to WebP and uploads them to Supabase Storage;
- two read endpoints;
- the `/library/exercises` catalog: search, multi-select muscle chips and equipment filter, grouped or relevance-ordered infinite list;
- the `/library/exercises/[id]` details page with alternating start/end frames.

Also in scope: `/today` and `/profile` stop throwing `PROFILE_NOT_FOUND` while the `(app)` gate redirects a user without a profile.

Lead decisions this plan relies on (all in `DECISIONS.md`, 2026-11-10):

- dataset, content in two languages, muscle taxonomy, filters, order, frames;
- media pipeline, Storage env, search normalization in code, seed in CI;
- profile-not-found log noise.

## 2. Acceptance criteria

- **AC1:** Running the seed twice leaves the same number of `exercise` and `exercise_translation` rows. Every seeded exercise has:
  - at least one primary muscle, a movement pattern, at least one equipment value, a tracking type, a popularity (1–100), and two frames in `media`;
  - an `en` and a `uk` translation, each with a name, a description, at least one instruction step and at least one common mistake.
- **AC2:** Search matches:
  - `q=bench` returns Bench Press as the first item;
  - a query equal to one of an exercise's aliases (either language) returns that exercise;
  - `q=жим` with locale `en` returns Bench Press;
  - upper case and diacritics in the query or the data do not change the result.
- **AC3:** Filters combine as follows:
  - `muscle=chest&muscle=triceps` returns exercises whose `primaryMuscles` contain chest or triceps;
  - an exercise that has triceps only in `secondaryMuscles` is not returned;
  - `equipment` works the same way (any match);
  - muscles, equipment and `q` combine with AND;
  - in the UI, "Clear filters" removes `q`, all muscles and all equipment and the full list returns.
- **AC4:** `listExercises` runs exactly one SQL query for any `limit` (asserted with a counting Drizzle logger at limit 2 and limit 50).
- **AC5:** Order of the list:
  - without `q`, items are grouped by section muscle in `MUSCLE_GROUPS` order. Each exercise appears once, in the section of its first primary muscle, or of its first primary muscle that is among the selected muscles. Inside a section the order is popularity descending, then name, then id. Every item carries `section`;
  - with `q`, `section` is `null` and items are ordered by rank: name starts with the query (0), name contains it (1), alias matches (2). Ties by popularity descending, then name;
  - the UI renders a section heading before the first item of each section and none in search mode.
- **AC6:** Paging and infinite scroll:
  - the client requests pages of 30;
  - when the sentinel under the list becomes visible, the next page loads, until `nextCursor` is `null`;
  - a "Show more" button under the list does the same and disappears when there are no more pages.
- **AC7:** Search and filters are in the URL as `?q=…&muscle=…&muscle=…&equipment=…`:
  - reloading such a URL restores the input, chips, equipment selection and list;
  - browser Back from a details page returns to the same URL;
  - the details back link goes to the last catalog URL.
- **AC8:** The details page shows:
  - the frames alternating every 1000ms;
  - with `prefers-reduced-motion: reduce`, the start frame stays and pressing the frame button switches start and end;
  - name, description, numbered steps, common mistakes, primary and secondary muscles, equipment, movement, type (mechanic), sides (laterality), tracking, level;
  - a missing or failing image shows a placeholder tile with the exercise name, in the list and in details.
- **AC9:** With the `lang` cookie `uk`, all catalog text from the API (names, descriptions, steps, mistakes) and all labels are Ukrainian; with `en`, English.
- **AC10:** Unknown and foreign ids:
  - `GET /api/v1/exercises/{id}` with an unknown uuid, or with another user's own exercise, returns 404 `EXERCISE_NOT_FOUND`;
  - `/library/exercises/<that id>` and `/library/exercises/not-a-uuid` show the not-found state with a link back.
- **AC11:** Layout:
  - at 390px the list items are at least 56px tall;
  - at 1440px the filters sit in a left side column and the items in a grid;
  - no horizontal page scroll at either width, in `en` and `uk`.
- **AC12:** States of the catalog:
  - skeleton while the first page loads;
  - on a server error, the message "Couldn't load exercises." with Retry, and Retry refetches;
  - on zero results with any filter active, "No exercises found" with Clear filters;
  - offline: a list already on screen stays when filters change, and a request that cannot be made shows `OfflineNotice` with the offline copy.
- **AC13:** `src/server/db/seed/README.md` records the free-exercise-db license, the pinned commit, and where its images come from.
- **AC14:** A signed-in user without a profile who opens `/today` or `/profile` ends on `/onboarding`. `findProfile()` returns `null` for them, and neither page calls a function that throws `PROFILE_NOT_FOUND`.

## 3. Data

Migration: `pnpm db:generate` creates `src/server/db/migrations/0002_*.sql`. Review it by hand: two new tables only, no drift.

### Constants — `src/constants/exercise.ts`

This file has no value imports, so the seed and media scripts can run it with plain Node. Type-only imports are fine. The spec and `DATA_MODEL.md` say `src/shared/constants`; the code and `docs/development/frontend/typescript.md` use `src/constants/`, and this plan follows the code.

```ts
export const MUSCLE_GROUP = { CHEST: 'chest', SHOULDERS: 'shoulders', TRICEPS: 'triceps', BICEPS: 'biceps',
  FOREARMS: 'forearms', LATS: 'lats', MIDDLE_BACK: 'middle_back', TRAPS: 'traps', LOWER_BACK: 'lower_back',
  ABDOMINALS: 'abdominals', GLUTES: 'glutes', QUADRICEPS: 'quadriceps', HAMSTRINGS: 'hamstrings',
  ADDUCTORS: 'adductors', ABDUCTORS: 'abductors', CALVES: 'calves', NECK: 'neck' } as const;
export const MUSCLE_GROUPS = Object.values(MUSCLE_GROUP); // display and section order
export const EQUIPMENT = { BARBELL: 'barbell', EZ_BAR: 'ez_bar', DUMBBELL: 'dumbbell', KETTLEBELL: 'kettlebell',
  CABLE: 'cable', MACHINE: 'machine', BODYWEIGHT: 'bodyweight', BAND: 'band', OTHER: 'other' } as const;
export const MOVEMENT_PATTERN = { HORIZONTAL_PUSH: 'horizontal_push', VERTICAL_PUSH: 'vertical_push',
  HORIZONTAL_PULL: 'horizontal_pull', VERTICAL_PULL: 'vertical_pull', SQUAT: 'squat', HINGE: 'hinge',
  LUNGE: 'lunge', CARRY: 'carry', CORE: 'core', ISOLATION: 'isolation' } as const;
export const MECHANIC = { COMPOUND: 'compound', ISOLATION: 'isolation' } as const;
export const LATERALITY = { BILATERAL: 'bilateral', UNILATERAL: 'unilateral' } as const;
export const TRACKING_TYPE = { WEIGHT_REPS: 'weight_reps', REPS: 'reps', TIME: 'time', DISTANCE: 'distance' } as const;
export const DIFFICULTY = { min: 1, max: 3 } as const;
export const POPULARITY = { min: 1, max: 100 } as const;
export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_SEARCH_MAX = 60;
export const EXERCISE_PAGE_SIZE = 30;      // what the client requests
export const LIST_LIMIT = { default: 50, max: 200 } as const; // docs/tech/API.md convention
export const EXERCISE_MEDIA_BUCKET = 'exercise-media';
```

Plus the `ValueOf` types `MuscleGroup`, `Equipment`, `MovementPattern`, `Mechanic`, `Laterality`, `TrackingType`.

### Schema — `src/server/db/schema/exercise.ts` (re-export from `schema/index.ts`)

`exercise`:

| Column | Drizzle | Constraint |
| --- | --- | --- |
| `id` | `uuid().primaryKey().defaultRandom()` | |
| `owner_id` | `uuid` null → `user.id`, `onDelete: 'cascade'` | index `exercise_owner_id_idx` |
| `slug` | `text` null | partial unique index `exercise_system_slug_uq` on `slug` where `owner_id is null` |
| `primary_muscles` | `text[]` not null | `cardinality >= 1`, subset of `MUSCLE_GROUPS` |
| `secondary_muscles` | `text[]` not null default `{}` | subset of `MUSCLE_GROUPS` |
| `movement_pattern` | `text` null | in `MOVEMENT_PATTERN` |
| `equipment` | `text[]` not null | `cardinality >= 1`, subset of `EQUIPMENT` |
| `mechanic` | `text` null | in `MECHANIC` |
| `laterality` | `text` null | in `LATERALITY` |
| `tracking_type` | `text` not null | in `TRACKING_TYPE` |
| `difficulty` | `smallint` null | between 1 and 3 |
| `popularity` | `smallint` null | between 1 and 100 |
| `media` | `jsonb.$type<ExerciseMedia>()` not null default `{"frames":[]}` | |
| `source_exercise_id` | `uuid` null → `exercise.id`, `onDelete: 'set null'` | |
| `created_at`, `updated_at` | timestamptz not null default now | |
| `deleted_at` | timestamptz null | |

The nullable pattern, mechanic, laterality and difficulty columns leave room for custom exercises (07). The seed schema requires them for system rows.

`exercise_translation`:

| Column | Drizzle | Constraint |
| --- | --- | --- |
| `exercise_id` | `uuid` not null → `exercise.id`, `onDelete: 'cascade'` | PK `(exercise_id, locale)` |
| `locale` | `text` not null | in `LOCALES` (`src/i18n/config.ts`) |
| `name` | `text` not null | length 1–80 |
| `aliases` | `text[]` not null default `{}` | |
| `description` | `text` not null default `''` | |
| `instructions` | `text[]` not null default `{}` | |
| `common_mistakes` | `text[]` not null default `{}` | |
| `search_name` | `text` not null | `normalizeSearch(name)` |
| `search_aliases` | `text` not null default `''` | `aliases.map(normalizeSearch).join('\n')` |
| `created_at`, `updated_at` | timestamptz | |

Add `subsetOf(column, values)` to `src/server/db/schema/utils.ts`. It builds `column <@ array['a','b']::text[]` with the same literal-inlining reason as `inList`.

`ExerciseMedia` (in `src/shared/schemas/exercise.ts`, also used by the seed):

```ts
{ frames: { thumb: string; full: string }[] }  // Storage keys, e.g. system/barbell-bench-press/0-thumb.webp
```

### Search normalization — `src/lib/search.ts` (no imports)

```ts
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
```

The query and the stored columns go through the same function. Ukrainian `й`→`и` and `ї`→`і` collapse on both sides, so matching stays consistent.

### Zod — `src/shared/schemas/exercise.ts`

- Add `repeatable(itemSchema, max)` to `src/shared/schemas/utils.ts`. It accepts `string | string[]`, wraps a string into an array, and validates each item, at most `max` items.
- `listExercisesQuerySchema` (`.strict()`):
  - `q`: `z.string().trim().max(EXERCISE_SEARCH_MAX).optional()`;
  - `muscle`: `repeatable(enumOf(MUSCLE_GROUP), 17)`, default `[]`;
  - `equipment`: `repeatable(enumOf(EQUIPMENT), 9)`, default `[]`;
  - `pattern`: `enumOf(MOVEMENT_PATTERN).optional()`;
  - `cursor`: `z.string().max(200).optional()`;
  - `limit`: `z.coerce.number().int().min(1).max(200).default(50)`.
- `exerciseIdParamsSchema`: `{ id: z.uuid() }`.
- `exerciseListItemSchema`: `{ id, name, primaryMuscles, equipment, thumbnailUrl: string | null, imageUrl: string | null, section: MuscleGroup | null, isOwn: boolean }`.
- `exerciseListResponseSchema`: `{ items: ExerciseListItem[], nextCursor: string | null }`.
- `exerciseSchema` (details): `{ id, name, aliases, description, instructions, commonMistakes, primaryMuscles, secondaryMuscles, equipment, movementPattern | null, mechanic | null, laterality | null, trackingType, difficulty: 1|2|3 | null, frames: { thumbUrl, fullUrl }[], isOwn }`.
- Inferred types: `ListExercisesQuery`, `ExerciseListItem`, `ExerciseListResponse`, `Exercise`, `ExerciseMedia`.

### Seed data — `src/server/db/seed/exercises.json`

An array of entries. `src/server/db/seed/seed-schema.ts` validates it with Zod; that file imports only `zod` and relative `.ts` paths.

```json
{ "slug": "barbell-bench-press", "sourceId": "Barbell_Bench_Press_-_Medium_Grip",
  "primaryMuscles": ["chest"], "secondaryMuscles": ["shoulders", "triceps"],
  "movementPattern": "horizontal_push", "equipment": ["barbell"], "mechanic": "compound",
  "laterality": "bilateral", "trackingType": "weight_reps", "difficulty": 2, "popularity": 100,
  "translations": {
    "en": { "name": "Bench Press", "aliases": ["Flat bench press"], "description": "…",
            "instructions": ["…"], "commonMistakes": ["…"] },
    "uk": { "name": "Жим штанги лежачи", "aliases": ["Жим лежачи"], "description": "…",
            "instructions": ["…"], "commonMistakes": ["…"] } } }
```

Schema rules:

- `slug`: kebab-case, unique.
- `sourceId`: the free-exercise-db folder name.
- Both locales are required.
- `name` 1–80 characters; `description` 1–400.
- `instructions` 1–8 items; `commonMistakes` 1–5; `aliases` 0–5.
- `popularity`, `difficulty`, `movementPattern`, `mechanic` and `laterality` are required.
- No duplicate slugs and no duplicate `en` names.

Mapping from free-exercise-db (pin one commit SHA, recorded in the README):

| Dataset | Ours |
| --- | --- |
| `category` `strength`, `powerlifting` | included; everything else excluded (stretching, plyometrics, olympic weightlifting, strongman, cardio) |
| `equipment` `barbell`, `dumbbell`, `cable`, `machine`, `kettlebells`, `bands`, `e-z curl bar`, `body only` | `barbell`, `dumbbell`, `cable`, `machine`, `kettlebell`, `band`, `ez_bar`, `bodyweight` |
| `equipment` `medicine ball`, `exercise ball`, `other` | `other` |
| `equipment` `foam roll`, `null` | excluded |
| `lower back`, `middle back` | `lower_back`, `middle_back`; other muscles keep their names |
| `level` `beginner` / `intermediate` / `expert` | `difficulty` 1 / 2 / 3 |
| `mechanic` | kept; the agent decides when it is null |
| `instructions` | rewritten as 3–6 short steps |

The agent writes `description` (1–2 sentences), `commonMistakes` (2–4), `aliases`, `movementPattern`, `laterality`, `popularity` and the full `uk` text. Pick about 200 exercises: the common gym staples first, no near-duplicates (one grip variant unless it is a distinct staple).

## 4. API

Both endpoints are `GET`, `auth: 'required'`, and respond with `Cache-Control: private, no-store` (the default of `json()`). They do not write, so `request-safety.md` does not apply.

### `GET /api/v1/exercises` — `src/app/api/v1/exercises/route.ts`

- Query: `listExercisesQuerySchema`. Repeated keys arrive as arrays (handler change below).
- Locale: `requestLocale(request)`, which reads the `lang` cookie, then `Accept-Language`, through `resolveLocale`.
- Response 200: `ExerciseListResponse`.
- `nextCursor` is an opaque base64url string of `{"o": <offset>}`. It is `null` when fewer than `limit + 1` rows came back.
- Errors:
  - 400 `VALIDATION_FAILED`: a bad enum, `limit` out of range, or a malformed cursor. The service throws this as a `DomainError` with `details: [{ path: ['cursor'] }]`.
  - 401 `UNAUTHORIZED`.

```json
{ "items": [ { "id": "…", "name": "Bench Press", "primaryMuscles": ["chest"], "equipment": ["barbell"],
  "thumbnailUrl": "https://<ref>.supabase.co/storage/v1/object/public/exercise-media/system/barbell-bench-press/0-thumb.webp",
  "section": "chest", "isOwn": false } ], "nextCursor": "eyJvIjozMH0" }
```

### `GET /api/v1/exercises/{id}` — `src/app/api/v1/exercises/[id]/route.ts`

- Params: `exerciseIdParamsSchema`. A non-uuid id gives 400 `VALIDATION_FAILED`.
- Response 200: `Exercise` in the request locale.
- 404 `EXERCISE_NOT_FOUND`: unknown id, a soft-deleted row, or another user's row.

### Handler change — `src/server/http/handler.ts`

Replace `Object.fromEntries(searchParams)` with a reader that turns a repeated key into a string array and keeps single keys as strings. Existing schemas only read single keys, so their behaviour does not change.

### Error table — `src/server/http/errors.ts`

Add `EXERCISE_NOT_FOUND: 404`.

`docs/tech/API.md` needs no row changes; the 06 rows already match.

## 5. Server

### `src/server/http/locale.ts`

`requestLocale(request: Request): Locale` parses the `cookie` header for `lang` (`LOCALE_COOKIE`) and passes `accept-language` to `resolveLocale`.

### `src/server/exercises/`

**`errors.ts`:** `EXERCISE_ERROR = { NOT_FOUND: 'EXERCISE_NOT_FOUND' } as const`.

**`media.ts`:** `publicMediaUrl(key: string): string | null`. It returns `${SUPABASE_URL}/storage/v1/object/public/exercise-media/${key}`, or `null` when `SUPABASE_URL` is unset. It also exports `toFrames(media)` and `thumbnailOf(media)`.

**`queries.ts`** (`import 'server-only'`). Every function takes `db: Executor` (the same `Db | Tx` type as in profile), so tests can pass a rolled-back transaction.

`listExerciseRows(db, { userId, locale, q, muscles, equipment, pattern, offset, limit })` is one `db.execute(sql…)`:

```sql
select e.id, e.primary_muscles, e.equipment, e.media, e.owner_id, e.popularity,
       coalesce(tr.name, tf.name) as name, <section> as section, <rank> as rank
from exercise e
left join exercise_translation tr on tr.exercise_id = e.id and tr.locale = $locale
left join exercise_translation tf on tf.exercise_id = e.id and tf.locale <> $locale
where (e.owner_id is null or e.owner_id = $userId) and e.deleted_at is null
  and (cardinality($muscles::text[]) = 0 or e.primary_muscles && $muscles::text[])
  and (cardinality($equipment::text[]) = 0 or e.equipment && $equipment::text[])
  and ($pattern::text is null or e.movement_pattern = $pattern)
  and ($q::text is null or exists (select 1 from exercise_translation s where s.exercise_id = e.id
       and (s.search_name like $contains escape '\' or s.search_aliases like $contains escape '\')))
order by <see below>
limit $limit + 1 offset $offset
```

- `tf` is the other locale. With two locales there is at most one such row, so there is no fan-out. Custom rows (07) have a single translation in either locale.
- `$q` is `normalizeSearch(q)`, or null when the result is empty. `$prefix` is `escapeLike($q) || '%'` and `$contains` is `'%' || escapeLike($q) || '%'`. `escapeLike` escapes `\`, `%` and `_`.
- Section, used only when `$q` is null:

  ```sql
  (select m from unnest(e.primary_muscles) with ordinality as u(m, i)
   where cardinality($muscles::text[]) = 0 or m = any($muscles::text[]) order by i limit 1)
  ```

- Rank, used only when `$q` is set:

  ```sql
  (select min(case when s.search_name like $prefix escape '\' then 0
                   when s.search_name like $contains escape '\' then 1 else 2 end)
   from exercise_translation s where s.exercise_id = e.id)
  ```

- Order without `q`: `array_position($MUSCLE_GROUPS::text[], section), e.popularity desc nulls last, name, e.id`.
- Order with `q`: `rank, e.popularity desc nulls last, name, e.id`.

Pass arrays as parameters, not interpolated strings. The query must not change with `limit`, so the query count stays at one.

`findExerciseRow(db, { userId, locale, id })` is one query with the same two joins and the same ownership and `deleted_at` filter. It selects every column plus the translation fields with the same coalesce rule and returns `undefined` when there is no row.

**`service.ts`** (`import 'server-only'`):

- `listExercises(userId, locale, query, db = getDb())`:
  - decodes the cursor (bad cursor → `DomainError('VALIDATION_FAILED')`);
  - calls `listExerciseRows` with `limit = query.limit`;
  - maps rows to `ExerciseListItem` (`thumbnailUrl` from `media.frames[0].thumb`, `isOwn = owner_id === userId`, `section` null in search mode);
  - builds `nextCursor`.
- `findExercise(userId, locale, id, db = getDb())`: returns `Exercise | null` (frames mapped through `publicMediaUrl`).
- `getExercise(...)`: calls `findExercise` and throws `EXERCISE_NOT_FOUND` on `null`. The API uses this one.
- Enum values read from rows are narrowed with type guards, as `toProfile` does. The check constraints guarantee them.

**`request-exercise.ts`:** `getRequestExercise = cache(findExercise)`, so the details page and its `generateMetadata` share one lookup.

Ownership: every query filters `owner_id is null or owner_id = $userId`. A foreign row looks the same as a missing one.

### Profile fix — `src/server/profile/service.ts`

- Add `findProfile(userId): Promise<Profile | null>`. `getProfile` becomes `findProfile` plus a throw on `null`. The API keeps using `getProfile`.
- `src/app/[lang]/(app)/today/page.tsx` and `profile/page.tsx` call `findProfile` and `redirect('/onboarding')` on `null`.
- Update the existing comment in both pages to say why: the page renders in parallel with the gate, so it must not throw for a user the gate is redirecting.

### Seed — `src/server/db/seed/`

These files run under plain Node (`node <file>.ts`): only package imports and relative `.ts` imports, type-only `@/` imports allowed, no `server-only`.

- **`catalog.ts`:** `seedCatalog(sql: postgres.Sql | postgres.TransactionSql, entries: SeedExercise[]): Promise<{ exercises: number; translations: number }>`. For each entry:
  - insert into `exercise` with `on conflict (slug) where owner_id is null do update set` every metadata column, `media` and `updated_at = now()`, `returning id`;
  - upsert both translations `on conflict (exercise_id, locale) do update`, with `search_name` and `search_aliases` from `normalizeSearch`;
  - `media.frames` is always `[0, 1]` mapped to `system/<slug>/<n>-thumb.webp` and `system/<slug>/<n>-full.webp`, whether or not the files are uploaded yet;
  - an exercise removed from the JSON stays in the database (see Risks).
- **`index.ts`** (the `pnpm db:seed` CLI):
  - loads `.env.local` when present;
  - opens `postgres(DATABASE_URL, { prepare: false, max: 1 })`;
  - parses `exercises.json` with the seed schema;
  - runs `seedCatalog` inside `sql.begin`;
  - prints the counts and closes the connection.
- **`media.ts`** (the new `pnpm db:seed:media` CLI):
  - needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
  - creates the bucket with `POST /storage/v1/bucket` `{ id, name, public: true }`, treating "already exists" as success;
  - for each entry and frame 0 and 1: if a `HEAD` on the public full URL returns 200 and `--force` is not set, skips it;
  - otherwise downloads `https://raw.githubusercontent.com/yuhonas/free-exercise-db/<SHA>/exercises/<sourceId>/<n>.jpg`;
  - converts with `sharp().resize({ width: 160 | 800, withoutEnlargement: true }).webp({ quality: 75 })`;
  - uploads with `POST /storage/v1/object/exercise-media/<key>` and headers `authorization: Bearer <key>`, `x-upsert: true`, `content-type: image/webp`, `cache-control: max-age=31536000`;
  - runs at most 6 uploads at a time and prints a summary with failures. A missing source image is a warning, not a crash.
- **`README.md`:** source, license (Unlicense), pinned SHA, where the images come from (checked in step 2), mapping rules, how to run both scripts, and that a removed slug needs a soft delete.

### Env

- `src/server/env-schema.ts`: add `SUPABASE_URL: z.url().optional()`.
- `.env.example`: `SUPABASE_URL` and a commented `SUPABASE_SERVICE_ROLE_KEY`, with the note "media script only, never in Vercel".
- The media script reads the service key from `process.env` itself; the app env schema does not have it.

### CI

- `.github/workflows/ci.yml`: add `- run: pnpm db:seed` right after `pnpm db:migrate`.
- `.github/workflows/main.yml`: add the same line right after the deploy job's `pnpm db:migrate`.
- Pass `SUPABASE_URL: ${{ vars.SUPABASE_URL }}` in the env of both workflows (it is not secret), so builds and e2e have image URLs.

## 6. Client

### Routes

Move the Library header and tabs into a route group, so the details page does not show the Library `h1` and tabs:

| From | To |
| --- | --- |
| `src/app/[lang]/(app)/library/layout.tsx` | `src/app/[lang]/(app)/library/(tabs)/layout.tsx` |
| `library/workouts/page.tsx` | `library/(tabs)/workouts/page.tsx` |
| `library/exercises/page.tsx` | `library/(tabs)/exercises/page.tsx` (rewritten) |
| `library/page.tsx` (redirect) | stays |
| — | `library/exercises/[id]/page.tsx`, `library/exercises/[id]/not-found.tsx` |

**`(tabs)/exercises/page.tsx`:**

- `generateMetadata` gives `Exercises · Pampojo` (absolute).
- Renders `<Suspense fallback={<ExerciseCatalogSkeleton />}><ExerciseCatalog /></Suspense>`. Suspense is needed because `useSearchParams` requires it under Cache Components.

**`exercises/[id]/page.tsx`:**

- If `id` is not a uuid (`exerciseIdParamsSchema.shape.id.safeParse`), calls `notFound()`.
- Content sits inside `<Suspense fallback={<ExerciseDetailsSkeleton />}>`. The async child reads `getRequestSession()` (returns null when there is none), `getLocale()` and `getRequestExercise(...)`; on `null` it calls `notFound()`; otherwise it renders `<ExerciseDetails exercise={…} />`.
- `generateMetadata` gives `{{name}} · Pampojo` through `getRequestExercise`, and falls back to `Exercises · Pampojo` when the exercise is missing.

**`not-found.tsx`:** `EmptyState` (icon `Dumbbell`) titled "Exercise not found", with the action `Button asChild` + `Link href="/library/exercises"` "Back to exercises".

### API client — `src/api/exercises.ts`

- `exerciseKeys = { all: ['exercises'], lists: () => [...all, 'list'], list: (filters) => [...lists(), filters] }`.
- `fetchExercises(filters: CatalogFilters, cursor?: string)` builds `URLSearchParams` (`append` per muscle and equipment, `limit=30`) and calls `http(…, { schema: exerciseListResponseSchema })`.
- `useExercisesInfiniteQuery(filters)` is `useInfiniteQuery` with:
  - `queryKey: exerciseKeys.list(filters)`;
  - `initialPageParam: undefined`;
  - `getNextPageParam: (last) => last.nextCursor ?? undefined`;
  - `placeholderData: keepPreviousData`, so the old list stays while new filters load or fail offline;
  - `staleTime: 5 * 60_000`.

`CatalogFilters = { q: string; muscles: MuscleGroup[]; equipment: Equipment[] }`. Keep it in `src/features/exercises/types.ts`; `src/api/exercises.ts` imports it by type. It moves to `src/types/` only if another area needs it.

### Feature — `src/features/exercises/`

| Item | Kind | Notes |
| --- | --- | --- |
| `ExerciseCatalog/` | client entry | Composes everything below; `index.ts` exports it |
| `ExerciseCatalogSkeleton/` | | 6 skeleton rows (mobile) / cards (desktop) |
| `ExerciseDetails/` | client entry | Receives `exercise: Exercise` |
| `ExerciseDetailsSkeleton/` | | |
| `ExerciseFrames/` | | Frames with animation, private to `ExerciseDetails` |
| `ExerciseImage/` | | `src: string \| null`, `name`, `variant: 'thumb' \| 'full'`; renders `next/image` with `unoptimized`, `fill`, `sizes`; on `null` or `onError` shows the placeholder tile (`bg-accent-soft`, centered name, `aria-hidden` image off) |
| `MuscleChips/` | | `selected`, `onToggle`; toggle buttons with `aria-pressed`; `role="group"` labelled "Muscles"; reused by spec 09 later |
| `EquipmentFilter/` | | `selected`, `onChange`, `variant: 'menu' \| 'list'` |
| `ExerciseListItem/` | | Link to `/library/exercises/{id}` |
| `hooks/useCatalogParams.ts` | | URL ⇄ filters |
| `hooks/useExerciseLabels.ts` | | Translated label maps |
| `hooks/usePrefersReducedMotion.ts` | | `useSyncExternalStore` on `matchMedia('(prefers-reduced-motion: reduce)')`; server snapshot `false` |
| `constants.ts` | | `CATALOG_QUERY_STORAGE_KEY = 'pampojo:exercise-catalog-query'`, `SEARCH_DEBOUNCE_MS = 300`, `FRAME_INTERVAL_MS = 1000` |
| `types.ts` | | `CatalogFilters` |

**`useCatalogParams()`:**

- Reads `useSearchParams()`: `q` (trimmed, at most 60), and `muscle` / `equipment` through `getAll`, keeping only known values, de-duplicated, in constant order.
- Returns `{ filters, setQuery, toggleMuscle, setEquipment, clear }`.
- Setters call `router.replace('/library/exercises?…', { scroll: false })`; an empty filter set gives the bare path.
- On every change it writes the current search string to `sessionStorage[CATALOG_QUERY_STORAGE_KEY]` inside `try/catch`.

**`useExerciseLabels()`:** returns `{ muscle, equipment, pattern, mechanic, laterality, tracking, level }` maps built with literal `t()` calls (see Copy). Two pairs share an English word with different Ukrainian:

- "Isolation" is `t('Isolation', { context: 'pattern' })` and `t('Isolation', { context: 'mechanic' })`, keys `Isolation_pattern` / `Isolation_mechanic`;
- "Equipment" is the same in both places, so it needs no context.

Check that `i18next-cli` extracts context keys. If not, use the distinct English strings "Isolation movement" for the pattern and "Isolation" for the mechanic, and note it under Implementation notes.

**`ExerciseCatalog` behaviour:**

- The search input is controlled locally. It is pushed to the URL 300ms after the last keystroke, and the input syncs back when the URL changes (Back, Clear filters).
- `useExercisesInfiniteQuery(filters)`. Items are flattened across pages; a section heading is inserted where `item.section` differs from the previous item. There are no headings when `filters.q` is not empty.
- Infinite scroll uses an `IntersectionObserver` on a sentinel after the list (`rootMargin: '400px'`), calling `fetchNextPage()` when `hasNextPage && !isFetchingNextPage`. A "Show more" button sits under the list while `hasNextPage` and is disabled while fetching.
- States, in order:
  1. no data and pending → skeleton;
  2. no data and error: if `!useIsOnline()` or `error.code === NETWORK_ERROR` → `OfflineNotice` with "You're offline. Connect to the internet to load exercises."; otherwise the error text with a Retry button (`refetch()`);
  3. data with zero items → `EmptyState` (icon `SearchX`) "No exercises found" / "Try another search or clear the filters." with a Clear filters button when any filter is active;
  4. a list.

  With data on screen: if a new request fails offline, keep the list and show `OfflineNotice` above it; if a next page fails, show Retry in place of "Show more".

**Layout:**

- 390px: search input full width (`type="search"`, placeholder "Search exercises", accessible label the same).
- Then the chips row: `flex gap-2 overflow-x-auto` with `-mx-4 px-4`, so it scrolls inside the gutter without page overflow; chips `min-h-11 rounded-full`; selected chips `bg-primary text-primary-foreground`, others `bg-card`.
- Then the Equipment button (`variant='menu'`): `DropdownMenu` with `DropdownMenuCheckboxItem` per equipment; the label is "Equipment" or "Equipment (n)".
- List rows: `min-h-14`; 56px thumbnail (`ExerciseImage` thumb) left; name (semibold, 2 lines max) and secondary text below with the primary muscle labels joined by " · ", then equipment badges (`rounded-full bg-accent-soft px-2 text-sm`).
- Section headings: `h2 text-lg font-extrabold`.
- ≥1024px: `grid lg:grid-cols-[260px_1fr] gap-6`.
  - Left `<aside aria-label="Filters">`: search, chips wrapped (`flex-wrap`, no scroll), and `EquipmentFilter variant='list'`, which is a `fieldset` with legend "Equipment" and a shadcn `Checkbox` with label per item.
  - Right: `grid grid-cols-2 gap-4` of cards. Each card has the image on top (`ExerciseImage` variant `full` at `aspect-[4/3]`, because the 160px thumbnail would blur at card width), name and muscles. The API list item therefore also returns `imageUrl` (first frame, full size) next to `thumbnailUrl`. Section headings are `col-span-full`.
- Mobile and desktop filter variants are both rendered and switched with CSS (`lg:hidden` / `hidden lg:block`), as in spec 05.

**`ExerciseDetails` layout:**

- Back link `← Exercises`. Its href is `/library/exercises` + `sessionStorage[CATALOG_QUERY_STORAGE_KEY]`, read after mount inside `try/catch`; before that it is the bare path.
- `h1` name.
- 390px: one column (frames, description, "How to do it" ordered list, "Common mistakes" list, metadata `dl`).
- ≥1024px: `lg:grid lg:grid-cols-2 lg:gap-8` with frames left (sticky top) and text plus metadata right.
- Metadata `dl` rows:
  - Muscles: Primary (labels) / Secondary (labels; hidden when empty);
  - Equipment;
  - Movement;
  - Type (mechanic);
  - Sides (laterality);
  - Tracking;
  - Level.

  A row whose value is `null` is not rendered.

**`ExerciseFrames`:**

- `frames.length === 0` → placeholder; `1` → static frame.
- Otherwise the state `index`:
  - without reduced motion, `setInterval(() => toggle, 1000)`, cleaned up on unmount;
  - with reduced motion, no interval.
- The frame is a `<button type="button" aria-label={t('Switch position')} aria-pressed={index === 1}>` wrapping `ExerciseImage` (full) with `alt = "{name}, {Start position | End position}"`.
- The button toggles only with reduced motion; otherwise it is a plain `figure` with no button.
- Both full images are preloaded (both rendered, the inactive one `opacity-0`, absolutely stacked), so the switch does not flash.

### shadcn

Add the `checkbox` primitive with the shadcn CLI (`pnpm dlx shadcn@latest add checkbox`). It uses the installed `radix-ui`, so there is no new dependency. Review the generated file against the tokens.

### Mobile and desktop

Checked in e2e at 390×844 and 1440×900: no horizontal scroll, row height, side column.

## 7. Copy

New keys go in `src/i18n/locales/en.json` and `uk.json` exactly as written. Reuse the existing keys "Exercises" (Вправи) and "Back" where they apply.

| Key (en) | uk |
| --- | --- |
| Exercises · Pampojo | Вправи · Pampojo |
| {{name}} · Pampojo | {{name}} · Pampojo |
| Search exercises | Пошук вправ |
| Muscles | М'язи |
| Filters | Фільтри |
| Equipment | Обладнання |
| Equipment ({{count}}) | Обладнання ({{count}}) |
| Show more | Показати ще |
| No exercises found | Вправ не знайдено |
| Try another search or clear the filters. | Спробуй інший запит або скинь фільтри. |
| Clear filters | Скинути фільтри |
| Couldn't load exercises. | Не вдалося завантажити вправи. |
| Retry | Спробувати ще |
| You're offline. Connect to the internet to load exercises. | Ти офлайн. Під'єднайся до інтернету, щоб завантажити вправи. |
| Exercise not found | Вправу не знайдено |
| Back to exercises | Назад до вправ |
| How to do it | Як виконувати |
| Common mistakes | Типові помилки |
| Primary | Основні |
| Secondary | Допоміжні |
| Movement | Рух |
| Type | Тип |
| Sides | Сторони |
| Tracking | Запис |
| Level | Рівень |
| Start position | Початкова позиція |
| End position | Кінцева позиція |
| Switch position | Змінити позицію |
| Chest / Shoulders / Triceps / Biceps / Forearms / Lats / Middle back / Traps / Lower back / Abs / Glutes / Quads / Hamstrings / Adductors / Abductors / Calves / Neck | Груди / Плечі / Трицепс / Біцепс / Передпліччя / Широкі м'язи спини / Середина спини / Трапеції / Поперек / Прес / Сідниці / Квадрицепс / Задня поверхня стегна / Привідні / Відвідні / Ікри / Шия |
| Barbell / EZ bar / Dumbbell / Kettlebell / Cable / Machine / Bodyweight / Band / Other | Штанга / EZ-гриф / Гантелі / Гиря / Блок / Тренажер / Власна вага / Резина / Інше |
| Horizontal push / Vertical push / Horizontal pull / Vertical pull / Squat / Hinge / Lunge / Carry / Core / Isolation (context `pattern`) | Горизонтальний жим / Вертикальний жим / Горизонтальна тяга / Вертикальна тяга / Присід / Нахил / Випад / Перенесення / Кор / Ізоляція |
| Compound / Isolation (context `mechanic`) | Базова / Ізолююча |
| Both sides / One side at a time | Дві сторони / По одній стороні |
| Weight × reps / Reps / Time / Distance | Вага × повтори / Повтори / Час / Дистанція |
| Beginner / Intermediate / Advanced | Початковий / Середній / Просунутий |

"Switch position" is an accessible name only. It is not in the spec copy table; it is added here because the reduced-motion toggle needs a name.

Remove the now unused "Exercise catalog is coming soon." key; `i18n:extract` does this.

Exercise content (names, steps…) is data in `exercises.json`, not catalog keys.

## 8. Steps

Each step ends with `pnpm typecheck` passing.

1. **Profile fix.**
   - Add `findProfile` in `src/server/profile/service.ts` and use it in `today/page.tsx` and `profile/page.tsx` with `redirect('/onboarding')`.
   - Add a test in `src/server/profile/__tests__/service.test.ts`.
2. **Dataset check.**
   - Read the free-exercise-db README and license at a pinned commit and find out where its images come from.
   - If the images are clearly not public domain or have unknown rights, stop and ask the lead before going on.
   - Start `src/server/db/seed/README.md`.
3. **Constants and search helper.** `src/constants/exercise.ts`, `src/lib/search.ts` with a unit test.
4. **Schema and migration.**
   - Add `subsetOf` in `schema/utils.ts` and `schema/exercise.ts`, and export both from `schema/index.ts`.
   - Run `pnpm db:generate` and review the SQL.
   - Run `pnpm db:migrate` against the shared database, as CI would.
5. **Shared schemas.** `repeatable()` in `src/shared/schemas/utils.ts`, `src/shared/schemas/exercise.ts`, with tests in `src/shared/schemas/__tests__/exercise.test.ts`.
6. **Seed data.**
   - Write `src/server/db/seed/seed-schema.ts`.
   - Build `exercises.json` in batches by muscle group (about 200 in total), with both locales.
   - Add `src/server/db/seed/__tests__/exercises-data.test.ts`, which validates the file.
7. **Seed runner.**
   - Write `catalog.ts` and `index.ts`, plus `__tests__/catalog.test.ts` (twice in a rolled-back transaction).
   - Run `pnpm db:seed` against the shared database.
8. **Media script.**
   - Add `sharp` as a devDependency.
   - Write `media.ts` and add the `db:seed:media` script to `package.json`.
   - Update `.env.example` and `env-schema.ts` (`SUPABASE_URL`).
   - If the lead's `.env.local` has the keys, run it; otherwise list it as a lead action in the summary.
9. **CI.** Add the `db:seed` line and the `SUPABASE_URL` var to `ci.yml` and `main.yml`.
10. **Server domain.**
    - `src/server/http/locale.ts` and the repeated-key reader in `handler.ts`, with a test in `src/server/http/__tests__/handler.test.ts` (extend it if it exists).
    - Add `EXERCISE_NOT_FOUND` to `errors.ts`.
    - Write `src/server/exercises/{errors,media,queries,service,request-exercise}.ts` and `__tests__/service.test.ts`.
11. **Routes.** `src/app/api/v1/exercises/route.ts`, `[id]/route.ts`, `__tests__/route.test.ts` (follow `src/app/api/v1/me/profile/__tests__/route.test.ts` for the fake session).
12. **API client.** `src/api/exercises.ts`; a `getExerciseListItemMock` and a `getExerciseMock` in `src/test/mocks.ts`.
13. **Route group move.** Move the Library layout and pages into `(tabs)`. Run `pnpm build` once to confirm `(tabs)/exercises` and `exercises/[id]` coexist (see Risks).
14. **Labels and small components.** `useExerciseLabels`, `ExerciseImage`, `MuscleChips`, `EquipmentFilter`, `ExerciseListItem`; add the shadcn checkbox.
15. **Catalog.** `useCatalogParams`, `ExerciseCatalog`, `ExerciseCatalogSkeleton`, the `(tabs)/exercises/page.tsx` rewrite, and component tests.
16. **Details.** `usePrefersReducedMotion`, `ExerciseFrames`, `ExerciseDetails`, `ExerciseDetailsSkeleton`, `exercises/[id]/page.tsx`, `not-found.tsx`, and component tests.
17. **Copy.** `pnpm i18n:extract`, fill `uk.json`, then `pnpm i18n:check`.
18. **e2e.** `e2e/06-exercise-catalog.spec.ts`, plus an AC14 case in the same file.
19. **Checks.** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`, the touched unit and component tests, `pnpm build`, and e2e 05 and 06.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/server/db/seed/__tests__/exercises-data.test.ts`: every entry parses with the seed schema (required fields, both locales, 1+ steps and mistakes); the count is between 180 and 220; slugs are unique. `src/server/db/seed/__tests__/catalog.test.ts`: in `sql.begin` + rollback, seeding twice gives equal counts of `exercise` (system) and `exercise_translation` for the seeded slugs; every row has 2 frames and popularity |
| AC2 | `src/server/exercises/__tests__/service.test.ts`: fixtures in `withRollback` with unique tokens. Prefix beats contains beats alias; an alias in `uk` found with locale `en`; upper case and diacritics (`ÉLÉVATION` vs `elevation`) match. `src/lib/__tests__/search.test.ts` covers the normalizer. `e2e/06-exercise-catalog.spec.ts`: "bench" puts Bench Press first; «жим» in `en` finds Bench Press |
| AC3 | `service.test.ts`: two muscles OR, primary only (a secondary-only fixture is excluded), equipment OR, AND across muscles, equipment and `q`. `src/features/exercises/ExerciseCatalog/__tests__/ExerciseCatalog.test.tsx`: chips and equipment update the URL (`router.replace` mock) and call `fetchExercises` with the filters; Clear filters resets. e2e: chip + equipment narrow the list, Clear filters restores it |
| AC4 | `service.test.ts`: a counting Drizzle logger (`drizzle(getDb().$client, { schema, logger })`), so `listExercises` at limit 2 and at limit 50 each logs exactly 1 query |
| AC5 | `service.test.ts`: section = first primary, or first selected primary; `MUSCLE_GROUPS` order; popularity inside a section; `section: null` and rank order with `q`. `ExerciseCatalog.test.tsx`: headings appear before the first item of each section and are absent in search mode |
| AC6 | `service.test.ts`: `nextCursor` chains pages with no overlap and ends with `null`; a malformed cursor gives `VALIDATION_FAILED`. `ExerciseCatalog.test.tsx`: "Show more" fetches page 2 and disappears at the end. e2e: scrolling to the bottom loads more than 30 items |
| AC7 | `useCatalogParams` through `ExerciseCatalog.test.tsx` (`useSearchParams` mock with repeated keys restores the chips and the input). e2e: reload a filtered URL; open details, browser Back returns to the same URL; the details back link has the catalog query |
| AC8 | `src/features/exercises/ExerciseDetails/__tests__/ExerciseDetails.test.tsx`: fake timers switch the alt from Start to End after 1000ms; a `matchMedia` mock with reduced motion shows a static start frame and the button switches it; all metadata labels present; null rows hidden; a `null` image shows the placeholder with the name. `ExerciseImage` `onError` → placeholder, via the same file |
| AC9 | `src/app/api/v1/exercises/__tests__/route.test.ts`: a `lang=uk` cookie returns the `uk` name of a fixture, `en` the `en` name; fallback to the other locale when one is missing. e2e: with the `uk` cookie, the catalog shows «Жим штанги лежачи» and Ukrainian chip labels |
| AC10 | `route.test.ts`: random uuid → 404 `EXERCISE_NOT_FOUND`; user B's own exercise requested by user A → 404; non-uuid → 400; no session → 401. e2e: `/library/exercises/<random uuid>` and `/library/exercises/abc` show "Exercise not found" with a link back |
| AC11 | e2e, both projects: no horizontal scroll on the catalog and the details page in `en-US` and `uk-UA`; mobile: the first list link's height ≥ 56; desktop: `aside` "Filters" is left of the first item and two cards share a row (same `y`) |
| AC12 | `ExerciseCatalog.test.tsx`: a never-resolving fetch → skeleton; `ApiError('INTERNAL', 500)` → message + Retry refetches; empty items with a filter → "No exercises found" + Clear filters; `ApiError(NETWORK_ERROR)` → `OfflineNotice`; data on screen + a failing refetch keeps the items. e2e: `context.setOffline(true)` then tapping a chip keeps the list and shows the offline notice |
| AC13 | `exercises-data.test.ts` asserts that `src/server/db/seed/README.md` mentions "Unlicense" and the pinned SHA; the lead reviews the content in the PR |
| AC14 | `src/server/profile/__tests__/service.test.ts`: `findProfile` returns `null` for a user without a profile. `e2e/06-exercise-catalog.spec.ts`: after sign-up without onboarding, `/today` and `/profile` end on `/onboarding` |

Backend testing rules also apply:

- list tests return at least two items;
- every endpoint has an ownership case;
- service tests run in `withRollback`, so fixtures never leak into the shared database.

## 10. Risks and open questions

- **Image rights.** free-exercise-db is Unlicense, but the photos may come from a third-party site. Step 2 checks this; if it is doubtful, stop and ask the lead (the fallback is placeholders only, with no media upload).
- **Route group overlap.** `library/(tabs)/exercises/page.tsx` and `library/exercises/[id]/page.tsx` share the `exercises` segment. Next.js should allow it, since they resolve to different URLs. If the build rejects it, keep the single Library layout: the details page then shows the Library header and tabs. Note it under Implementation notes.
- **Dynamic metadata under Cache Components.** If `generateMetadata` reading the session breaks prerendering of the details route, fall back to the static title `Exercises · Pampojo` and note it.
- **Collation.** `order by name` uses the database collation. If Ukrainian names sort oddly (і, ї, є), add `collate "uk-x-icu"` for the `uk` locale. Check this in the e2e walk.
- **Content volume.** About 200 × 2 locales of hand-written text. Write it in batches by muscle group and validate each batch with the data test.
- **Seed on PR branches.** CI seeds the shared (production) database from any PR, as migrations already do. The data is idempotent, but a PR that renames slugs leaves orphans. Removing or renaming a system exercise later needs a soft delete step. That is out of scope until a spec needs it.
- **Media not uploaded yet.** Until the lead runs `pnpm db:seed:media`, every image 404s and `ExerciseImage` shows placeholders. The e2e tests do not depend on images.
- **Lead actions:**
  - add `SUPABASE_URL` to Vercel (Production and Preview) and to the GitHub repository variables;
  - put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`;
  - run `pnpm db:seed:media` once.
- **No image optimization.** `next/image` with `unoptimized` serves our WebP directly and avoids Vercel optimization quotas.
- **CSS-less component tests.** Both filter variants are in the DOM in Vitest. Scope queries by landmark (`aside` "Filters" for desktop), as spec 05 did.
- **Offline route navigation.** Opening a details page offline fails at the route level before any component renders. Offline navigation belongs to specs 15 and 16; AC12 covers the list's data requests only.
- **Later specs:**
  - "Mine" badge and filter, and custom exercise translations in one locale (07);
  - the pattern filter UI (not planned);
  - offline catalog in Dexie, reusing `normalizeSearch` (16);
  - image caching for upcoming workouts (17).

No open question blocks implementation.

## 11. Implementation notes
- **Image rights (step 2).**
  - The free-exercise-db photos come from wrkout/exercises.json, whose author says they were scraped and that he does not own the copyright; part of them traces to bodybuilding.com.
  - The lead decided to use them anyway ("Catalog photos with unclear rights" in `DECISIONS.md`). `src/server/db/seed/README.md` records the risk.
- **Seed data.**
  - 210 exercises, pinned at free-exercise-db `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`.
  - The text was written with a one-off merge script kept outside the repo; `exercises.json` is the source of truth.
  - A few entries override the dataset's muscles or equipment: dips are `bodyweight`, the deadlift has hamstrings and glutes as primary, the muscle-up has triceps.
- **Constants.** `DIFFICULTY { min, max }` became `DIFFICULTIES = [1, 2, 3]`, so the type is a literal union. `EQUIPMENT_LIST` was added next to `MUSCLE_GROUPS`.
- **Schema.** Extra index `exercise_source_exercise_id_idx`, because the database guide asks for an index on every foreign key.
- **Queries.**
  - Arrays are bound as one Postgres array literal (`textArray`). Drizzle's `sql` expands JS arrays into value lists, which would change the SQL text with the input.
  - `media.ts` exports `firstFrame` (thumbnail and full URL) instead of `thumbnailOf`, since list items also carry `imageUrl`.
- **Tests.**
  - The query-count test opens its own postgres client for the counting logger; the `Db` type has no `$client`.
  - Added `src/server/http/__tests__/locale.test.ts`.
- **Filters landmark.** `role="search"` labelled "Filters" instead of `<aside>`. A second `complementary` landmark broke the spec 05 sidebar tests (`AppShell.test.tsx`, `e2e/05`), which find the sidebar by that role.
- **One responsive tree instead of duplicates.** There is a single search input, a single `MuscleChips` (scrolls on mobile, wraps from `lg`) and a single `ExerciseListItem` (row on mobile, card on desktop). Only `EquipmentFilter` has two variants switched by CSS.
- **Images.** `ExerciseImage` uses a plain `<img>` with `srcset` (160w thumbnail, 800w full) instead of `next/image` with `unoptimized`, which cannot pick a size without its optimizer.
- **URL updates.**
  - Filters use `window.history.replaceState` instead of `router.replace`.
  - `router.replace` refetched the page on every chip tap, so the chips lagged, and it failed offline, which broke AC12.
  - Next.js syncs `useSearchParams` with the native History API; the checked state follows in a transition, so e2e waits with `toBeChecked()` rather than `check()`.
- **Offline detection.** `fetchStatus === 'paused'` (TanStack Query pauses requests offline and keeps the placeholder list) or an `NETWORK` error, instead of `useIsOnline()`.
- **Back link.** `useCatalogBackHref` reads sessionStorage through `useSyncExternalStore` (server snapshot `''`) instead of an effect.
- **Details layout.** The metadata is split into two cards: "Muscles" (primary, secondary) and the rest.
- **Equipment checkboxes.** The label sits next to the Radix checkbox, not around it. Wrapping delivered every click twice and the state never changed. The shadcn checkbox was restyled to `size-5` with `border-foreground/40 bg-card`.
- **Copy.** "Equipment ({{count}})" is a plural key (`_one/_other`, `uk` `_one/_few/_many/_other`), because it takes `count`.
- **e2e 05.** The "placeholder sections" test no longer expects "Exercise catalog is coming soon.", since this spec replaces that placeholder.
- **Migration and seed on the shared database.** `0002_brief_microbe.sql` was applied and `pnpm db:seed` was run (210 exercises, 420 translations).
- **Media not uploaded.** `.env.local` has no `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, so `pnpm db:seed:media` was not run; images show placeholders until the lead runs it.
- **Run time.** The seed test takes about 90s and `pnpm db:seed` about 40s against the remote database: roughly 630 statements, one round trip each.
- **Checks:**
  - lint, typecheck, format:check, i18n:check: pass.
  - `pnpm test`: 49 files, 291 tests passed.
  - `pnpm build`: pass.
  - e2e on the lead's dev server: `03`, `04`, `05`, `06` all pass (06: 20 tests; 05 has 5 viewport skips).
  - Not run: e2e against `pnpm start`, and `00`–`02`.

## 12. Review — 2026-11-10

**Verdict:** Pass with notes.

- Every AC works at 390px and 1440px in `en` and `uk`.
- One major finding should be fixed before merge: the desktop filter column hides the last equipment options (finding 1).
- AC8 frames could only be checked in component tests, because no media is uploaded yet.

The UI walk ran on the lead's running dev server. It was not stopped.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `src/server/db/seed/__tests__/exercises-data.test.ts` (210 entries, schema with both locales, steps, mistakes); `catalog.test.ts` (seeded twice in a rolled-back transaction, equal counts, 2 frames, popularity). `pnpm db:seed` on the shared database: 210 exercises, 420 translations. The photos themselves are not uploaded yet (see Out of scope). |
| AC2 | Pass | `service.test.ts` (prefix > contains > alias, uk alias with `en` locale, case and diacritics); `e2e/06` "groups the catalog…". Walk: "bench" → Bench Press, Bench Dip, Dumbbell Bench Press…; «жим» in `en` → Bench Press first (`AC2-*-search-bench.png`). |
| AC3 | Pass | `service.test.ts` (OR inside muscles, primary only, AND with equipment); `ExerciseCatalog.test.tsx` (URL updates, Clear filters); `e2e/06` "combines muscle chips…". Walk: two fast chip taps keep both (`?muscle=chest&muscle=triceps`), + Cable → 9 items, Clear → bare URL and the full list (`AC3-*-filtered.png`, `AC3-mobile-equipment-menu.png`). |
| AC4 | Pass | `service.test.ts` "runs exactly one query regardless of the page size" (limit 2 and 50 → 1 query each). |
| AC5 | Pass | `service.test.ts` (sections, first selected primary, popularity); `ExerciseCatalog.test.tsx` (headings, none in search mode). Walk: headings Chest, Shoulders…; first items Bench Press, Push-Up, Dumbbell Bench Press (`AC5-*-grouped.png`). |
| AC6 | Pass | `ExerciseCatalog.test.tsx` (Show more, sentinel); `e2e/06` "loads more…". Walk: 30 → 90 after two scrolls (`AC6-*-scrolled.png`). |
| AC7 | Pass | `e2e/06` "opens details, returns…". Walk: reload keeps Triceps pressed; back link `/library/exercises?muscle=chest`; browser Back returns to the same URL. |
| AC8 | Pass with note | `ExerciseDetails.test.tsx` (1000ms alternation, reduced motion and toggle, every metadata row, hidden null rows, placeholder for missing and failing images). Walk: title "Bench Press · Pampojo", all 8 terms shown, placeholder tile (`AC8-*-details.png`, `AC8-*-reduced-motion.png`). The live app has no frames until `SUPABASE_URL` is set and media is uploaded, so the animation was not seen in the browser. |
| AC9 | Pass | `route.test.ts` (`lang` cookie selects the locale, fallback); `e2e/06` "shows catalog text and labels in Ukrainian". Walk: "Вправи · Pampojo", «Жим штанги лежачи», Ukrainian chips and details (`AC9-*-uk-*.png`). |
| AC10 | Pass | `route.test.ts` (unknown → 404, foreign → 404, non-uuid → 400, no session → 401); `service.test.ts`. Walk: random uuid and `/abc` show "Exercise not found" with the link back (`AC10-*-not-found.png`). |
| AC11 | Pass with note | `e2e/06` layout tests in `en-US` and `uk-UA`. Walk: overflow 0 on the catalog and details in both locales; mobile row 84px; desktop filters end at x=652, cards start at x=676, two cards on one row. The desktop filter column is partly unreachable (finding 1). |
| AC12 | Pass | `ExerciseCatalog.test.tsx` (skeleton, error + Retry, empty + Clear, network error, list kept); `e2e/06` offline test. Walk: `AC12-*-loading.png`, `-empty.png`, `-error.png` (Retry loads 8 items), `-offline.png` (notice above the kept list). |
| AC13 | Pass | `src/server/db/seed/README.md` (Unlicense, pinned SHA, image origin and the unclear rights); asserted in `exercises-data.test.ts`. |
| AC14 | Pass | `src/server/profile/__tests__/service.test.ts` (`findProfile` → null); `e2e/06` "sends a user without a profile…"; walk at both widths. `/today` and `/profile` call `findProfile` plus `redirect` (`src/app/[lang]/(app)/today/page.tsx`, `profile/page.tsx`). The server log was not inspected. |

Screenshots: `scratch/review/06-exercise-catalog/` (git-ignored, 30 files).

### Findings

1. [major] The desktop filter column is taller than the viewport and sticky, so the last equipment options can never be reached at 1440×900 — `src/features/exercises/ExerciseCatalog/ExerciseCatalog.tsx:149`.
   - With 17 wrapped chips and 9 checkboxes the column is 960px high.
   - The "Other" checkbox sits at y=1148 before scrolling and stays pinned at y=1008 while the page scrolls (viewport 900), so "Band" and "Other" are never on screen (`AC11-desktop-scrolled-filters.png`).
   - Fix options: drop `lg:sticky`; or cap it with `lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto`; or put the equipment list above the chips.
2. [minor] The thumbnail placeholder clips words in the 56px tile: "Dumbb…", "Віджим", "штанги лежачи" are cut mid-word — `src/features/exercises/ExerciseImage/ExerciseImage.tsx:29`. Until media is uploaded every mobile row looks like this (`AC5-mobile-grouped.png`, `AC9-mobile-uk-catalog.png`). An icon or initials in small tiles would read better; the name stays in the row anyway.
3. [minor] The equipment checkboxes are round and look like radio buttons, which hints at single choice — `src/components/ui/checkbox.tsx:13`. `rounded-md` resolves to 19.2px from the 24px `--radius` token; use a fixed `rounded-[6px]`.
4. [minor] The native clear button of `type="search"` is a blue browser "×" (`AC12-desktop-empty.png`), outside the design tokens — `src/features/exercises/ExerciseCatalog/ExerciseCatalog.tsx:152`. Hide it with `[&::-webkit-search-cancel-button]:appearance-none` or style it.
5. [minor, process] `catalog.test.ts` takes about 90s and `pnpm db:seed` about 40s: one round trip per statement to the remote database, and both run in CI. Batching the upserts would cut this to a few seconds.

Code checks:

- **Scoping.** Every catalog query filters `owner_id is null or owner_id = $userId` and `deleted_at is null` (`src/server/exercises/queries.ts`); a foreign id is 404. Both endpoints are read-only, so `request-safety.md` does not apply.
- **Structure.**
  - Handlers call one service function (`src/app/api/v1/exercises/route.ts`, `[id]/route.ts`).
  - SQL lives in `queries.ts`; the list is one statement.
  - Zod schemas sit in `src/shared/schemas/exercise.ts`.
  - No `as` casts outside tests; enum columns are narrowed with type guards.
- **Seed scripts.** They use only relative `.ts` imports and run under plain Node, as planned.
- **Diff contents.** No secrets, `.env*` files or build output. `.env.example` only gains placeholders; `SUPABASE_SERVICE_ROLE_KEY` stays commented out.
- **Comments.** Short, and each explains a reason.
- **Deviations.** Every one is in Implementation notes: `replaceState`, `role="search"`, the responsive single tree, `<img srcset>`, the checkbox label, the e2e 05 edit.
- **Out of the plan's file list:** `src/server/http/locale.test.ts`, `src/features/exercises/hooks/useCatalogBackHref.ts`, and the e2e 05 edit. All are recorded and needed.

### Checks

- lint: pass.
- typecheck: pass.
- tests: the spec's suites passed (15 files, 99 tests); the full `pnpm test` from implement: 49 files, 291 tests passed.
- e2e on the lead's dev server: `05` + `06`: 43 passed, 5 skipped (viewport-specific in 05); `03` and `04`: pass (run during implement). Not run against `pnpm start`.

### Out of scope

- **Lead actions, so AC8 can be seen live:**
  - set `SUPABASE_URL` in `.env.local`, Vercel and the GitHub variables;
  - run `pnpm db:seed:media`.
- **Photo rights.** Revisit before a public launch (`DECISIONS.md`).
- **`DATA_MODEL.md` constants path.** It still says enumerations live in `src/shared/constants`, while the code uses `src/constants/`; a one-line doc fix.
- **API sort collation.** The API orders names with the database collation. The walk showed no odd Ukrainian ordering in the first sections; recheck when custom exercises (07) mix languages.

## 13. Review fixes — 2026-11-10

The lead asked to fix findings 1–4 of the review. Finding 5 (seed speed) stays open.

1. The desktop filter column keeps `sticky` but is capped at `100dvh - 6rem` and scrolls on its own (`ExerciseCatalog.tsx`). At 1440×900 "Other" scrolls into view at y=848 (`Fix1-desktop-filters-scrolled.png`).
2. `ExerciseImage` has a `compact` prop: below `lg` the placeholder shows a dumbbell icon instead of the clipped name; list rows use it (`Fix2-mobile-uk-thumbs.png`).
3. Checkbox radius is a fixed `rounded-[6px]`; the computed radius is 6px.
4. The native search cancel button is hidden.

Checks after the fixes:

- lint, typecheck: pass.
- `src/features/exercises` tests: 18 passed.
- `e2e/06`: 20 passed.

## 14. Layout changes after review — 2026-11-10

The lead asked for less empty space on desktop and softer cards (`DECISIONS.md`: "Content column next to the sidebar", "Softer catalog cards").

- **Shell.**
  - `AppShell`, `TopBar` and `AppShellSkeleton` keep the 960px centered column below `lg`.
  - From `lg` the column is left-aligned with `lg:mx-0 lg:max-w-[1120px] lg:px-8`.
  - This changes spec 05 behaviour on every app screen.
- **Catalog grid.** It has 3 columns from `xl` (1280px).
- **Catalog list.**
  - Items are grouped by section (`groupBySection`).
  - On mobile each group is one card with dividers, and rows have no own background or shadow.
  - From `lg` the same list is a grid of separate cards.
- **Radii.** Catalog cards, details frames and metadata cards use 20px; thumbnails 12px. These are fixed values, because the theme's `rounded-2xl`/`3xl` derive from the 24px `--radius` token.
- **Checks.**
  - lint, typecheck: pass.
  - `src/features` tests: 125 passed.
  - e2e `04` + `05` + `06`: 59 passed.
  - Screenshots: `Redesign-*.png`.

## 15. Review — AC8 with real media — 2026-11-10

The lead set `SUPABASE_URL` and the secret key and ran `pnpm db:seed:media`: 420 frames uploaded, 0 skipped. The script now sends `sb_secret_…` keys in `apikey` only, because the new keys are not JWTs.

| AC | Result | Evidence |
| --- | --- | --- |
| AC8 | Pass | The list API returns Storage URLs; a thumbnail answers 200 `image/webp` with `cache-control: public, max-age=31536000`. 32 images per catalog page, 0 broken, at both widths. Details at 390px and 1440px: start and end frames alternate. With reduced motion the start frame stays for 2.5s and a tap switches it (`aria-pressed` false → true). Screenshots: `AC8-*-catalog-photos.png`, `AC8-*-frame-start.png`, `AC8-*-frame-end.png`. |

With this, every AC passes. Finding 5 (seed speed) is still open.

## 16. More layout changes — 2026-11-10

- **Bottom bar.** `BottomNav` and `AppShellSkeleton` are 76px tall (`h-[76px]`) with `pb-[max(0.5rem,env(safe-area-inset-bottom))]`. Main content bottom padding is `calc(6.5rem + inset)`.
- **Today and Profile.** Both lose `max-w-[600px]` and fill the column. `ProfileView` puts its rows and the Language row in a `lg:grid-cols-2` grid (`dl` is `lg:contents`). The buttons are capped at 600px.
- **Radii.** `EmptyState`, Profile rows, `ProfileSkeleton` and `TodaySkeleton` use 20px.
- **Checks.**
  - lint, typecheck: pass.
  - `src/features` + `src/components` tests: 146 passed.
  - e2e `04` + `05` + `06`: 59 passed.
  - Screenshots: `Layout2-*.png`.

## 17. Full-width column and hover animation — 2026-11-10

- **Content column.** From `lg` it uses `lg:max-w-none`: at 1440px `main` is 1184px wide, at 1920px it is 1664px, with no right gap. The catalog grid has `2xl:grid-cols-4`.
- **Hover animation.**
  - `ExerciseListItem` alternates `item.frames` every 1000ms while hovered or focused, and resets to frame 0 on leave or blur. It warms the cache for the other frames on enter. Reduced motion disables it.
  - API contract: `exerciseListItemSchema` gains `frames: { thumbUrl, fullUrl }[]` (additive); `listExercises` fills it with `toFrames`.
- **Tests.** `src/features/exercises/ExerciseListItem/__tests__/ExerciseListItem.test.tsx` covers hover alternation, reset on leave, and no animation with reduced motion. It uses data-URI frames so the `<img>` really loads.
- **Checks.**
  - lint, typecheck: pass.
  - exercises tests: 20 passed (feature) and 36 in total with server and route.
  - e2e `05` + `06`: 43 passed.
  - Live check: hover switches `0-thumb` → `1-thumb` → back on leave at 1440 and 1920 (`Hover-*-card.png`).

## 18. CI fix: batched seed — 2026-11-10

- **CI failure.** The first PR run failed: `catalog.test.ts` timed out at 120s in CI. That was review finding 5: about 630 statements, one round trip each to the remote database.
- **Fix.** `seedCatalog` now runs two statements, one bulk upsert for exercises and one for translations, both through `jsonb_to_recordset`.
- **Run time.** The seed test went from about 90s to about 1s, and `pnpm db:seed` from about 40s to 0.6s.
- **Test.** The assertions are unchanged; the timeout is back to 30s.
- Finding 5 is closed.
