# 14-body-measurements-bmi — technical plan

Spec: `docs/specs/14-body-measurements-bmi.md`

## 1. Summary

This plan adds body measurements and BMI to Profile, and three small changes elsewhere.

- `MEASUREMENT_TYPE` grows from 9 to 15 types. A migration updates the type check, removes duplicate rows per day, and adds a partial unique index "one measurement per user, type and day".
- A new `measurements` domain serves `GET /api/v1/measurements`, `PUT /api/v1/measurements/{id}` and `DELETE /api/v1/measurements/{id}`. The client gets all rows once and computes the latest values, the changes, the BMI and the charts.
- Profile gets a BMI card, a body diagram with 13 girth labels on a male or female silhouette, and weight and body fat rows. An add sheet saves many types at once. `/profile/measurements/[type]` shows a chart, a list, and an edit sheet with delete.
- The session exercise header becomes a link to `/library/exercises/[id]`. At session start the client warms the service worker cache with these pages, so they open offline.
- The Today planned card fills its thumbnail row and shows "+N" on the last tile. The workout list allows up to 12 thumbnails.
- The mobile exercise picker keeps the full visible height when the keyboard opens.

Writes need the network until spec 16. No new dependency.

## 2. Acceptance criteria

Terms:

- **Live measurement**: a `body_measurement` row with `deletedAt = null`.
- **Girth**: every type except `weight` and `body_fat_pct`.
- **Latest** of a type: the live row with the greatest `measuredOn`. **Previous**: the live row of the same type with the next greatest `measuredOn`.
- **Change** = latest − previous, shown with an arrow, a sign and the unit.
- **Profile zone**: `profile.timeZone`. "Today" uses it.

Criteria:

- AC1: After a weight is saved, the BMI card shows the new value without a page reload. BMI = latest weight kg / (heightCm / 100)², rounded to one decimal. A unit test checks 82.4 kg and 183 cm → 24.6.
- AC2: `bmiCategory(bmi)` returns `underweight` below 18.5, `normal` from 18.5 to below 25, `overweight` from 25 to below 30, and `obese` from 30. Unit tests cover 18.4, 18.5, 24.9, 25.0, 29.9 and 30.0.
- AC3: The weight and body fat rows and each history list row show the change with an `ArrowUp` or `ArrowDown` icon and a signed value, in `text-muted-foreground`. A change of 0 shows "0" with no arrow. A type with one live measurement shows no change. The figure labels never show a change.
- AC4: After an edit or a delete, the history list, the latest value and the BMI card show the new data without a reload.
- AC5: With no live weight, the BMI card shows "Додай вагу, щоб побачити ІМТ." and a "Додати вагу" button. This also happens after the last weight is deleted.
- AC6: The same `PUT /api/v1/measurements/{id}` sent twice leaves one live row for that user, type and day.
- AC7: A second save of a type on a day that already has a live row changes the value of that row. The partial unique index prevents two live rows for one user, type and day, also with parallel requests.
- AC8: The add sheet sends one `PUT` per filled field and nothing for empty fields. "Зберегти" is disabled while every value field is empty.
- AC9: The client and the server reject a value outside the limits and a date after today in the profile zone. The server returns 400 `VALIDATION_FAILED`. Weight must have at most 1 decimal, and girths and body fat at most 2 decimals. Imperial input converts to kg rounded to 0.1 and to cm rounded to 0.01 (unit tested).
- AC10: Profile shows 15 types: 13 girth labels on the figure and the weight and body fat rows. A type with no live row shows "—". The label "122,25 см" fits its column at 390px with no overflow.
- AC11: The weight mini chart shows the live weights of the last 90 days in the profile zone. It is hidden with fewer than 2 points.
- AC12: The history chart has the range control "1М 3М 6М 1Р Все" with 3М selected by default. A range with no points shows "Немає вимірів за цей період." in the plot area.
- AC13: Offline, "Додати вимір", "Додати вагу", "Зберегти" and "Видалити" are disabled, with "Потрібен інтернет". Data that the app loaded before in this tab still shows.
- AC14: In a session, a tap on the current exercise's thumbnail or name opens `/library/exercises/<exerciseId>`. The session bar link returns to `/session/<id>` with the same current exercise.
- AC15: A tap on a row of the exercise list sheet in a session still makes that exercise current. It does not navigate.
- AC16: After a session starts online, `/library/exercises/<id>` of each session exercise is in the `pampojo-pages` cache. Offline, the link opens the cached page.
- AC17: The Today planned card with more exercises than fit shows "+N" on the last tile. N is correct at 390px (5 tiles) and at 1440px.
- AC18: On a 390px viewport with the keyboard open, the exercise picker sheet keeps the visible viewport height, and the first result is above the keyboard.
- AC19: Profile shows the male figure for `sex = male` and the female figure for `sex = female`. Each label is a link to `/profile/measurements/<type>`, with the accessible name "<full type name>: <value>".
- AC20: Every measurement read and write filters by the session user. Another user's id returns 404 for `PUT` and `DELETE`.

## 3. Data

### Constants — `src/constants/measurement.ts`

Replace the object with the 15 types in display order. The order of keys is the order of the add sheet.

```ts
export const MEASUREMENT_TYPE = {
  WEIGHT: 'weight',
  NECK: 'neck',
  SHOULDERS: 'shoulders',
  CHEST: 'chest',
  WAIST: 'waist',
  HIPS: 'hips',
  BICEPS_LEFT: 'biceps_left',
  BICEPS_RIGHT: 'biceps_right',
  FOREARM_LEFT: 'forearm_left',
  FOREARM_RIGHT: 'forearm_right',
  THIGH_LEFT: 'thigh_left',
  THIGH_RIGHT: 'thigh_right',
  CALF_LEFT: 'calf_left',
  CALF_RIGHT: 'calf_right',
  BODY_FAT_PCT: 'body_fat_pct',
} as const;

export const MEASUREMENT_TYPES = Object.values(MEASUREMENT_TYPE);
export const GIRTH_TYPES = MEASUREMENT_TYPES.filter((t) => t !== 'weight' && t !== 'body_fat_pct');

export const MEASUREMENT_LIMITS = {
  weight: { min: 30, max: 300, decimals: 1 },   // kg
  girth: { min: 10, max: 250, decimals: 2 },    // cm
  bodyFat: { min: 2, max: 75, decimals: 2 },    // %
} as const;

// Imperial limits for error messages only; validation runs on the canonical value.
export const MEASUREMENT_LIMITS_IMPERIAL = {
  weight: { min: 67, max: 661 },  // lb
  girth: { min: 4, max: 98 },     // in
} as const;

export function limitsOf(type: MeasurementType) { /* weight | bodyFat | girth */ }
```

`WEIGHT_KG` in `src/constants/profile.ts` stays. `MEASUREMENT_LIMITS.weight` must equal it.

### Schema — `src/server/db/schema/measurement.ts`

- Keep the check `body_measurement_type`. It reads `Object.values(MEASUREMENT_TYPE)`, so the new values flow in.
- Replace `index('body_measurement_user_type_date_idx')` with `uniqueIndex('body_measurement_user_type_day_uq').on(table.userId, table.type, table.measuredOn).where(sql\`${table.deletedAt} is null\`)`. The unique index serves the same filters, so the old index is redundant.

### Migration

