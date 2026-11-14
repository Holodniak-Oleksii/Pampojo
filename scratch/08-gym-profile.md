# 08-gym-profile — technical plan

Spec: `docs/specs/08-gym-profile.md`

## 1. Summary

The user records once which of 38 pieces of gym equipment their gym has. We build:

- a `GYM_EQUIPMENT` constant (5 groups, 38 items), separate from the coarse `EQUIPMENT` of spec 06;
- `exercise.gym_equipment` (`jsonb string[][]`): what an exercise needs. Every group must be met, and any item inside a group meets it. `[]` means always available;
- a pure `isAvailableInGym(requirements, gymEquipment)` in `src/shared/gym.ts`, which specs 18 and 21 will reuse offline;
- `gym_profile` with `GET/PUT /api/v1/me/gym`;
- `/profile/gym`. The first visit has every item on and a "Save my gym" button. After the first save, every change autosaves with a debounced PUT of the whole list;
- a "Set up your gym" nudge card on Today and Profile, and a "Gym equipment" row on Profile;
- an "Available in my gym" catalog chip (`?gym=1`), a "Gym equipment" row on the details page, and an optional "Gym equipment needed" picker in the custom exercise form;
- `gymEquipment` tags for all 210 seed exercises, which the lead reviews in the PR.

Everything is online only. Offline, the gym controls are disabled with "Needs internet".

## 2. Acceptance criteria

- **AC1 — First save.** With no `gym_profile` row, `/profile/gym` renders all 38 chips pressed (`aria-pressed="true"`) and a "Save my gym" button. Toggling chips before saving changes only local state; no request goes out. "Save my gym" sends `PUT /api/v1/me/gym` with the current selection, shows the toast "Gym saved", and hides the button. A reload shows the saved selection and no button.
- **AC2 — Autosave.** Once a row exists, every chip toggle, "Select all" and "Clear all" updates the chips at once. One `PUT` with the whole list goes out 400ms after the last change. "Select all" and "Clear all" count as one change, and several taps within 400ms produce one request with the final selection. While a request is pending or in flight, the status next to the title reads "Saving…"; after success it reads "Saved". A reload shows the latest state. At most one PUT is in flight at a time. Changes made during a flight are sent after it ends.
- **AC3 — Autosave failure.** When an autosave PUT fails, the chips go back to the last state the server confirmed, any pending change is dropped, the status clears, and the toast "Couldn't save your gym. Try again." shows.
- **AC4 — Nudge and Profile row.** Before the first save, a "Set up your gym" card sits on Today, under the greeting, and on Profile, above the rows. It has a "Set up" link to `/profile/gym` and no dismiss control. After the first save it never shows again, including after client-side navigation back from `/profile/gym`. Profile has a "Gym equipment" row that links to `/profile/gym`. It shows "Not set up" before the first save and "{{count}} of 38" after it, where count is the number of saved items, so 0 is possible.
- **AC5 — API.** `GET /api/v1/me/gym` returns 404 `GYM_PROFILE_NOT_FOUND` before the first save and `{ equipment, updatedAt }` after it. `PUT { equipment }` creates or replaces the row and returns the same shape.
  - Sending the same PUT twice leaves one row with the same equipment.
  - `[]` is accepted.
  - Duplicates are dropped, and the stored list is in `GYM_EQUIPMENT_KEYS` order.
  - An unknown key or extra body fields return 400 `VALIDATION_FAILED`. No session returns 401.
  - User A's GET and PUT never read or change user B's row.
- **AC6 — Seed.** `pnpm db:seed` run twice gives the same rows. It also updates `gym_equipment` on existing rows. Every entry in `exercises.json` has a `gymEquipment` that passes the seed schema: known keys only, no empty groups. `goblet-squat` is `[["dumbbells","kettlebells"]]` and `push-up` is `[]`.
- **AC7 — Catalog chip.** The "Available in my gym" chip renders after "Mine" only when the user has a saved gym. Turning it on sets `?gym=1`, which survives a reload. It combines with search, muscles, Equipment and "Mine" by AND. It is off on a fresh visit with no `gym` param. "Clear filters" turns it off. The API ignores `gym=1` for a user without a saved gym.
- **AC8 — Filter correctness.** With a gym of `["dumbbells","flat_bench"]` and the chip on, the list includes Dumbbell Bench Press (`dumbbell-bench-press`), Goblet Squat (`goblet-squat`) and Push-Up (`push-up`). It excludes Bench Press (`barbell-bench-press`) and Lat Pulldown (`lat-pulldown`).
- **AC9 — `isAvailableInGym` unit tests.** A table-driven test covers these cases:
  - `[]` → true, also for an empty gym;
  - a single item present → true, missing → false;
  - an alternatives group met by the first item and by the second → true;
  - several groups with one unmet → false;
  - an empty gym with any non-empty requirement → false.
- **AC10 — Details row.** The details page has a "Gym equipment" metadata row. Groups are joined by " · ", and items inside a group by " or " (localized), for example "Barbell · Flat bench · Squat rack" or "Dumbbells or Kettlebells". For `[]` the row reads "Nothing special".
- **AC11 — Own exercises.**
  - The create/edit form has an optional "Gym equipment needed" grouped picker with no Select all buttons. Each ticked item is sent as its own group `[item]`.
  - An own exercise saved with `[["barbell"]]` is hidden by the chip for a gym without a barbell. An own exercise with `[]`, including every row created before this spec, always shows.
  - "Duplicate as my own" prefills the source's `gymEquipment` with its alternatives and saves it unchanged. An alternatives group shows as one removable chip ("Dumbbells or Kettlebells"), and its items cannot be edited.
- **AC12 — Semantics.** Every chip, "Select all" and "Clear all" is a `<button type="button">`. The equipment chips have `aria-pressed`.
- **AC13 — Offline.** With `navigator.onLine` false, the chips, "Select all", "Clear all" and "Save my gym" are disabled and "Needs internet" shows. Data already on screen stays visible.
- **AC14 — Layout.** `/profile/gym`, the nudge card and the catalog chip render at 390px and 1440px with no horizontal page scroll. At ≥1024px the groups sit in two columns and "Save my gym" sits under the list. On mobile, "Save my gym" stays in view at the bottom, above the bottom nav.

## 3. Data

### Constants — `src/constants/gym.ts` (new)

The seed runs under plain Node, so this file must have **no `@/` value imports**: only `import type`, like `constants/exercise.ts`.