1. Run `pnpm db:generate`. Expected SQL: drop and add `body_measurement_type`, drop `body_measurement_user_type_date_idx`, create the unique index.
2. Edit the generated file before the index statement. Add the dedupe, because the index fails on existing duplicates. The migration has not run anywhere yet, so the edit is allowed (`database.md`).

```sql
-- Keep the newest live row per user, type and day; the unique index below needs it.
UPDATE "body_measurement" b SET "deleted_at" = now(), "updated_at" = now()
WHERE b."deleted_at" IS NULL AND EXISTS (
  SELECT 1 FROM "body_measurement" n
  WHERE n."user_id" = b."user_id" AND n."type" = b."type" AND n."measured_on" = b."measured_on"
    AND n."deleted_at" IS NULL
    AND (n."created_at", n."id") > (b."created_at", b."id")
);
```

This is a schema prerequisite, not a backfill, so it stays in the schema migration. Record it in "Implementation notes".

### `docs/tech/DATA_MODEL.md`

- `body_measurement`: list the 15 types, `value numeric(7,2)`, weight at 0.1 and the others at 0.01, and the partial unique index. Remove the sentence "Spec 04 writes only `weight`".

### Shared schemas — `src/shared/schemas/measurement.ts` (new)

```ts
export const measurementTypeSchema = enumOf(MEASUREMENT_TYPE);
export const measurementIdParamsSchema = z.object({ id: z.uuid() });

export const MEASUREMENT_FIELD_ERROR = { RANGE: 'measurement_range', DECIMALS: 'measurement_decimals',
  FUTURE: 'measurement_future', DATE: 'measurement_date' } as const;

export const putMeasurementInputSchema = z
  .object({ type: measurementTypeSchema, value: z.number(), measuredOn: isoDateSchema })
  .strict()
  .superRefine(checkLimits); // range and decimals by limitsOf(type), errors on ['value']

export const measurementSchema = z.object({
  id: z.uuid(), type: measurementTypeSchema, value: z.number(),
  measuredOn: z.string(), updatedAt: z.string(),
});
export const measurementListResponseSchema = z.object({ items: z.array(measurementSchema) });
export const putMeasurementResponseSchema = z.object({ item: measurementSchema });
```

- `isoDateSchema`: reuse the `YYYY-MM-DD` real-date schema from `src/shared/schemas/utils.ts` if it exists. Otherwise add it there with `isRealDate`.
- Decimals check: `Math.abs(value * 10 ** d - Math.round(value * 10 ** d)) < 1e-6`.
- The future-date check needs the profile zone, so the service does it, not the schema.

### Workouts — `src/shared/schemas/workout.ts`

- `thumbnailUrls: z.array(z.string()).max(12)` (was 4). `src/server/workouts/service.ts`: `LIST_THUMBNAILS = 12`.

## 4. API

Update `docs/tech/API.md`: the row for `/api/v1/measurements[/{id}]` gets the shapes below.

### `GET /api/v1/measurements`

- Auth required. No query.
- 200 `{ items: Measurement[] }`: every live row of the user, ordered by `measuredOn` desc, then `createdAt` desc. `Cache-Control: private, no-store`.

### `PUT /api/v1/measurements/{id}`

- Body `{ type, value, measuredOn }` (canonical units), `.strict()`.
- Behaviour, in one transaction:
  1. Lock the row `id` (`for update`). If it exists and belongs to another user, or it is deleted: 404 `MEASUREMENT_NOT_FOUND`.
  2. `measuredOn` after `todayIn(profile.timeZone)`: 400 `VALIDATION_FAILED` with the field `measuredOn` and the code `measurement_future`.
  3. **Row `id` exists (edit):** if `type` differs from the stored type: 400 `VALIDATION_FAILED` on `type`. Soft delete any other live row of this user and type on the new `measuredOn`. Then update `value` and `measuredOn` of `id`.
  4. **Row `id` does not exist (create):** `INSERT … ON CONFLICT (user_id, type, measured_on) WHERE deleted_at IS NULL DO UPDATE SET value = excluded.value, updated_at = now() RETURNING *`. The returned row can have another id (the row that already held that day).
- 200 `{ item }` with the stored row. 201 when step 4 inserted a new row.
- A repeat gives the same row and value (AC6). The client may get back an id that differs from the one it sent. The client refetches the list after every write, so it does not keep the id.

### `DELETE /api/v1/measurements/{id}`

- Own live row: soft delete (`deletedAt = now()`, `touch()`), 204.
- Own deleted row: 204 (a repeat).
- Unknown id or another user's row: 404 `MEASUREMENT_NOT_FOUND`.

### Errors

- `src/server/measurements/errors.ts`: `MEASUREMENT_ERROR = { NOT_FOUND: 'MEASUREMENT_NOT_FOUND' }`.
- `src/server/http/errors.ts`: `MEASUREMENT_NOT_FOUND: 404`.

## 5. Server

### `src/server/measurements/` (new domain)

- `queries.ts` (`import 'server-only'`). Every function takes `userId` and filters by it.
  - `listLive(db, userId)`.
  - `lockById(tx, id)`: select `for update`. The service checks `userId`.
  - `upsertDay(tx, userId, { id, type, value, measuredOn })`: the `ON CONFLICT` insert. Use Drizzle `onConflictDoUpdate({ target: [userId, type, measuredOn], targetWhere: sql\`deleted_at is null\`, set: { value, ...touch() } })`. Return the row and `inserted` (compare the returned id with the input id).
  - `softDeleteOtherOnDay(tx, userId, type, measuredOn, exceptId)`.
  - `updateValueAndDate(tx, userId, id, value, measuredOn)`: `.set({ value, measuredOn, ...touch() })`, `where id and userId`.
  - `softDelete(tx, userId, id)`.
- `service.ts`: `listMeasurements(userId)`, `putMeasurement(userId, id, input)`, `deleteMeasurement(userId, id)`, as in section 4. Read the profile zone with the existing profile query. A missing profile is `PROFILE_NOT_FOUND`.
- `toMeasurement(row)`: `updatedAt.toISOString()`.

### `src/server/profile/queries.ts`

- `upsertDayWeight` calls `upsertDay` from `@/server/measurements/queries` with a new `crypto.randomUUID()`. The reason: a plain insert could now hit the unique index while a measurement `PUT` for the same day runs. Delete `insertWeight` if nothing else uses it. Onboarding uses the same `upsertDay`.

### Route handlers (`withHandler`, thin)

- `src/app/api/v1/measurements/route.ts`: `GET`.
- `src/app/api/v1/measurements/[id]/route.ts`: `PUT` (`params: measurementIdParamsSchema`, `body: putMeasurementInputSchema`) and `DELETE`. Add the comment "Create with a client-generated id, so a retried request finds the same row (request-safety.md)."

## 6. Client

### Theme tokens — `src/app/globals.css`

Add to `:root` and `.dark`, and map them in `@theme` like the existing tokens (`--color-figure: var(--figure)` and so on):

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--figure` | `#d9d3cb` | `#45403c` | Silhouette fill |
| `--tape` | `#6e6862` | `#b3aca3` | Front half of a ring, end diamond. The name is not `--ring`, because the focus ring uses it. |
| `--tape-back` | `#aea79f` | `#6e6862` | Back half of a ring (dashed) |

Add the three tokens to `docs/tech/VISUAL_LANGUAGE.md` under "Colour" with one line each.

### API module — `src/api/measurements.ts` (new)

- `measurementKeys = { all: ['measurements'], list: () => [...all, 'list'] }`.
- `fetchMeasurements()`, `putMeasurement(id, input)`, `deleteMeasurement(id)` through `http()` with the response schemas.
- `useMeasurementsQuery({ enabled })`: `staleTime: 60_000`, `gcTime: 24 * 60 * 60_000`.
- `useSaveMeasurementsMutation()`: takes an array of inputs and sends one `PUT` per input with a new `crypto.randomUUID()`, in sequence. On success it invalidates `measurementKeys.all` and `profileKeys.me()`, because the profile shows the latest weight.
- `useUpdateMeasurementMutation()` (`PUT` with the existing id) and `useDeleteMeasurementMutation()`: invalidate the same keys.

### Unit helpers — `src/lib/units.ts`

- `round2(value)`.
- `inFromCm(cm)` and `cmFromIn(inches)`: round to 0.01.
- `parseDecimal2(text)`: like `parseDecimal`, but 1–2 decimals (`/^\d{1,4}([.,]\d{1,2})?$/`).

### Feature — `src/features/measurements/` (new)

```text
features/measurements/
├── MeasurementsSection/MeasurementsSection.tsx  # 'use client'; BMI card + diagram + rows + sheets
├── BmiCard/BmiCard.tsx
├── BodyDiagram/BodyDiagram.tsx
├── BodyDiagram/figures.tsx                       # MaleFigure, FemaleFigure (path data)
├── BodyDiagram/geometry.ts                       # ring spans per figure
├── MeasurementRows/MeasurementRows.tsx           # weight and body fat rows
├── AddMeasurementSheet/AddMeasurementSheet.tsx
├── EditMeasurementSheet/EditMeasurementSheet.tsx
├── MeasurementHistory/MeasurementHistory.tsx     # /profile/measurements/[type] screen
├── MeasurementStates/MeasurementStates.tsx       # skeleton, error, no girths
├── utils.ts                                      # bmi, bmiCategory, latestByType, changeOf, format, convert
├── index.ts                                      # MeasurementsSection, MeasurementHistory
└── __tests__/
```

#### `utils.ts`

- `bmi(weightKg, heightCm)`: `Math.round((w / (h / 100) ** 2) * 10) / 10`.
- `bmiCategory(value)`: AC2 ranges. `bmiScalePosition(value)`: clamp to 15–40, return a fraction 0–1.
- `byType(items)`: `Map<type, Measurement[]>`, each list newest first.
- `changeOf(list)`: `list[0].value − list[1].value`, or null with fewer than 2. Round to 0.01.
- `formatMeasurement(t, locale, type, valueCanonical, unitSystem)`:
  - weight: kg, or lb with `lbFromKg`; `minimumFractionDigits: 1, maximumFractionDigits: 1`; `t('{{value}} kg')` / `t('{{value}} lb')`.
  - girths: cm, or in with `inFromCm`; `minimumFractionDigits: 1, maximumFractionDigits: 2`; `t('{{value}} cm')` / `t('{{value}} in')`.
  - body fat: `t('{{value}} %')`, the same digits as girths.
- `formatChange(...)`: the signed value ("+1,25 см", "−0,6 кг"). Use `−` (U+2212) for negative values.
- `toCanonical(type, text, unitSystem)`: parse with `parseDecimal` (weight, metric), `parseDecimal2` (others). Convert imperial and round (0.1 kg, 0.01 cm). Return null for bad text.
- `typeName(t, type)` (full name) and `shortName(t, type)` (chip name: "Біцепс", "Передпліччя", "Стегно", "Литка", else the full name).

#### `ProfileView` change — `src/features/profile/ProfileView/ProfileView.tsx`

- Remove the "Weight" row from `rows`. Keep "Age" and "Height".
- Render `<MeasurementsSection profile={profile} />` after the avatar row and `GymNudgeCard`, before the settings grid.
- Desktop (`lg`): the page content becomes `lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10`, `max-w-[1040px]`. The left column has the avatar, the BMI card and the settings grid (`lg:grid-cols-2`). The right column has the measurements part. `MeasurementsSection` therefore exports two parts: `BmiPanel` (left) and `MeasurementsPanel` (right), and `ProfileView` places them. Mobile order: avatar, BMI card, measurements, settings.
- Board: "Профіль, десктоп 1440".

#### `BmiCard` (boards "Профіль, виміри, чоловік, моб", "Стани")

- A `section` with `aria-labelledby`, `rounded-lg bg-card p-5 flex flex-col gap-4`.
- Top row, `flex items-start justify-between gap-4`:
  - `h2` "ІМТ" (`text-sm font-normal text-muted-foreground`), then a `p` with the value (`text-3xl font-extrabold tabular-nums`) and the category (`text-base font-bold`), `flex items-baseline gap-2.5`.
  - A `figure` with the mini chart: an inline SVG polyline, 124×44 (200×56 from `lg`), `stroke="var(--accent)"`, width 2, round joins. The last point is a 10px accent square rotated 45° with `rx=2`. The SVG has `role="img"` and `aria-label` "Вага за 90 днів: з {{first}} до {{last}}". The `figcaption` "Вага, 90 днів" (13px, muted). Hidden with fewer than 2 points. Do not use Recharts here: a polyline is enough.
- Scale (`aria-hidden`): a `relative h-[22px]` box. Inside, a 6px grid `grid-cols-[14fr_26fr_20fr_40fr] gap-[3px]` at `top-2`. The current segment is `bg-foreground`, the others `bg-border-strong`. A 14px marker `bg-accent border-2 border-card rounded-[2px] rotate-45` at `left: calc(<fraction × 100>% - 9px)`. Under it the ticks "15", "18,5", "25", "30", "40" (12px, muted) at 0, 14, 40, 60 and 100%.
- Footer, `border-t border-border pt-3`: "Вага {{weight}}, зріст {{height}}" (15/600). Then "Оновлено {{date}}. Приблизний показник для дорослих." (14px, muted). The date is `dayMonth(locale, latest.measuredOn)`.
- **No weight:** "ІМТ", then "Додай вагу, щоб побачити ІМТ." (16/700), the scale with four `border border-dashed border-planned` segments and no marker, an outlined `Button` "Додати вагу" (`variant="outline"`, sized to its label) that opens the add sheet with focus on weight, and the note "Приблизний показник для дорослих.".
- Height uses the spec 04 display: whole cm or `formatFeetInches`.

#### `BodyDiagram` (boards "Профіль, виміри, чоловік, моб", "Виміри, жінка, моб", "Профіль, темна тема, моб")