```ts
export const GYM_EQUIPMENT_GROUP = {
  FREE_WEIGHTS: 'free_weights',
  BENCHES_RACKS: 'benches_racks',
  MACHINES: 'machines',
  CABLES: 'cables',
  OTHER: 'other',
} as const;
export type GymEquipmentGroup = ValueOf<typeof GYM_EQUIPMENT_GROUP>;

export const GYM_EQUIPMENT = { BARBELL: 'barbell', EZ_BAR: 'ez_bar', /* …all 38 */ } as const;
export type GymEquipment = ValueOf<typeof GYM_EQUIPMENT>;

/** Display order of groups and items. */
export const GYM_EQUIPMENT_GROUPS: readonly { group: GymEquipmentGroup; items: readonly GymEquipment[] }[];
export const GYM_EQUIPMENT_KEYS: readonly GymEquipment[] = GYM_EQUIPMENT_GROUPS.flatMap((g) => g.items);
export const GYM_AUTOSAVE_DEBOUNCE_MS = 400;
```

Groups and items, in order:

| Group | Items |
| --- | --- |
| `free_weights` | `barbell`, `ez_bar`, `trap_bar`, `dumbbells`, `kettlebells`, `weight_plates` |
| `benches_racks` | `flat_bench`, `adjustable_bench`, `decline_bench`, `squat_rack`, `preacher_bench`, `back_extension_bench`, `glute_ham_bench`, `pull_up_bar`, `dip_station`, `captains_chair` |
| `machines` | `smith_machine`, `chest_press_machine`, `shoulder_press_machine`, `pec_deck`, `row_machine`, `t_bar_row`, `triceps_machine`, `biceps_machine`, `ab_crunch_machine`, `leg_press`, `hack_squat`, `leg_extension`, `leg_curl`, `hip_abduction_adduction`, `calf_raise_machine`, `reverse_hyper` |
| `cables` | `cable_station`, `cable_crossover`, `pulldown_row_station` |
| `other` | `resistance_bands`, `ab_wheel`, `stability_ball` |

A unit test asserts that there are 38 keys and that they are unique.

### Shared rule — `src/shared/gym.ts` (new)

```ts
/** Every group must contain at least one item the gym has; `[]` is always available. */
export function isAvailableInGym(
  requirements: readonly (readonly string[])[],
  gymEquipment: readonly string[],
): boolean;
```

The function is pure, has no imports beyond types, and builds a `Set` once.

### Migration — `0003_*.sql` (generated by `pnpm db:generate`, reviewed by hand)

1. `exercise.gym_equipment jsonb not null default '[]'::jsonb`, with the check `exercise_gym_equipment_array`: `jsonb_typeof(gym_equipment) = 'array'`. Existing rows get `[]`. Key validity is enforced by Zod at the API and the seed; a jsonb-wide key check in SQL is not worth it.
2. `gym_profile`:

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | uuid PK → `user.id` `on delete cascade` | |
| `equipment` | `text[] not null` | check `gym_profile_equipment`: `subsetOf(equipment, GYM_EQUIPMENT_KEYS)` |
| `created_at`, `updated_at` | timestamptz not null default now() | |

The PK is the only index needed. The migration is additive.

Drizzle: `src/server/db/schema/exercise.ts` adds `gymEquipment: jsonb('gym_equipment').$type<GymRequirements>().notNull().default([])` and the check. The new `src/server/db/schema/gym.ts` holds `gymProfile` and is re-exported from `schema/index.ts`.

### Zod — `src/shared/schemas/gym.ts` (new)

```ts
export const gymEquipmentSchema = z.enum(GYM_EQUIPMENT_KEYS);            // via enumOf(GYM_EQUIPMENT)
/** Unique, in GYM_EQUIPMENT_KEYS order. */
export const gymEquipmentListSchema = z.array(gymEquipmentSchema).max(GYM_EQUIPMENT_KEYS.length * 2)
  .transform((items) => GYM_EQUIPMENT_KEYS.filter((key) => items.includes(key)));
export const putGymInputSchema = z.object({ equipment: gymEquipmentListSchema }).strict();
export const gymSchema = z.object({ equipment: z.array(gymEquipmentSchema), updatedAt: z.string() });
/** Exercise requirements: groups of known keys, no empty group, items unique within a group. */
export const gymRequirementsSchema = z
  .array(z.array(gymEquipmentSchema).min(1).max(GYM_EQUIPMENT_KEYS.length)
    .transform((group) => [...new Set(group)]))
  .max(GYM_EQUIPMENT_KEYS.length);
export type Gym = z.infer<typeof gymSchema>;
export type PutGymInput = z.input<typeof putGymInputSchema>;
export type GymRequirements = z.output<typeof gymRequirementsSchema>;
```

### Zod — `src/shared/schemas/exercise.ts` (extend)

- `listExercisesQuerySchema`: add `gym: z.enum(['1']).optional()`.
- `exerciseListItemSchema` and `exerciseSchema`: add `gymEquipment: z.array(z.array(gymEquipmentSchema))`.
- `exerciseFieldShape.gymEquipment = gymRequirementsSchema`. In `exerciseFieldsSchema` (create), use `.default([])`. Update stays partial, so a PATCH without it leaves the column untouched.

### Seed — `src/server/db/seed/seed-schema.ts`

Add a required `gymEquipment: z.array(z.array(z.enum(GYM_EQUIPMENT_KEYS)).min(1))`, imported from `../../../constants/gym.ts`. A `superRefine` rejects an item that repeats inside a group.

## 4. API

All routes use `auth: 'required'` and send `Cache-Control: private, no-store`, which is the existing `json()` behaviour; verify it.

| Method and path | Body / query | 200 response | Errors |
| --- | --- | --- | --- |
| `GET /api/v1/me/gym` | — | `Gym` `{ equipment: GymEquipment[], updatedAt: ISO }` | 404 `GYM_PROFILE_NOT_FOUND`, 401 |
| `PUT /api/v1/me/gym` | `putGymInputSchema` | `Gym` | 400 `VALIDATION_FAILED` (unknown key, extra field), 401 |
| `GET /api/v1/exercises` | adds `gym=1` | items gain `gymEquipment` | as before |
| `GET /api/v1/exercises/{id}` | — | gains `gymEquipment` | as before |
| `PUT /api/v1/exercises/{id}` | adds optional `gymEquipment` (default `[]`) | gains `gymEquipment` | 400 on an empty group or unknown key |
| `PATCH /api/v1/exercises/{id}` | adds optional `gymEquipment` | gains `gymEquipment` | as above |