- A `relative h-[400px] w-[358px] mx-auto` block (`max-w-full`). The width is fixed so that the geometry stays exact. At 390px, the gutter of 16px leaves 358px.
- `figures.tsx`: `MaleFigure` and `FemaleFigure` render `<svg viewBox="0 0 200 520" aria-hidden="true" className="absolute left-[102px] top-0 h-[400px] w-[154px] text-figure"><path fill="currentColor" fill-rule="evenodd" d="…"/></svg>`. Copy the `d` of `docs/wireframes/14-body-male.svg` and `14-body-female.svg` exactly. Pick by `profile.sex`.
- `geometry.ts`: per figure, a record `type → { y, x1, x2 }` in the 200×520 viewBox:

  | Type | Male | Female |
  | --- | --- | --- |
  | neck | 76, 82, 118 | 74, 85, 115 |
  | shoulders | 160, 22, 178 | 152, 35, 164.5 |
  | chest | 182, 56, 144 | 174, 62, 137 |
  | biceps_right | 214, 14, 44 | 182, 32, 54 |
  | biceps_left | 214, 156, 186 | 182, 146, 168 |
  | waist | 250, 52, 148 | 196, 65, 135 |
  | forearm_right | 256, 18, 34 | 250, 24, 37.5 |
  | forearm_left | 256, 166, 183 | 250, 162.5, 175.6 |
  | hips | 286, 48, 152 | 270, 46, 154 |
  | thigh_right | 330, 49, 93 | 320, 51, 94 |
  | thigh_left | 330, 107, 152 | 320, 105, 149 |
  | calf_right | 398, 52, 85 | 394, 57, 88 |
  | calf_left | 398, 115, 148 | 394, 112, 143 |

  - `LEFT_COLUMN = [neck, chest, biceps_right, forearm_right, hips, thigh_right, calf_right]`. `RIGHT_COLUMN = [shoulders, biceps_left, waist, forearm_left, thigh_left, calf_left]`.
- Ring math in block pixels: `X = 102 + 0.77 × x`, `Y = 0.7692 × y`. `cx = (X1 + X2) / 2`, `rx = (X2 − X1) / 2`, `ry = clamp(rx × 0.13, 2.2, 5.5)`.
- One overlay `<svg width="358" height="400" aria-hidden="true" className="absolute inset-0" fill="none">`, per girth:
  - back half `M l cy A rx ry 0 0 1 r cy`, `stroke="var(--tape-back)"`, width 0.9, `strokeDasharray="2 2.5"`;
  - front half `M l cy A rx ry 0 0 0 r cy`, `stroke="var(--tape)"`, width 1.2;
  - the leader `M sx ly L kx ly L ex cy`, `stroke="var(--planned)"`, width 1. `sx` is 98 (left) or 260 (right), `kx = sx ± 8`, and `ex` is the near ring end (`l` for the left column, `r` for the right);
  - a 6px square at `(ex, cy)`, rotated 45°, `rx=1`, `fill="var(--tape)"`.
- Chip positions: `relax(targets, gap = 42, lo = 19, hi = 381)`. Go down the column, and set each centre to `max(target, previous + 42, 19)`. If the last one is above `hi`, go up from the end, and set each centre to `min(centre, next − 42)`. `target` is the ring `cy`. Put `relax` in `geometry.ts` with a unit test.
- Chips: a `Link` to `/profile/measurements/<type>`, `absolute`, `top = centre − 19`. Left chips use `right: 260px` and `items-end text-right`. Right chips use `left: 260px` and `items-start`. Style: `rounded-sm bg-card px-2 py-1 flex flex-col`. The name is `text-[11px] leading-[14px] text-muted-foreground whitespace-nowrap` (short name). The value is `text-[13px] leading-4 font-bold tabular-nums whitespace-nowrap`. `aria-label="{{fullName}}: {{value}}"`. Focus ring as the other links.
- Column headers: "Права сторона" (`right: 260px; top: 0`) and "Ліва сторона" (`left: 260px; top: 0`), `text-[11px] text-planned`, `aria-hidden`. The neck chip can sit under the left header. Set `lo` to 19, then the chip top is ≥ 0 and the header text (14px) stays above it, because the neck target (~58) is larger.
- The chip is at least 38px tall, so the touch target is below 44px. This is the design that the lead approved. Add `before:absolute before:-inset-y-1` to extend the hit area to 46px without layout change.
- **No girths** (all 13 girths have no live row): render `MeasurementsEmpty` instead of the diagram (board "Стани"): a `flex items-center gap-4` row with the figure in a 92×240px SVG at `opacity-70`. Next to it: `h2` "Ще немає вимірів" (20/800), the sentence (15px, muted), and the dark `Button` "Додати вимір".

#### `MeasurementRows`

- One `ul` `rounded-lg bg-card pl-4 divide-y divide-border`. Rows for `weight` and `body_fat_pct`. Each row is a `Link` to the history, `min-h-14 pr-3 flex items-center gap-3`: the name (15/700, `flex-1`), the change (14px, muted, with the icon), the value (15/600, tabular).

#### Section header

- `flex items-center justify-between`: `h2` "Виміри" (20/800) and a dark `Button` (`h-11`) with `Plus` "Додати вимір". Offline: `disabled`, and under the button `WifiOff` (14px) + "Потрібен інтернет" (13px, muted) in a `role="status"` line (board "Стани").

#### `AddMeasurementSheet` (board "Додати вимір, моб")

- `ui/sheet`. Mobile: `side="bottom"` with `top-[72px] h-auto rounded-t-[8px]` so it fills the screen below 72px. Desktop: `side="right"`, the same as Edit profile.
- React Hook Form. Fields: `measuredOn` (default `todayIn(profile.timeZone)`, `max` today, a native `input type="date"` styled as a 52px field with `Calendar` icon), and one text field per type (`inputMode="decimal"`).
- Layout: `grid grid-cols-2 gap-3`. `weight`, `neck`, `shoulders`, `chest`, `waist`, `hips` and `body_fat_pct` span 2 columns. Left and right pairs share a row (left first: "Біцепс, лівий" then "Біцепс, правий", as on the board).
- Each field: the label (14px, muted) over a 52px box `bg-background rounded-sm px-3.5`. The input is `text-lg font-bold`. The unit suffix (14px, muted) is on the right. The placeholder is the latest value of that type, formatted without the unit, in `placeholder:text-planned`. A focused or filled field gets `border-2 border-foreground`.
- Footer fixed at the bottom of the sheet, `border-t border-border p-4`: "Зберегти" (`w-full h-13`, dark). Disabled while all value fields are empty, while saving, and offline.
- Submit: validate every filled field with `toCanonical` and `putMeasurementInputSchema`. Errors show under each field after the first submit (spec 03 rule), with `aria-describedby`. Then call `useSaveMeasurementsMutation` with the filled inputs. On success, close. On failure, keep the sheet open and show the toast "Не вдалося зберегти. Спробуй ще раз.".
- Props: `focusType?: MeasurementType`. On open, focus that field.

#### `EditMeasurementSheet` (board "Змінити вимір, моб")

- Bottom sheet (`h-auto`), right side on desktop. Title "Змінити вимір" (24/800) and the full type name under it (15px, muted).
- Two fields in a row (`grid-cols-2`): "Дата" and the value with its unit. Then "Зберегти" (dark, 52px) and "Видалити" (`variant="outline"`, `text-destructive`, 48px).
- "Зберегти" calls `useUpdateMeasurementMutation` with the same id.
- "Видалити" opens the existing `ConfirmDialog` (spec 10 style): "Видалити цей вимір?", the line "{{type}} {{value}}, {{date}}.", the destructive "Видалити" and the outlined "Скасувати". Confirm calls `useDeleteMeasurementMutation`, then closes both.

#### Route — `src/app/[lang]/(app)/profile/measurements/[type]/page.tsx` (new)