- **Idempotency:** `PUT /me/gym` is a natural upsert keyed by the user (`insert … on conflict (user_id) do update`), so repeats are safe and `http.ts` may retry it. No `Idempotency-Key` is needed.
- `gym=1` for a user without a `gym_profile` row is ignored and does not return an error.
- Add `GYM_PROFILE_NOT_FOUND: 404` to `ERROR_STATUS` in `src/server/http/errors.ts`.

## 5. Server

### `src/server/gym/` (new domain)

- `errors.ts`: `GYM_ERROR = { NOT_FOUND: 'GYM_PROFILE_NOT_FOUND' }`.
- `queries.ts` (`import 'server-only'`). Each function takes `db: Executor` and `userId`, and every statement filters by `user_id = userId`:
  - `findGymRow(db, userId)`: `select … where user_id = $1 limit 1`.
  - `upsertGymRow(db, userId, equipment)`: `insert … values (userId, equipment) on conflict (user_id) do update set equipment = excluded.equipment, updated_at = now() returning *`. This is one statement, so there is no read-modify-write.
- `service.ts`:
  - `findGym(userId, db = getDb()): Promise<Gym | null>` maps the row with `only(GYM_EQUIPMENT_KEYS, …)` and `updatedAt.toISOString()`.
  - `getGym(userId)` throws `DomainError(GYM_ERROR.NOT_FOUND)` when there is no row.
  - `saveGym(userId, input: z.output<typeof putGymInputSchema>)` upserts and returns `Gym`.
- Route: `src/app/api/v1/me/gym/route.ts`: `GET → json(await getGym(userId))`, `PUT` with `body: putGymInputSchema → json(await saveGym(userId, body.equipment))`.

### `src/server/exercises/` (extend)

- `queries.ts`:
  - `ListExerciseRowsInput` gains `gym: boolean`.
  - `listExerciseRows` adds `e.gym_equipment` to the select, plus a left join `gym_profile gp on gp.user_id = ${input.userId}` and the condition:
    ```sql
    and (${input.gym}::boolean = false or gp.user_id is null
         or not exists (select 1 from jsonb_array_elements(e.gym_equipment) as g(grp)
                        where not (g.grp ?| gp.equipment)))
    ```
    This is the SQL twin of `isAvailableInGym`. `jsonb ?| text[]` is true when any string element of the group is in the gym. Filtering must happen in SQL because paging is in SQL. A parity test (§9, AC8/AC9) runs the same cases through both. The join is scoped by the current user id, so there is still one query per page.
  - `ExerciseListRow` and `ExerciseRow` gain `gym_equipment: string[][]`, and `findExerciseRow` selects it.
  - `ExerciseColumns` gains `'gymEquipment'`.
- `service.ts`:
  - `listExercises` passes `gym: query.gym === '1'`.
  - Both mappers add `gymEquipment: requirements(row.gym_equipment)`, a helper that keeps only known keys and drops empty groups (narrowing, like `only`).
- `write-service.ts`:
  - `createOwnExercise` inserts `gymEquipment: input.gymEquipment`.
  - `writeFields` adds `gymEquipment: fields.gymEquipment` to `columns`, so the existing present-only filter keeps PATCH partial and an idempotent create replay updates it.
  - Duplicate needs no server change: the client sends the source's `gymEquipment` in the body.

### Seed — `src/server/db/seed/catalog.ts`

- Add `gym_equipment: entry.gymEquipment` to `exerciseRows`.
- Add `gym_equipment jsonb` to the `jsonb_to_recordset` column list and to the insert columns.
- Add `gym_equipment = excluded.gym_equipment` to `on conflict do update`.
- Update the seed `README.md` with a "Gym equipment" paragraph that states the tagging rule below.

### Seed tagging — `src/server/db/seed/exercises.json`

Add `"gymEquipment"` after `"equipment"` in all 210 entries. **Rule:** tag the smallest setup a typical gym needs for the exercise as described. Use an alternatives group where either item works.

Fixed by the spec:

- `goblet-squat`: `[["dumbbells","kettlebells"]]`
- `barbell-bench-press`: `[["barbell"],["flat_bench"],["squat_rack"]]`
- `triceps-pushdown`: `[["cable_station","cable_crossover"]]`
- `push-up`: `[]`

Conventions to apply consistently:

| Kind | Tag |
| --- | --- |
| Floor and bodyweight moves (crunch, plank, glute bridge, lunges without load, neck holds) | `[]` |
| Barbell work | `["barbell"]`. Add `["squat_rack"]` when the bar starts racked (squats, overhead press from a rack, bench variations) and the bench the movement uses. A barbell implies plates, so do not add `weight_plates` |
| `weight_plates` | Only when a plate is the load on its own (plate front raise, plate pinch, weighted pull-up or dip) |
| EZ-bar moves | `["ez_bar"]`, or `["ez_bar","barbell"]` where a straight bar works equally (skull crusher, reverse curl) |
| Dumbbell moves on a flat bench | `["dumbbells"],["flat_bench","adjustable_bench"]`. Incline: `["adjustable_bench"]`. Decline: `["decline_bench"]` |
| Dumbbell moves that also work with kettlebells (goblet, swing-like, carries) | `["dumbbells","kettlebells"]` |
| Kettlebell-specific moves (swing, windmill, double KB front squat, KB row) | `["kettlebells"]`, or with dumbbells where truly interchangeable |
| Single-handle cable moves | `["cable_station","cable_crossover"]` |
| Two-sided cable moves (crossover, fly) | `["cable_crossover"]` |
| Pulldowns and seated cable rows | `["pulldown_row_station","cable_station"]` |
| A named machine | That machine: `pec_deck`, `leg_press`, `hack_squat`, `smith_machine` plus the bench used, etc. |
| Pull-up, chin-up, muscle-up, hanging leg raise | `["pull_up_bar"]`. Hanging leg raise: `["pull_up_bar","captains_chair"]`. Band-assisted: add `["resistance_bands"]` |
| Dips | `["dip_station"]`. Bench dip: `["flat_bench","adjustable_bench"]` |
| Inverted row | `["squat_rack","smith_machine"]` |
| Ab wheel, stability ball, band moves | `ab_wheel`, `stability_ball`, `resistance_bands` |

Self-check: run the AC8 expectations and the seed-data test (§9) on the tags. In the PR description, add a short table of the tags that judgement calls produced, for the lead to review.

## 6. Client

### API client — `src/api/gym.ts` (new)

```ts
export const gymKeys = { all: ['gym'] as const, me: () => [...gymKeys.all, 'me'] as const };
/** `null` before the first save (404 GYM_PROFILE_NOT_FOUND). */
export async function fetchGym(): Promise<Gym | null>;   // catches ApiError with that code → null
export function saveGym(input: PutGymInput): Promise<Gym>;
export function useGymQuery({ initialData }: { initialData?: Gym | null } = {});
export function useSaveGymMutation();  // onSuccess: setQueryData(gymKeys.me(), gym) and invalidate exerciseKeys.lists()
```

The mutation invalidates the catalog lists because a `gym=1` list depends on the gym.

### `src/api/exercises.ts` (extend)

`fetchExercises` sets `gym=1` when `filters.gym` is true.

### Feature — `src/features/gym/` (new)

- `hooks/useGymEquipmentLabels.ts` returns `{ group: Record<GymEquipmentGroup, string>, item: Record<GymEquipment, string> }`, built with literal `t()` calls (§7).
- `constants.ts` holds `GROUP_ICON: Record<GymEquipmentGroup, LucideIcon>`:
  - `free_weights` → `Dumbbell`;
  - `benches_racks` → `Bed`;
  - `machines` → `Cog`;
  - `cables` → `Cable`;
  - `other` → `Shapes`.

  Check each name exists in the installed `lucide-react`; if one is missing, pick the closest and note it.
- `utils.ts` has `formatRequirements(requirements, labels, t): string`, which joins with " · " and `` ` ${t('or')} ` ``, and returns `t('Nothing special')` for `[]`. Both details and the form chip use it.
- `GymEquipmentPicker/` is presentational, uses the labels hook, and is reused by the gym page and the exercise form. Props:
  - `selected: readonly GymEquipment[]` and `onToggle(item)`;
  - `onSetGroup?(group, on: boolean)`. When given, each group header shows "Select all" or "Clear all": "Clear all" when every item of the group is selected;
  - `disabled?: boolean`;
  - `columns?: 'auto' | 'single'`. `auto` gives two columns at `lg`; `single` is for the form.

  Markup: each group is a `<section aria-labelledby>` whose header holds the lucide icon (`aria-hidden`), a heading, and the optional action button (`type="button"`) on the right. Below sits a `role="group"` of chips. Chips are `<button type="button" aria-pressed>`, `min-h-11`, and reuse `chipClass` from `features/exercises/MuscleChips`. A pressed chip shows a `Check` icon (`aria-hidden`) before the label.
- `GymEditor/` is the `/profile/gym` client entry (`'use client'`).
  - It calls `useGymQuery()` (no initialData).
  - States:
    - loading: `GymEditorSkeleton`;
    - error, or no data while offline: an inline card with "Couldn't load your gym." and "Retry", which is disabled offline;
    - `null`: the first visit;
    - `Gym`: autosave mode.
  - Layout: a back link to `/profile` ("Profile", with `ArrowLeft`, like the details page) and `PageHeader` with title "My gym". The save status sits in `actions`, as a `role="status" aria-live="polite"` span. Then the intro, the picker, the bodyweight note, and the "Needs internet" hint when offline.
  - **First visit:** local `selected` starts at all `GYM_EQUIPMENT_KEYS`. Toggles are local only. "Save my gym" (`size="lg"`) calls `saveGym.mutateAsync({ equipment: selected })`, then `toast.success('Gym saved')`. On error it shows the save error toast and keeps the selection. The button is disabled while the request is pending and while offline. Once the cache holds a `Gym`, the editor switches to autosave mode and the button is gone.
  - **Autosave** uses `hooks/useGymAutosave.ts`:
    - State: `selected`, `confirmed` (the last server state, seeded from the query), and `status: 'idle' | 'saving' | 'saved'`.
    - `change(next)` sets `selected` and `status = 'saving'`, then restarts a `GYM_AUTOSAVE_DEBOUNCE_MS` timer.
    - When the timer fires, it sends the selection if nothing is in flight. If a request is in flight, it marks `pending`.
    - On success it sets `confirmed` to the response. If `pending` and `selected` differs from the sent list, it sends again; otherwise `status = 'saved'`.
    - On failure it sets `selected = confirmed`, clears the timer and `pending`, sets `status = 'idle'`, and calls `toast.error("Couldn't save your gym. Try again.")`.
    - On unmount with a timer pending, it sends right away, fire and forget, through the mutation so the cache updates.
    - Lists are compared in canonical `GYM_EQUIPMENT_KEYS` order.
  - "Select all" and "Clear all" call `change` once with the whole group added or removed.
- `GymEditorSkeleton/`: a skeleton title plus 3 skeleton groups with 6 skeleton chips each, laid out like the editor.
- `GymNudgeCard/`: a client component. Props are `initialGym: Gym | null`. It reads `useGymQuery({ initialData })` and renders nothing when the data is a `Gym`. Otherwise it renders the spec 01 card style (`rounded-[20px] bg-card p-5 shadow-soft`):
  - a `Dumbbell` icon in an accent-soft circle;
  - the title "Set up your gym" (`h2`);
  - one line of text;
  - a `Button asChild` with a `Link` to `/profile/gym` labelled "Set up".

  The layout is a row from `sm`, and stacks with the button full width under 390px if needed.
- `GymProfileRow/`: a client component taking `initialGym` with the same query. It renders a `Link` card in the Profile row style, with the label "Gym equipment" and the value "Not set up" or `t('{{count}} of {{total}}', { count, total: GYM_EQUIPMENT_KEYS.length })`, plus a `ChevronRight`.

### Routes

- `src/app/[lang]/(app)/profile/gym/page.tsx` (new) is a server component.
  - `generateMetadata` returns `t('My gym · Pampojo')` (absolute).
  - It renders `<GymEditor />` inside the page wrapper used by Profile. The client fetches, so the spec's loading and error states are real.
  - The app shell already treats `/profile/gym` as the Profile section (existing tests).
- `src/app/[lang]/(app)/today/page.tsx`: in `TodayContent`, load `findGym(userId)` in parallel with `findProfile` (`Promise.all`) and pass `initialGym` to `TodayView`. `TodayView` renders `<GymNudgeCard initialGym={…} />` between the greeting and the empty state.
- `src/app/[lang]/(app)/profile/page.tsx`: the same loading. `ProfileView` gains `initialGym`. It renders `GymNudgeCard` above the rows grid, and `GymProfileRow` as a grid item after the Weight row, before Language.

### Catalog — `src/features/exercises/` (extend)