- `generateMetadata`: title "{{type}} | Pampojo".
- If `type` fails `measurementTypeSchema`, call `notFound()`. Add `not-found.tsx` next to it: the not-found state, as in `library/exercises/[id]/not-found.tsx`, with a link "Профіль" to `/profile`.
- Load the profile on the server (as `profile/page.tsx`) and render `<MeasurementHistory type={type} profile={profile} />`.

#### `MeasurementHistory` (board "Історія типу, моб")

- Back link "Профіль" (`ArrowLeft`, 16/600, 44px tall) to `/profile`.
- Row: `h1` with the full type name (30/800) and the dark "Додати вимір" (opens the add sheet with `focusType`).
- Chart card: `figure rounded-lg bg-card p-4 flex flex-col gap-3`.
  - Header: "{{type}} зараз" (14px, muted) over the latest value (24/800). On the right: the change over the range (14/600) over "за {{range}}" (14px, muted). Use `rangeSpan` from `features/progress/utils.ts`. The change is last − first of the points in the range. With 0 points: "—" and no change. With 1 point: the change is "—".
  - Plot, `h-[180px]`: reuse the Recharts view. Move `features/progress/ProgressChart/LineChartView.tsx` to `src/components/TrendChart/TrendChart.tsx` (default export, the same props) and update the progress import. Load it with `next/dynamic` and a `Skeleton`. Points: the live rows of the type in the range, as `{ date: measuredOn, value: display value }`, oldest first. `dense` when the range is `1m`.
  - The plot wrapper has `role="img"` and an `aria-label`: "{{type}}: {{value}} {{date}}, {{change}} за {{range}}, {{count}} вимірів".
  - 0 points: "Немає вимірів за цей період." (14px, muted, centred).
  - Range: `SegmentedControl` with `PROGRESS_RANGES` and `rangeLabel` (export both helpers from `features/progress/index.ts`), `aria-label` "Період". `useState('3m')`. `rangeStart(today, range)` from `src/shared/progress/metrics.ts` filters the points.
- List: `h2` "Усі виміри" (18/800). One `ul rounded-lg bg-card pl-4 divide-y divide-border`. Each row is a `button` (`min-h-15 w-full pr-4 flex items-center gap-3 text-left`): the date `dayMonth` with the year when it is not the current year (15px, muted, `flex-1`), the change against the next older row (14px, muted), and the value (15/700, `w-[84px] text-right`). A tap opens the edit sheet. Rows have no chevron.
- No rows at all: the list area shows "Ще немає вимірів" and the "Додати вимір" button.

#### States — `MeasurementStates.tsx`

- `MeasurementsSkeleton` (`aria-busy`, board "Стани"): a 168px card, a row with a 110×24 and a 150×44 block, then a 260px area with three chip blocks left, a 110px rounded figure block, and two chip blocks right. All `bg-border rounded-sm`, `Skeleton` from `ui`.
- Error with no data: the existing `CalendarError` pattern with "Не вдалося завантажити виміри." and "Спробувати ще раз".
- Offline with no data: `OfflineNotice` with "Потрібен інтернет".

#### Data flow

- `MeasurementsSection` and `MeasurementHistory` call `useMeasurementsQuery({ enabled: online })` and `useProfileQuery({ initialData })`. `online = useIsOnline()`.
- Offline: writes are disabled (AC13). Cached data stays in the query cache while the tab is open. The cache is not persisted (as spec 13).

### Session — exercise details link (board "Сесія, деталі вправи, моб")

- `src/features/session/ActiveSession/ExerciseHeader.tsx`: wrap the thumbnail and the text column in a `Link` to `/library/exercises/<entry.exerciseId>`:
  - `flex items-center gap-3.5 rounded-lg bg-card p-1.5 -mx-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring`;
  - `aria-label={t('How to do {{name}}', { name })}`;
  - inside: the thumbnail (as now), the name (`text-[22px] font-extrabold leading-tight`, keep the `h1` element inside the link), then a line with `Info` (15px) and "Як виконувати" (14px, secondary), and `ChevronRight` (20px, `text-planned`) at the end.
  - "per side", and "Минулого разу: …" or the note, move under the link, outside it.
- The session list sheet (`SessionExerciseList.tsx`) does not change (AC15).
- The details page does not change. The session bar already links back (spec 10).

### Session — warm the details pages (AC16)

- `src/features/pwa/warm-pages.ts` (new, exported from `features/pwa/index.ts`): `warmPages(paths: string[])`.
  - Return at once if `!navigator.onLine` or `!navigator.serviceWorker?.controller`.
  - For each path, in sequence: `fetch(path, { credentials: 'same-origin', headers: { accept: 'text/html' } })`, and ignore errors. The service worker caches the HTML response network-first in `pampojo-pages` (`src/app/sw.ts`, the rule for app pages). The request has no `RSC` header, so the rule matches.
- Call `void warmPages(ids.map((id) => `/library/exercises/${id}`))` next to both `prefetchLastPerformance` calls: `useStartSession.ts` (start) and `SessionView.tsx` (`onAdd`).
- Offline, a client navigation fails its RSC fetch. Next.js then does a full page load, and the service worker serves the cached HTML. Check this in the e2e test. If Next.js does not fall back, add `prefetch={false}` and a plain `<a>` for this link only, and record it in the notes.

### Today thumbnails (board "Сьогодні, +N, моб")

- `src/features/today/TodayPlan/PlannedCard.tsx` `Thumbnails` gets `count: number` (the exercise count).
- Measure the row width with a `ResizeObserver` on a `ref` (`useLayoutEffect`). `fit = max(1, floor((width + 6) / 58))` for 52px tiles with 6px gaps. Before the first measure, `fit = 4`.
- `own = min(urls.length, fit)`.
  - If `count ≤ own`: show `own` images.
  - If `count > own` and `own < fit`: show `own` images and one extra plain tile (`bg-muted`) with "+{{count − own}}".
  - If `count > own` and `own = fit`: show `fit − 1` images, then the image `fit` with the overlay and "+{{count − fit + 1}}".
- Overlay: `absolute inset-0 bg-[rgba(30,28,26,0.62)] flex items-center justify-center text-base font-extrabold text-[#F3F1EC]`. The row is `flex gap-1.5 overflow-hidden`, with no wrap.
- Keep the row `aria-hidden`. Add a `sr-only` span "Ще {{n}} вправ" when "+N" shows.
- `NextWorkoutCard` passes `count` too.
- `src/features/workouts/WorkoutList/WorkoutList.tsx`: render `item.thumbnailUrls.slice(0, 4)`, so the library list does not change.

### Exercise picker on mobile (board "Пікер з клавіатурою, моб")

- `src/app/[lang]/(app)/layout.tsx` and `src/app/[lang]/session/layout.tsx`: `viewport = { viewportFit: 'cover', interactiveWidget: 'resizes-content' }`. On Android Chrome the layout viewport then shrinks with the keyboard, and `h-dvh` follows it.
- `src/hooks/useVisualViewport.ts` (new): returns `{ height, offsetTop }` from `window.visualViewport` with `resize` and `scroll` listeners, or null on the server and when the API is missing.
- `ExercisePicker.tsx` (mobile only, the editor and the session both use it): `SheetContent` gets `style={{ height: vv.height, top: vv.offsetTop, bottom: 'auto' }}` when `vv` exists, so the sheet follows the visible area also on iOS Safari. Keep `h-dvh max-h-dvh` as the fallback.
- In `PickerBody`, the results list is the only scroll container (`min-h-0 flex-1 overflow-y-auto`). The header, the search row and the "Додати" footer are `shrink-0`.