- `types.ts`: `CatalogFilters.gym: boolean`.
- `hooks/useCatalogParams.ts`:
  - parse `gym: current.get('gym') === '1'`;
  - `toSearch` appends `gym=1`;
  - add `toggleGym`;
  - `clear` resets `gym: false`.
- `ExerciseCatalog.tsx`:
  - `const { data: gym } = useGymQuery()`;
  - in `before`, after the Mine chip, when `gym` is a `Gym`, add `<button type="button" aria-pressed={filters.gym} className={chipClass(filters.gym)}>{t('Available in my gym')}</button>`;
  - `hasFilters` includes `filters.gym`, so "Clear filters" shows and turns the chip off;
  - the "Mine" empty state condition gains `&& !filters.gym`.
- `ExerciseDetails.tsx`: in the second `dl`, after Equipment, add `<Row term={t('Gym equipment')}>{formatRequirements(exercise.gymEquipment, gymLabels, t)}</Row>`.
- `ExerciseForm/ExerciseForm.tsx`:
  - `FormValues.gymEquipment: GymEquipment[][]`, initialised from `(exercise ?? source)?.gymEquipment ?? []`.
  - Under the Equipment picker, add a "Gym equipment needed" field with the helper "Leave empty if it needs nothing special.":
    - First, each group with more than one item renders as a removable chip. The label is `formatRequirements([group])`, with an `X` icon and `aria-label` "Remove {{label}}" (copy §7). Clicking it removes that group.
    - Then `<GymEquipmentPicker columns="single" selected={singles} onToggle={…} disabled={busy} />`, where `singles` are the items of one-item groups. Toggling on appends `[item]`; toggling off removes that one-item group.
  - The value is part of `createExerciseInputSchema.safeParse`.
  - `save.ts`: the edit PATCH also sends `gymEquipment: input.gymEquipment`.

### Offline

`useIsOnline()` disables the picker, the group buttons and "Save my gym". It also shows "Needs internet" under the header, and once under the button on the first visit. Data on screen stays. A failed autosave caused by losing the connection follows AC3.

### Layout

- **Mobile (390px):** one column. Group headers have the heading on the left and the action on the right. The chips wrap with `flex-wrap gap-2`. On the first visit, "Save my gym" sits in a `sticky bottom-[calc(6.5rem+env(safe-area-inset-bottom))]` container. It stays above the fixed `BottomNav` and matches the shell's `main` padding, with a background so the chips do not show through.
- **Desktop (≥1024px):** the groups sit in `lg:grid lg:grid-cols-2 lg:gap-4` inside the content column, and "Save my gym" sits statically under the list. The nudge card is the same on both.
- None of this may scroll horizontally. Long uk labels, such as "Лавка з негативним нахилом", wrap inside the chip (`whitespace-normal text-left` for the gym chips only; pass a class to override `whitespace-nowrap`).

## 7. Copy

Every string goes through literal `t()` calls. Add both catalog entries; `pnpm i18n:check` must pass.

| Key (en) | uk |
| --- | --- |
| My gym | Мій зал |
| My gym · Pampojo | Мій зал · Pampojo |
| Tick what your gym has. You can then hide exercises that need anything else. | Познач, що є у твоєму залі. Тоді зможеш приховати вправи, яким потрібне інше обладнання. |
| Bodyweight exercises are always available. | Вправи з власною вагою доступні завжди. |
| Select all | Обрати все |
| Clear all | Зняти все |
| Save my gym | Зберегти мій зал |
| Saving… | Зберігаю… |
| Saved | Збережено (exists, same text) |
| Gym saved | Зал збережено |
| Couldn't save your gym. Try again. | Не вдалося зберегти зал. Спробуй ще раз. |
| Couldn't load your gym. | Не вдалося завантажити зал. |
| Retry | Спробувати ще (exists) |
| Free weights | Вільна вага |
| Benches and racks | Лавки та стійки |
| Machines | Тренажери |
| Cables | Блоки |
| Other | Інше (exists, same text) |
| Barbell / EZ bar | Штанга / EZ-гриф (exist, same text) |
| Trap bar | Трап-гриф |
| Dumbbells | Гантелі |
| Kettlebells | Гирі |
| Weight plates | Диски |
| Flat bench | Пряма лавка |
| Adjustable bench | Регульована лавка |
| Decline bench | Лавка з негативним нахилом |
| Squat rack | Стійки для присідань |
| Preacher bench | Лавка Скотта |
| Back extension bench | Лавка для гіперекстензії |
| Glute-ham bench | Станок GHR |
| Pull-up bar | Турнік |
| Dip station | Бруси |
| Captain's chair | Станок для підйому ніг |
| Smith machine | Тренажер Сміта |
| Chest press | Жим від грудей |
| Shoulder press | Жим над головою |
| Pec deck | Батерфляй |
| Row machine | Тренажер для тяги |
| T-bar row | Т-гриф |
| Triceps machine | Тренажер для трицепса |
| Biceps machine | Тренажер для біцепса |
| Ab crunch machine | Тренажер для преса |
| Leg press | Жим ногами |
| Hack squat | Гак-присід |
| Leg extension | Розгинання ніг |
| Leg curl | Згинання ніг |
| Hip abduction / adduction | Відведення / зведення ніг |
| Calf raise machine | Тренажер для литок |
| Reverse hyper | Зворотна гіперекстензія |
| Cable station | Блочна станція |
| Cable crossover | Кросовер |
| Pulldown and row station | Станція верхньої й нижньої тяги |
| Resistance bands | Резинки |
| Ab wheel | Ролик для преса |
| Stability ball | Фітбол |
| Set up your gym | Налаштуй свій зал |
| Tick the equipment you have, and the app will show only exercises you can do. | Познач обладнання, яке маєш, і застосунок покаже лише ті вправи, які ти можеш виконати. |
| Set up | Налаштувати |
| Gym equipment | Обладнання залу |
| {{count}} of {{total}} | {{count}} з {{total}} |
| Not set up | Не налаштовано |
| Available in my gym | Є в моєму залі |
| or | або |
| Nothing special | Нічого особливого |
| Gym equipment needed | Потрібне обладнання залу |
| Leave empty if it needs nothing special. | Залиш порожнім, якщо нічого особливого не потрібно. |
| Needs internet | Потрібен інтернет (exists) |
| Remove {{label}} | Прибрати {{label}}. This is an accessible name only, for the alternatives chip in the form; it is not visible copy |
| Profile | exists (back link) |

Existing keys "Barbell", "EZ bar", "Other", "Saved", "Retry", "Profile" and "Needs internet" already have the same uk text and are reused. Exercise names live in the database, not in the catalogs, so "Leg press" and the like do not collide. If `i18n:extract` reports a key with a different existing uk text, use `context: 'gym'` for the gym label.

## 8. Steps

Each step ends with `pnpm typecheck` passing.

1. **Constants and rule.** `src/constants/gym.ts`, `src/shared/gym.ts`, and `src/shared/__tests__/gym.test.ts` (AC9 plus the 38-unique-keys check).
2. **Schemas.** Add `src/shared/schemas/gym.ts`, and extend `exercise.ts` with `gym`, `gymEquipment` on the list item, details, create and update. Extend `src/shared/schemas/__tests__/exercise.test.ts` and add `gym.test.ts`: canonical order and dedupe, unknown key, empty group rejected, PATCH without `gymEquipment` leaves it undefined, create defaults to `[]`. Update `src/test/mocks.ts`: `gymEquipment: []` in both exercise mocks, plus a new `getGymMock`.
3. **DB schema and migration.**
   - Edit `schema/exercise.ts`, add `schema/gym.ts`, and re-export it from `schema/index.ts`.
   - Run `pnpm db:generate` and review `0003_*.sql`: one `add column` with its default, one check, one `create table` with its FK and check, and nothing unrelated.
   - Run `pnpm db:migrate` against the dev DB.
4. **Gym server domain.** Add `src/server/gym/{errors,queries,service}.ts`, the `ERROR_STATUS` entry, and `src/app/api/v1/me/gym/route.ts`. Tests: `src/server/gym/__tests__/service.test.ts` and `src/app/api/v1/me/gym/__tests__/route.test.ts`.
5. **Exercise server.** Queries, service and write service from §5. Extend `src/server/exercises/__tests__/service.test.ts` (gym filter, parity) and `write.test.ts` (create and patch `gymEquipment`, duplicate keeps alternatives). Extend `write-route.test.ts` with a 400 on an empty group.
6. **Seed.**
   - Extend `seed-schema.ts` and `catalog.ts`.
   - Tag all 210 entries in `exercises.json` (§5 rules).
   - Extend `seed/__tests__/exercises-data.test.ts` (every entry valid; the goblet, push-up and bench-press values; the AC8 expectations through `isAvailableInGym`) and `catalog.test.ts` (seeding twice keeps `gym_equipment`; a changed tag updates the row).
   - Run `pnpm db:seed` on dev. Update the seed `README.md`.
7. **API client.** Add `src/api/gym.ts` and the `gym=1` param in `src/api/exercises.ts`.
8. **Gym feature.** Labels hook, constants, utils, `GymEquipmentPicker`, `GymEditor` plus `useGymAutosave`, `GymEditorSkeleton`, `GymNudgeCard`, `GymProfileRow`. Tests: `GymEditor.test.tsx`, `GymNudgeCard.test.tsx`, `GymProfileRow.test.tsx`, `src/features/gym/__tests__/utils.test.ts`.
9. **Routes.** `profile/gym/page.tsx`; Today and Profile pages and views. Update `TodayView.test.tsx` and `ProfileView.test.tsx`; their props change.
10. **Catalog, details, form.** Changes from §6 and tests in `ExerciseCatalog.test.tsx`, `ExerciseDetails.test.tsx` and `ExerciseForm.test.tsx`.
11. **Docs.**
    - `docs/tech/DATA_MODEL.md`: the `exercise.gymEquipment` row, and the `gym_profile` section with columns and the "no row = not set up" note.
    - `docs/tech/API.md`: the `gym=1` filter, and `GET/PUT /me/gym` with the 404 code.
12. **Copy.** Run `pnpm i18n:extract`, fill `uk.json`, then run `pnpm i18n:check`.
13. **e2e.** Write `e2e/08-gym-profile.spec.ts` (§9). Use the existing helpers in `e2e/helpers/` to create a user through onboarding and clean up by prefix.
14. **Checks.** Run lint, typecheck, `format:check`, `i18n:check`, the touched unit and component tests, build, and e2e 05, 06, 07 and 08.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `GymEditor.test.tsx`: with `fetchGym` resolving `null`, 38 chips are pressed and "Save my gym" is visible. Toggle one: no `saveGym` call. Click Save: `saveGym` gets 37 keys, the "Gym saved" toast shows, and the button is gone. `e2e/08`: first save, reload, the selection is kept and there is no button |
| AC2 | `GymEditor.test.tsx` with fake timers and `fetchGym` → a `Gym`: three quick toggles then 400ms → `saveGym` called once with the final list. "Saving…" shows, then "Saved". "Clear all" on a group → one call without that group's items. A change during an in-flight save → a second call after the first resolves, never two at once. `e2e/08`: toggle, wait for "Saved", reload, state kept |
| AC3 | `GymEditor.test.tsx`: `saveGym` rejects → the chip returns to its confirmed `aria-pressed` value and the error toast text is visible |
| AC4 | `GymNudgeCard.test.tsx`: `initialGym: null` → card with a "Set up" link to `/profile/gym`; a `Gym` → nothing; a cache update to a `Gym` hides it. `GymProfileRow.test.tsx`: "Not set up" / "5 of 38" / "0 of 38". `TodayView.test.tsx` and `ProfileView.test.tsx` render the card. `e2e/08`: card on Today and Profile before the save, gone after, and the row value updates |
| AC5 | `src/server/gym/__tests__/service.test.ts` (real DB, `withRollback`): `findGym` → null; `saveGym` twice with the same list → one row (`count(*)` = 1) and equal results; `[]` saved; duplicates and order normalised; user A's save does not change user B's row. `src/app/api/v1/me/gym/__tests__/route.test.ts`: GET 404 `GYM_PROFILE_NOT_FOUND`; PUT unknown key → 400; extra field → 400; no session → 401; PUT replay → 200 twice |
| AC6 | `exercises-data.test.ts`: every entry has `gymEquipment` with known keys and non-empty groups; `goblet-squat` and `push-up` have the exact values. `catalog.test.ts`: seed twice → the same `gym_equipment`; change one tag and re-seed → the row is updated |
| AC7 | `ExerciseCatalog.test.tsx`: `fetchGym` null → no "Available in my gym" button; a `Gym` → the button follows "Mine". Clicking it calls `fetchExercises` with `gym: true` and the URL gets `gym=1`. "Clear filters" from the no-results state resets it. `service.test.ts`: `gym=1` for a user without a gym equals the unfiltered list; `gym` with `mine` and `equipment` → AND. `e2e/08`: chip on, reload, still on |
| AC8 | `service.test.ts`, in `withRollback`: a gym row `["dumbbells","flat_bench"]` for a test user plus fixture system rows with the seed tags of the five exercises → `listExercises({ gym: '1' })` returns exactly the three. Parity: for every AC9 case, a fixture row with that requirement is listed exactly when `isAvailableInGym` is true. `exercises-data.test.ts`: the same five slugs checked through `isAvailableInGym` against the real tags. `e2e/08`: gym saved as dumbbells and flat bench only → search shows Goblet Squat and hides Bench Press |
| AC9 | `src/shared/__tests__/gym.test.ts`: `it.each` table with the cases listed in §2 |
| AC10 | `ExerciseDetails.test.tsx`: `[["barbell"],["flat_bench"],["squat_rack"]]` → "Barbell · Flat bench · Squat rack"; `[["dumbbells","kettlebells"]]` → "Dumbbells or Kettlebells"; `[]` → "Nothing special". `features/gym/__tests__/utils.test.ts` covers `formatRequirements` |
| AC11 | `ExerciseForm.test.tsx`: tick Barbell and Flat bench → `createExercise` body `gymEquipment: [["barbell"],["flat_bench"]]`; a source with `[["dumbbells","kettlebells"]]` → chip "Dumbbells or Kettlebells", sent unchanged, and removing it sends `[]`; edit without touching it → the PATCH carries the same value. `write.test.ts`: create with `[["barbell"]]`, then a gym without a barbell → hidden with `gym`; an own row with `[]` → shown |
| AC12 | `GymEditor.test.tsx`: `getByRole('button', { name: 'Barbell' })` has `aria-pressed`; "Select all" and "Clear all" are found by role `button` |
| AC13 | `GymEditor.test.tsx` with `navigator.onLine` false: chips, group buttons and "Save my gym" are disabled, and "Needs internet" is visible. `e2e/08`: `context.setOffline(true)` on `/profile/gym` → chips disabled |
| AC14 | `e2e/08`, both projects (`mobile` 390, `desktop` 1440): `/profile/gym` first visit, Today with the card, catalog with the chip → `document.documentElement.scrollWidth <= innerWidth`. Desktop: two group columns, by comparing the bounding box `x` of two group sections. Mobile: "Save my gym" is in the viewport without scrolling |