## 7. Copy

New keys in `src/i18n/locales/en.json` and `uk.json`. Keys are the English text, as in the existing catalogs. `pnpm i18n:check` (or the catalog test) must pass.

| en | uk |
| --- | --- |
| BMI | ІМТ |
| Underweight | Недостатня вага |
| Normal | Норма |
| Overweight | Надлишкова вага |
| Obese | Ожиріння |
| A rough indicator for adults. | Приблизний показник для дорослих. |
| Add your weight to see your BMI. | Додай вагу, щоб побачити ІМТ. |
| Add weight | Додати вагу |
| Weight {{weight}}, height {{height}} | Вага {{weight}}, зріст {{height}} |
| Updated {{date}}. | Оновлено {{date}}. |
| Weight, 90 days | Вага, 90 днів |
| Weight over 90 days: from {{first}} to {{last}} | Вага за 90 днів: з {{first}} до {{last}} |
| Measurements | Виміри |
| Add measurement | Додати вимір |
| Weight | Вага (exists) |
| Neck | Шия |
| Shoulders | Плечі |
| Chest | Груди |
| Waist | Талія |
| Hips | Стегна |
| Biceps, left | Біцепс, лівий |
| Biceps, right | Біцепс, правий |
| Forearm, left | Передпліччя, ліве |
| Forearm, right | Передпліччя, праве |
| Thigh, left | Стегно, ліве |
| Thigh, right | Стегно, праве |
| Calf, left | Литка, ліва |
| Calf, right | Литка, права |
| Body fat | Жир |
| Biceps | Біцепс |
| Forearm | Передпліччя |
| Thigh | Стегно |
| Calf | Литка |
| Right side | Права сторона |
| Left side | Ліва сторона |
| No measurements yet | Ще немає вимірів |
| Measure your chest, waist, hips, arms and legs. The values will appear on the figure. | Заміряй груди, талію, стегна, руки й ноги. Значення зʼявляться на схемі. |
| Date | Дата |
| Save | Зберегти (check if it exists) |
| Edit measurement | Змінити вимір |
| Delete | Видалити (exists) |
| Delete this measurement? | Видалити цей вимір? |
| {{type}} {{value}}, {{date}}. | {{type}} {{value}}, {{date}}. |
| Cancel | Скасувати (exists) |
| {{type}} now | {{type}} зараз |
| All measurements | Усі виміри |
| No measurements in this period. | Немає вимірів за цей період. |
| {{type}}: {{value}} {{date}}, {{change}} over {{range}}, {{count}} measurements | {{type}}: {{value}} {{date}}, {{change}} за {{range}}, {{count}} вимірів (plural forms) |
| The date can't be in the future. | Дата не може бути в майбутньому. |
| From {{min}} to {{max}} {{unit}}. | Від {{min}} до {{max}} {{unit}}. |
| At most {{count}} decimal places. | Не більше {{count}} знаків після коми. (plural forms) |
| Enter a number. | Введи число. |
| Couldn't save. Try again. | Не вдалося зберегти. Спробуй ще раз. |
| Couldn't load measurements. | Не вдалося завантажити виміри. |
| Try again | Спробувати ще раз (exists) |
| Internet needed | Потрібен інтернет (exists) |
| {{value}} cm / {{value}} in / {{value}} % | {{value}} см / {{value}} дюйм / {{value}} % |
| {{value}} kg / {{value}} lb | exist from spec 04, check |
| Profile | Профіль (exists) |
| {{type}} \| Pampojo | {{type}} \| Pampojo |
| How to do {{name}} | Як виконувати {{name}} |
| How to do it | Як виконувати |
| {{count}} more exercises | Ще {{count}} вправ (plural forms) |

## 8. Steps