Testing rules:

- Server tests use the real DB in `withRollback`, and route tests use committed rows under a `test-gym-` user prefix with cleanup, like the 07 route tests.
- Component tests mock only `@/api/gym` and `@/api/exercises`.

## 10. Risks and open questions

- **SQL and TS drift.** The filter is implemented twice: SQL for paging, TS for offline use in specs 18 and 21. The parity test in AC8 runs every AC9 case through both, so they cannot drift silently.
- **Seed tag quality.** Tagging 210 exercises takes judgement. The tags follow §5, and the lead reviews them in the PR. A wrong tag only hides or shows one exercise under the chip, and a re-seed fixes it.
- **The check constraint holds the key list.** Adding an item later needs a migration that redefines `gym_profile_equipment`. This is the same pattern as the other enumerations.
- **Two tabs autosaving.** The last PUT wins, and each tab shows its own state until reload. This is acceptable for a one-user settings page.
- **Losing the debounce on navigation.** The unmount flush covers in-app navigation. A tab closed within 400ms of a tap can lose that tap, which is acceptable.
- **Later specs.** Specs 18 (substitution) and 21 (AI generation) use `isAvailableInGym`. Spec 16 adds the local copy of `gym_profile`. Spec 23 (AI tagging) can suggest `gymEquipment` for own exercises.

No open questions block implementation.

## 11. Implementation notes

- **Migration and seed on the shared database.** `0003_typical_nuke.sql` (the `gym_profile` table with its FK and check, plus the `exercise.gym_equipment` column with its check, nothing else) was applied, and `pnpm db:seed` was run (210 exercises, 420 translations).
- **Desktop group layout.** The picker uses CSS `columns-2` with `break-inside-avoid` instead of `grid-cols-2`. The grid gave each row the height of its taller group and left a large gap under "Free weights". The e2e check asserts that the five groups sit in exactly two x positions.
- **"Saving…" in uk.** The key already exists as "Зберігаємо…" and another screen uses it, so it is reused instead of the plan's "Зберігаю…".
- **`{{count}} of {{total}}` is a plural key.** Passing `count` makes i18next use plural forms. The en catalog has `_one`/`_other` and uk has `_one`/`_few`/`_many`/`_other`, all with the same text.
- **Form picker is not disabled offline.** The form's other inputs stay editable offline and only Save is blocked, so the gym picker follows them instead of the plan's `disabled={busy}`.
- **Small structure changes.**
  - The form field lives in `ExerciseForm/GymRequirementsField.tsx`.
  - `features/gym/utils.ts` also has `canonical` and `sameEquipment`, and `constants.ts` has `GYM_PATH`.
  - The autosave loop is iterative rather than recursive: the React Compiler lint rejects a `useCallback` that calls itself.
- **Cross-feature imports.** `features/exercises` imports `features/gym/hooks/useGymEquipmentLabels` and `features/gym/utils` directly; there is no index for hooks.
- **e2e 06 locators.** The new "Gym equipment" / "Обладнання залу" term made `filter({ hasText: 'Equipment' })` match two rows. The two assertions now use exact regexes.
- **Seed tags that took judgement**, for the lead's review:
  - `decline-push-up` and `incline-push-up` are `[]`: any raised surface works.
  - `machine-dip` → `triceps_machine`; `machine-shrug` → `smith_machine`. There is no dedicated item for either.
  - `wrist-roller` → `weight_plates`: the roller itself is not in the list.
  - `t-bar-row` → `t_bar_row` or `barbell` (landmine in a corner). `chest-supported-t-bar-row` → `t_bar_row`.
  - `single-arm-cable-row` → `cable_station`, `cable_crossover` or `pulldown_row_station`.
  - `box-squat` → barbell + rack + a flat or adjustable bench as the box. `barbell-step-up` → barbell + rack + bench.
  - `nordic-curl` is `[]` (partner or anchored feet). `glute-ham-raise` → `glute_ham_bench`.
  - `deficit-reverse-lunge` → `dumbbells` or `barbell`.
  - `lying-neck-extension` and `lying-neck-flexion` → a bench + `weight_plates`.
  - Barbell flat-bench variants (`close-grip-bench-press`, `wide-grip-bench-press`, `jm-press`) follow Bench Press: `flat_bench` only, plus rack. Dumbbell and lying moves on a flat bench accept `flat_bench` or `adjustable_bench`.