1. **Constants and schema.** Update `src/constants/measurement.ts` and `src/server/db/schema/measurement.ts`. Run `pnpm db:generate`, add the dedupe SQL, and review the file. Update `DATA_MODEL.md`. Run `pnpm typecheck`.
2. **Shared schemas and unit helpers.** Add `src/shared/schemas/measurement.ts` and the `src/lib/units.ts` helpers, with unit tests.
3. **Server.** Add `src/server/measurements/` (errors, queries, service), the error code, and the two route files. Switch `upsertDayWeight` and onboarding to `upsertDay`. Add the service and handler tests. Update `API.md`.
4. **Workout thumbnails.** `LIST_THUMBNAILS = 12`, schema `max(12)`, and `WorkoutList` `slice(0, 4)`. Update the affected tests.
5. **Tokens.** Add `--figure`, `--tape`, `--tape-back` to `globals.css` and `VISUAL_LANGUAGE.md`.
6. **API module.** Add `src/api/measurements.ts`.
7. **Chart move.** Move `LineChartView` to `src/components/TrendChart/`. Export `rangeLabel`, `rangeSpan` and `PROGRESS_RANGES` access from `features/progress`. Run the progress tests.
8. **Feature utils.** Add `features/measurements/utils.ts` and `BodyDiagram/geometry.ts` with unit tests (AC1, AC2, AC9, relax).
9. **Profile UI.** Add `BmiCard`, `BodyDiagram` with `figures.tsx`, `MeasurementRows`, `MeasurementStates`, `MeasurementsSection`. Change `ProfileView` (remove the weight row, place the panels, desktop grid). Add component tests.
10. **Sheets.** Add `AddMeasurementSheet` and `EditMeasurementSheet` with tests.
11. **History route.** Add the route, `not-found.tsx` and `MeasurementHistory` with tests.
12. **Session link and warm pages.** Change `ExerciseHeader`. Add `warm-pages.ts` and the two calls. Add tests.
13. **Today thumbnails.** Change `Thumbnails`, `PlannedCard` and `NextWorkoutCard`. Add tests.
14. **Picker.** Viewport `interactiveWidget`, `useVisualViewport`, `ExercisePicker` styles. Add a test.
15. **Copy.** Add every key to `en.json` and `uk.json`. Run the catalog test.
16. **E2E.** Add `e2e/14-body-measurements.spec.ts`.
17. Run `pnpm lint`, `pnpm typecheck` and the touched tests. Check 390px and 1440px, light and dark.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/features/measurements/__tests__/utils.test.ts` (`bmi`); `MeasurementsSection.test.tsx`: save a weight, the card shows the new BMI |
| AC2 | `utils.test.ts`: `bmiCategory` at 18.4, 18.5, 24.9, 25.0, 29.9, 30.0 |
| AC3 | `utils.test.ts` (`changeOf`, `formatChange`, 0 and one-row cases); `MeasurementsSection.test.tsx` (rows show the change, chips do not); `MeasurementHistory.test.tsx` (list rows) |
| AC4 | `MeasurementHistory.test.tsx`: edit, then delete, with the mocked API; the list and the latest value update |
| AC5 | `MeasurementsSection.test.tsx`: no weight → the empty BMI card with "Додати вагу" |
| AC6 | `src/server/measurements/__tests__/service.test.ts`: same `PUT` twice → one live row; `src/app/api/v1/measurements/__tests__/route.test.ts` |
| AC7 | `service.test.ts`: create on a day with a row → value replaced, one live row; edit the date onto another row's day → that row soft deleted; two parallel `putMeasurement` calls → one live row |
| AC8 | `AddMeasurementSheet.test.tsx`: "Зберегти" disabled when empty; two filled fields → two `putMeasurement` calls |
| AC9 | `src/shared/schemas/__tests__/measurement.test.ts` (limits, decimals per type); `src/lib/__tests__/units.test.ts` (`inFromCm`, `cmFromIn`, `kgFromLb`); `service.test.ts` (future date → 400 `measurement_future`); `AddMeasurementSheet.test.tsx` (error copy) |
| AC10 | `MeasurementsSection.test.tsx`: 13 chip links, 2 rows, "—" for missing; e2e at 390px: the "122,25 см" chip box is inside the viewport |
| AC11 | `BmiCard.test.tsx` (through `MeasurementsSection`): 1 point → no chart; 3 points → chart with the label; a 100-day-old weight is not in the chart |
| AC12 | `MeasurementHistory.test.tsx`: 3М pressed by default; "1М" with no points → the empty text |
| AC13 | `MeasurementsSection.test.tsx` with `navigator.onLine = false`: buttons disabled, "Потрібен інтернет"; e2e with `context.setOffline(true)` |
| AC14 | `src/features/session/ActiveSession/__tests__/ExerciseHeader.test.tsx`: the link `href` and accessible name; e2e: tap, then the session bar returns |
| AC15 | Existing `SessionExerciseList` test: a row tap changes the current exercise and does not navigate (add the assertion) |
| AC16 | `src/features/pwa/__tests__/warm-pages.test.ts` (fetch calls, skip offline and without a controller); e2e: start a session, go offline, open the link, the details heading shows |
| AC17 | `src/features/today/TodayPlan/__tests__/PlannedCard.test.tsx`: width 310px and 8 exercises → 5 tiles with "+4"; 3 exercises → no "+N"; e2e at 390 and 1440 |
| AC18 | e2e (mobile project): open the picker, type in the search, set a smaller visual viewport with CDP `Emulation.setVisibleSize` or check `useVisualViewport` styles; a component test for `ExercisePicker` with a mocked `visualViewport` (height 534) → the sheet style height is 534px |
| AC19 | `MeasurementsSection.test.tsx`: `sex = female` renders the female figure (`data-figure="female"` on the SVG); the chip link `href` and accessible name "Біцепс, правий: 38,75 см" |
| AC20 | `service.test.ts` and `route.test.ts`: another user's id → 404 for `PUT` and `DELETE`; `GET` returns only own rows |

E2E file: `e2e/14-body-measurements.spec.ts`. It covers the add sheet → the figure label → the history page → edit → delete, the BMI card, offline, the session link, and the Today "+N".

## 10. Risks and open questions

- **Next.js offline fallback (AC16).** The plan expects a full page load when the RSC fetch fails. If the e2e test shows otherwise, use a plain `<a>` for the session link only (section 6). Record the result.
- **Cached details without images.** The cached HTML loads exercise photos from Storage, which are not cached. Image caching is spec 17.
- **`interactiveWidget`** has no effect on iOS Safari. `useVisualViewport` covers iOS. Check on a real Android and iPhone in `/review`.
- **Dedupe in the migration** soft deletes duplicates that spec 04 could create only by a race. The expected count is 0.
- **Label height 38px** is below the 44px touch target. The plan extends the hit area with a pseudo element.
- **Offline writes** are spec 16. The repository wrapper for measurements comes with it.
- **Body photos, goals and BMI-for-age** are out of scope.

## 11. Implementation notes

- The lead approved `pnpm db:migrate` on the shared database before the server tests. Migration `0007_groovy_sir_ram.sql` has the dedupe statement before the unique index, as planned.
- `insertWeight` is gone. Onboarding and the Edit profile weight both call `upsertDay` from `src/server/measurements/queries.ts`.
- `MeasurementsSection` became the hook `useProfileMeasurements(profile)`. It returns the `bmi` and `measurements` nodes, and `ProfileView` places them in its grid. The plan had two panel components. The hook shares one query and one add sheet between both columns.
- The add and edit sheets keep their fields in `useState`, not React Hook Form. They have one text field per type and no nested values, and `validation.ts` gives the same "errors after the first submit" behaviour. Record this if the lead wants the RHF rule strictly.
- New small parts: `ChangeText` (the signed change with the arrow) and `AddMeasurementSheet/validation.ts`.
- The offline copy uses the existing key "Needs internet" ("Потрібен інтернет") instead of a new "Internet needed" key.
- The "+N" tile uses the key `+{{value}}`, so it has no plural forms. The screen reader text "{{count}} more exercises" has them.
- New copy that the plan did not list: "Measurement not found" / "Вимір не знайдено" for the history not-found page.
- The "+N" text uses `text-primary-foreground`, because lint does not allow a hex colour. It is light in both themes.
- The BMI mini chart is 124×44px at every width. A 200×56 desktop size would stretch the end diamond.
- The thumbnail math moved to `src/features/today/TodayPlan/thumbnails.ts` with a unit test. Browser component tests load no CSS, so the row width cannot be measured there. The e2e test checks the real layout at 390px and 1440px.
- `useDeleteMeasurementMutation` wraps the call as `(id) => deleteMeasurement(id)`, so TanStack Query's context argument does not reach the fetcher.
- AC18 in e2e shrinks the viewport to 534px instead of a real keyboard, because headless Chromium has none. The component test checks the `visualViewport` sizing.
- AC16 in e2e needs a production build with the service worker, the same as `e2e/15-pwa-shell.spec.ts`. It is skipped without `CI`.
- AC16 passed against a production build (`pnpm build && CI=1 pnpm exec playwright test e2e/14-body-measurements.spec.ts -g AC16`). Next.js falls back to a full page load offline, so the plain `<a>` fallback was not needed.

- Review fixes (2026-11-18), with the lead's go-ahead:
  - The Profile settings rows are one column on desktop. The 2-column grid in the left column wrapped the labels.
  - `interactiveWidget: 'resizes-content'` is removed from both layouts. `useVisualViewport` keeps the picker above the keyboard on Android and iOS without moving the bottom nav or the rest bar.
  - The BMI ticks are formatted with the locale.
  - The add and edit sheets use React Hook Form with `measurementResolver` (`AddMeasurementSheet/validation.ts`). An empty date shows "Обери дату." ("Choose a date.").
  - New `DateField`: the native date input sits invisible over the date in the app language ("18 листопада 2026") and opens the native picker on a tap.
  - The edit sheet stacks the date and the value, because a long date does not fit half the row.
  - `putMeasurement` tries once more after a unique violation (`23505`), so an edit and a parallel create on one day do not end in 500.
  - New tests: the loading skeleton, the empty date, and the parallel edit and create.
  - `ThemeSwitch` (spec 29) uses a flex row with `whitespace-nowrap`, so "Як у системі" stays on one line at 390px.
  - The source images moved from `public/icons/` to `docs/wireframes/14-body-*-source.jpeg`, and the SVGs are now `docs/wireframes/14-body-*.svg`.

## 12. Review — 2026-11-18

**Verdict:** Pass with notes

Screenshots: `scratch/review/14/`. The walk used 390×844 and 1440×900, uk, light and dark.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `utils.test.ts` (`bmi`); `MeasurementsSection.test.tsx` "updates the BMI after a saved weight"; e2e add flow (24.6 → 25.4); `AC10-mobile-filled.png` |
| AC2 | Pass | `utils.test.ts` `bmiCategory` at 18.4–30.0 |
| AC3 | Pass | `MeasurementsSection.test.tsx` "shows the change in the rows but not on the chips"; `MeasurementHistory.test.tsx`; `AC12-mobile-history.png` |
| AC4 | Pass | `MeasurementHistory.test.tsx` "edits and deletes"; e2e add flow; `AC4-mobile-edit-sheet.png`, `AC4-mobile-delete-dialog.png` |
| AC5 | Pass | `MeasurementsSection.test.tsx`; `AC5-desktop-no-weight.png` |
| AC6 | Pass | `service.test.ts`, `route.test.ts` (same `PUT` twice) |
| AC7 | Pass | `service.test.ts` (replace, parallel saves, edit onto another day); unique index in `0007_groovy_sir_ram.sql` |
| AC8 | Pass | `AddMeasurementSheet.test.tsx`; `AC8-mobile-add-sheet.png` |
| AC9 | Pass | `measurement.test.ts`, `units.test.ts`, `utils.test.ts`, `service.test.ts` (future date), `route.test.ts` (400); `AC9-mobile-add-errors.png` |
| AC10 | Pass | `MeasurementsSection.test.tsx` (15 links, "—"); e2e chip inside the 390px viewport; `AC10-*-filled.png`, `AC10-*-no-girths.png`, `AC10-*-dark.png` |
| AC11 | Pass | `MeasurementsSection.test.tsx` (90-day trend, hidden with one point) |
| AC12 | Pass | `MeasurementHistory.test.tsx`; `AC12-*-history.png`, `AC12-*-range-1m.png` |
| AC13 | Pass | `MeasurementsSection.test.tsx` offline case; e2e offline; `AC13-*-offline.png` |
| AC14 | Pass | `ActiveSession.test.tsx` link case; e2e session link and bar; `AC14-mobile-session.png` |
| AC15 | Pass | `ActiveSession.test.tsx` "makes a list row current without leaving the session" |
| AC16 | Pass | `warm-pages.test.tsx`; e2e on a production build with the service worker (mobile and desktop) |
| AC17 | Pass | `thumbnails.test.ts`; e2e at 390 and 1440; `AC17-mobile-today.png` (3 photos and a "+5" tile) |
| AC18 | Pass (approximated) | `ExercisePicker.test.tsx` visualViewport case; e2e with a 534px viewport; `AC18-mobile-keyboard.png`. A real Android and iPhone keyboard is not tested |
| AC19 | Pass | `MeasurementsSection.test.tsx` (female figure, link name); `AC19-*-female.png`, `AC19-*-not-found.png` |
| AC20 | Pass | `service.test.ts`, `route.test.ts` (404 for a foreign id, list scope); every query in `src/server/measurements/queries.ts` filters by `userId` |

### Findings

1. [major] On desktop the settings grid is too narrow — `src/features/profile/ProfileView/ProfileView.tsx:60`. The 2-column grid now sits in the left column (about 580px). "Обладнання залу" wraps and overlaps "Не налаштовано", and "Встановити застосунок" wraps (`AC10-desktop-filled.png`, `AC5-desktop-no-weight.png`, the lead's screenshot). Put the settings under both columns at full width, or use one column inside the left column.
2. [minor] `interactiveWidget: 'resizes-content'` applies to every app page and to the session — `src/app/[lang]/(app)/layout.tsx:9`, `src/app/[lang]/session/layout.tsx:8`. On Android the fixed bottom nav and the session rest bar will now move up over the keyboard and can cover the focused input. Check this on a device, or set it only while the picker is open.
3. [minor] The BMI tick "18,5" is a fixed string — `src/features/measurements/BmiCard/BmiCard.tsx:26`. English shows "18,5" instead of "18.5". Format it with the locale.
4. [minor] An empty date in the add or edit sheet is not checked on the client — `src/features/measurements/AddMeasurementSheet/AddMeasurementSheet.tsx:80`. The server returns 400 and the user sees the general "Не вдалося зберегти" toast.
5. [minor] The native date field follows the browser locale, not the app language — `AddMeasurementSheet.tsx:122`, `EditMeasurementSheet.tsx:121`. The uk walk showed "11/18/2026".
6. [minor] An edit that moves a date onto a day where a parallel create inserts a row can hit the unique index and return 500 — `src/server/measurements/service.ts:66`. The case is rare, and a retry succeeds.
7. [minor] The sheets keep their fields in `useState`, not React Hook Form, against `state-and-data.md` "Forms". This is recorded in "Implementation notes" and needs the lead's yes or no.
8. [minor] The loading skeletons (`MeasurementsSkeleton`, `BmiSkeleton`) have no test and were not walked.

### Checks

- lint: pass.
- typecheck: pass.
- tests: `pnpm test` — 133 files, 843 tests passed.
- e2e: `e2e/14-body-measurements.spec.ts` on the dev server — 9 passed, 3 skipped (the AC16 case and the mobile-only picker case on desktop). AC16 on a production build — 2 passed.
- i18n: `pnpm i18n:check` — catalogs complete.
- No secrets, `.env*` files or build output in the diff. The source JPEG files in `public/icons/` are untracked and must not go into the commit.

### Out of scope

- At 390px the theme switch wraps "Як у системі" onto two lines (`ThemeSwitch`, spec 29). The lead pointed at it too. It was the same before this spec.
- The dev server logs "Could not validate `instant`" on the onboarding redirect during sign-up. This is not related to spec 14.

## 13. Review fixes — 2026-11-18

**Verdict:** Pass

| Finding | Result | Evidence |
| --- | --- | --- |
| 1. Desktop settings grid | Fixed | `ProfileView.tsx`; `scratch/review/14/AC10-desktop-filled.png` |
| 2. `interactiveWidget` on every page | Fixed (removed) | both layouts; `ExercisePicker.test.tsx` visualViewport case |
| 3. BMI tick "18,5" | Fixed | `BmiCard.tsx` formats the ticks with the locale |
| 4. Empty date | Fixed | `validation.ts` `validateDate`; `AddMeasurementSheet.test.tsx` "asks for a date" |
| 5. Native date format | Fixed | `DateField`; `AC8-mobile-add-sheet.png`, `AC4-mobile-edit-sheet.png` |
| 6. Race on the unique index | Fixed | `service.ts` retry; `service.test.ts` "edit and a create meet on one day" |
| 7. Forms without React Hook Form | Fixed | both sheets use `useForm` |
| 8. Skeletons without a test | Fixed | `MeasurementsSection.test.tsx` "shows the skeletons" |
| Out of scope: theme switch wraps | Fixed with the lead's go-ahead | `ThemeSwitch.tsx`; `AC8-mobile-add-sheet.png` |

### Checks

- lint: pass. typecheck: pass. i18n: complete.
- tests: `pnpm test` — 133 files, 846 tests passed.
- e2e: `e2e/14-body-measurements.spec.ts` — 9 passed, 3 skipped.
- An interrupted run left 7 open test transactions in the shared database. They locked catalog rows, and the next runs timed out. The lead agreed, and they were ended with `pg_terminate_backend`. After that, all tests passed.