## 12. Review — 2026-11-13

**Verdict:** Pass with notes

Screenshots are in `scratch/review/08-gym-profile/`, at 390×844 (`-mobile`) and 1440×900 (`-desktop`).

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `GymEditor.test.tsx` (first visit). `e2e/08`. Walk: 38 chips pressed and toggles send no request; Save shows "Gym saved"; after reload the button is gone and the selection is kept. `AC1-first-visit-*`, `AC1-saved-toast-*`, `AC1-loading-*`, `AC1-load-error-*` |
| AC2 | Pass | `GymEditor.test.tsx` (debounce, Clear all, one request in flight). Walk: 3 quick taps → 1 PUT with 34 items; "Clear all" on Machines → 1 PUT; reload keeps the state. `AC2-saving-*`, `AC2-saved-*`, `AC2-clear-all-*` |
| AC3 | Pass | `GymEditor.test.tsx`. Walk: PUT forced to 500 → Flat bench is pressed again and the toast shows. `AC3-save-failed-*` |
| AC4 | Pass | `GymNudgeCard.test.tsx`, `GymProfileRow.test.tsx`, `TodayView.test.tsx`, `ProfileView.test.tsx`, `e2e/08`. Walk: the card shows on Today and Profile before the save and is gone after it, also after client navigation to Today; the row reads "Not set up", then "18 of 38". `AC4-*` |
| AC5 | Pass | `src/app/api/v1/me/gym/__tests__/route.test.ts`, `src/server/gym/__tests__/service.test.ts`. Walk: GET before the save → 404 `GYM_PROFILE_NOT_FOUND` |
| AC6 | Pass | `seed/__tests__/catalog.test.ts` (re-seed updates the tags), `exercises-data.test.ts` (schema, goblet, push-up). Every query is scoped to the current user: `src/server/gym/queries.ts:12`, `:23`, `src/server/exercises/queries.ts` (`gp.user_id = userId`) |
| AC7 | Pass | `ExerciseCatalog.test.tsx` (hidden without a gym, order after Mine, URL, AND, Clear filters). `service.test.ts` (ignored without a gym). `e2e/08`. `AC7-catalog-chip-off-*`, `AC7-catalog-chip-on-*`, `AC7-no-results-*` |
| AC8 | Pass | `service.test.ts` (fixtures and SQL/TS parity), `exercises-data.test.ts`. Walk with the real seed: `gym=1` returns 60 exercises, including Dumbbell Bench Press, Goblet Squat and Push-Up and excluding Bench Press and Lat Pulldown. `AC8-catalog-bench-gym-*` |
| AC9 | Pass | `src/shared/__tests__/gym.test.ts`, every listed case |
| AC10 | Pass | `ExerciseDetails.test.tsx`. Walk: "Barbell · Flat bench · Squat rack", "Dumbbells or Kettlebells", "Nothing special". `AC10-details-*` |
| AC11 | Pass | `ExerciseForm.test.tsx` (ticked items, duplicate alternatives, remove on edit), `write.test.ts`. `AC11-duplicate-alternatives-*` |
| AC12 | Pass | `GymEquipmentPicker.tsx:58`, `:69`: `<button type="button">`, chips have `aria-pressed`. `GymEditor.test.tsx` |
| AC13 | Pass | `GymEditor.test.tsx`, `e2e/08`. Walk: chips and Select all are disabled and "Needs internet" shows. `AC13-offline-*` |
| AC14 | Pass | Walk: `scrollWidth - innerWidth` = 0 on Today, `/profile/gym`, the catalog and the form at both widths; desktop shows two columns (`AC1-first-visit-full-desktop`); on mobile "Save my gym" stays in view above the bottom nav |

### Findings

1. [minor] The uk text for "Saving…" differs from the spec. The spec copy table says "Зберігаю…", but the existing key "Зберігаємо…" is reused — `src/i18n/locales/uk.json`. The deviation is recorded in the notes, but a copy change against the spec is the lead's call (`CLAUDE.md`, "When to ask the lead"). Options: keep it, or give the gym page its own key with `context`.
2. [minor] Pressed chips use the charcoal primary style (`chipClass(true)`, like Mine and the muscle chips), not the accent — `src/features/gym/GymEquipmentPicker/GymEquipmentPicker.tsx:83`. The spec UX says "An on chip shows a check and the accent style". It matches the rest of the app, but it differs from the spec wording and is not recorded in the notes.
3. [minor] `features/exercises` imports gym internals by path (`features/gym/hooks/useGymEquipmentLabels`, `features/gym/utils`) — `ExerciseDetails.tsx:8`, `ExerciseForm/GymRequirementsField.tsx:8`. `code-organization.md` says to import from the folder's `index.ts` and to promote shared hooks only when an unrelated area needs them. This is recorded in the notes; it could become `features/gym/index.ts` exports.
4. [minor] The seed tags that took judgement still need the lead's review (list in §11): `machine-dip`, `machine-shrug`, `wrist-roller`, incline and decline push-ups as `[]`, and others.

No blockers or major findings. Request safety holds: `PUT /me/gym` is a single-statement upsert (`queries.ts:23`), and an exercise create replay writes `gymEquipment` through `writeFields`.

### Checks

- lint: pass.
- typecheck: pass.
- tests: `pnpm test` — 64 files, 420 tests pass.
- e2e: `06`, `07`, `08` — 36 passed. Implementation also ran `04`–`08`: green, with 5 skips that are viewport-specific by design.
- UI walk: a throwaway Playwright spec on the project config at both widths. A standalone `pnpm dev` started outside Playwright kept reloading `/signup` (HMR "Compiled in 1ms"), so the walk used the Playwright web server.
- Diff: no secrets, `.env*` files or build output. `.claude/skills/frontend-design/` is untracked and is not part of this spec; keep it out of the PR.

### Out of scope

- The dev server logs `NEXT_REDIRECT` "Could not validate instant" errors for `/today` during sign-up redirects. These come from the spec 04/05 gates and appeared before this spec.
- The dev reload loop on `/signup` when `pnpm dev` runs alone (see Checks). Worth checking separately.
- With the gym picker, the custom exercise form becomes very long on mobile (5 groups, 38 chips). A collapsible section could help later.
