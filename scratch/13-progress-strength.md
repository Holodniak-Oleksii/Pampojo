# 13-progress-strength — technical plan

Spec: `docs/specs/13-progress-strength.md`

## 1. Summary

This plan builds the strength progress screen and the "Нові рекорди" row of the session summary.

- One shared, pure module computes the chart points, the bests and the new records. The server and the client both use it.
- Two new endpoints serve `/progress`. One endpoint gives the selector list and the month numbers. The other endpoint gives the points and the all-time records of one exercise.
- `GET /api/v1/exercises/{id}/last-performance` gets a `bests` field. The client stores it in Dexie with "last time".
- When a session finishes, the device computes its new records and saves them on the local session row. The summary reads that list, also offline.
- `/progress` replaces its placeholder with the real screen. The chart uses Recharts through the shadcn `chart` component, with a dynamic import.
- The exercise details page gets a "Переглянути прогрес" link.

No migration.

## 2. Acceptance criteria

Terms used below:

- A **counted set** is a `set_log` row with `deletedAt = null` in a session with `status = completed`. Abandoned and in-progress sessions never count.
- A set counts for `set_log.exerciseId`, the exercise that the user performed.
- **Profile zone** is `profile.timeZone`. "Today", the session date and the month use it.

Criteria:

- AC1: For a fixture of sessions, every chart point and every estimated 1RM equals a hand-computed value. Estimated 1RM is Epley `weight × (1 + reps / 30)`, only for a set with 1–12 reps and a weight above 0. A set with more than 12 reps, or with a null or 0 weight, gives no estimated 1RM.
- AC2: A session with a heavier set than all earlier sessions becomes the "Найбільша вага" record. `/progress` shows the record with its date, and the record row links to `/session/<id>`. The summary of that session lists the record under "Нові рекорди".
- AC3: The first session of an exercise shows no new records for that exercise in the summary. A value equal to the previous best is not a new record.
- AC4: A session that finishes offline shows its new records in the summary. The baseline is the bests stored on the device at start, merged with the local completed sessions.
- AC5: A user with no counted sets sees the empty state with "Почати тренування", which opens the Start sheet. The selector lists only exercises with a counted set, the most recently trained first.
- AC6: A `reps`, `time` or `distance` exercise shows one chart metric, no metric switch, and one record.
- AC7: Abandoned sessions, in-progress sessions and deleted set logs change no point and no record.
- AC8: The chart has an accessible summary: the metric, the exercise, the latest value with its date, the change over the range, and the number of workouts.
- AC9: A range that the user opened before does not refetch when the user switches back to it within 5 minutes. While the app stays open, it also shows offline.
- AC10: The month numbers count the completed workouts and the volume of the current calendar month in the profile zone.
- AC11: Mobile (390px) and desktop (1440px) work in en and uk, light and dark, with no horizontal scroll.

## 3. Data

No database change and no migration.

### Shared schemas — `src/shared/schemas/progress.ts` (new)

```ts
export const PROGRESS_RANGE = { M1: '1m', M3: '3m', M6: '6m', Y1: '1y', ALL: 'all' } as const;
export const progressRangeSchema = enumOf(PROGRESS_RANGE);

export const RECORD_TYPE = {
  HEAVIEST_WEIGHT: 'heaviest_weight',
  BEST_E1RM: 'best_e1rm',
  MOST_REPS: 'most_reps',
  BEST_VOLUME: 'best_volume',
  LONGEST_DURATION: 'longest_duration',
  LONGEST_DISTANCE: 'longest_distance',
} as const;
export const recordTypeSchema = enumOf(RECORD_TYPE);

export const progressQuerySchema = z.object({ range: progressRangeSchema.default('3m') });

export const progressPointSchema = z.object({
  sessionId: z.uuid(),
  date: z.string(),            // YYYY-MM-DD, start date in the profile zone
  topWeightKg: z.number().nullable(),
  e1rmKg: z.number().nullable(),
  volumeKg: z.number().nullable(),
  reps: z.number().nullable(),        // most reps in one set
  durationSec: z.number().nullable(), // longest
  distanceM: z.number().nullable(),   // longest
});

export const progressRecordSchema = z.object({
  type: recordTypeSchema,
  value: z.number(),
  weightKg: z.number().nullable(), // the set weight for most_reps and best_e1rm
  reps: z.number().nullable(),     // the set reps for best_e1rm
  sessionId: z.uuid(),
  date: z.string(),
});

export const exerciseProgressResponseSchema = z.object({
  trackingType: trackingTypeSchema,
  points: z.array(progressPointSchema),
  records: z.array(progressRecordSchema),
});

export const progressExerciseItemSchema = z.object({
  exerciseId: z.uuid(),
  name: z.string(),
  trackingType: trackingTypeSchema,
  thumbnailUrl: z.string().nullable(),
  lastTrainedAt: z.string(),
});

export const progressExercisesResponseSchema = z.object({
  items: z.array(progressExerciseItemSchema),
  month: z.object({ workouts: z.number().int(), volumeKg: z.number() }),
});

/** All-time bests of one exercise; a field is null when no set gave it. */
export const bestsSchema = z.object({
  heaviestWeightKg: z.number().nullable(),
  bestE1rmKg: z.number().nullable(),
  mostReps: z.object({ reps: z.number(), weightKg: z.number().nullable() }).nullable(),
  bestVolumeKg: z.number().nullable(),
  longestDurationSec: z.number().nullable(),
  longestDistanceM: z.number().nullable(),
});

export const newRecordSchema = z.object({
  exerciseId: z.uuid(),
  type: recordTypeSchema,
  value: z.number(),
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
});
```

Export the inferred types (`ProgressRange`, `RecordType`, `ProgressPoint`, `ProgressRecord`, `ExerciseProgressResponse`, `ProgressExerciseItem`, `ProgressExercisesResponse`, `Bests`, `NewRecord`).

`progressRecordSchema` adds `reps` to the spec shape. The estimated 1RM date line needs it ("16 листопада, 87,5 кг × 5").

### Shared schema change — `src/shared/schemas/session.ts`

- `lastPerformanceResponseSchema` becomes `z.object({ item: lastPerformanceSchema.nullable(), bests: bestsSchema.nullable() })`. `bests` is null exactly when `item` is null.

### Shared computation — `src/shared/progress/metrics.ts` (new, pure, no I/O)

Input set type: `MetricSet = { weightKg: number | null; reps: number | null; durationSec: number | null; distanceM: number | null }`.

- `estimateOneRepMax(weightKg, reps): number | null`: Epley for `1 ≤ reps ≤ 12` and `weightKg > 0`, else null. No rounding.
- `pointOf(trackingType, sets): Omit<ProgressPoint, 'sessionId' | 'date'>`:
  - `weight_reps`: `topWeightKg` = max weight above 0, `e1rmKg` = max estimated 1RM, `volumeKg` = `Σ weight × reps` of sets with a weight (null when no set has a weight), `reps` = max reps;
  - `reps`: only `reps`;
  - `time`: only `durationSec`;
  - `distance`: only `distanceM`;
  - every other field is null.
- `METRICS_BY_TRACKING`: `weight_reps` → `['e1rmKg', 'topWeightKg', 'volumeKg']`, `reps` → `['reps']`, `time` → `['durationSec']`, `distance` → `['distanceM']`. The first one is the default.
- `RECORDS_BY_TRACKING`: `weight_reps` → heaviest_weight, best_e1rm, most_reps, best_volume (in this order). `reps` → most_reps. `time` → longest_duration. `distance` → longest_distance.
- `recordsOf(trackingType, sessions: { sessionId; date; startedAt; sets: MetricSet[] }[]): ProgressRecord[]`:
  - Walk the sessions in `startedAt` order. Replace a record only when the new value is strictly better. Thus the earlier session keeps a tie.
  - `most_reps` compares `(reps, weightKg ?? 0)`: more reps wins, and with equal reps the heavier set wins.
  - A `weight_reps` set with a null weight counts only for `most_reps`.
  - A record type with no value is left out.
- `bestsOf(trackingType | null, sets): Bests` (with `null`, it computes every field from the values present) and `mergeBests(a: Bests | null, b: Bests | null): Bests | null` (field-wise best; null + null = null).
- `newRecordsOf(trackingType, exerciseId, baseline: Bests | null, sets): NewRecord[]`:
  - `baseline === null` (no earlier history) → `[]` (AC3, first session).
  - A record is new when the session value is strictly better than the baseline field. A null baseline field with a session value counts as new.
- `rangeStart(today, range): string | null`: `1m`/`3m`/`6m`/`1y` → `today` minus 1/3/6/12 calendar months, plus 1 day. `all` → null. Clamp the day to the month end (31 March minus 1 month → 28 or 29 February).

### Local database — `src/services/local-db/db.ts`

No Dexie version change: no index changes.

- `LocalLastPerformance` and `localLastPerformanceSchema` gain `bests: Bests | null` (`bestsSchema.nullable().default(null)`, so older rows parse).
- `LocalSession` and `localSessionSchema` gain `newRecords: NewRecord[] | null` (`z.array(newRecordSchema).nullable().default(null)`). This field is local only. Never send it to the server. `null` means "not computed on this device".

## 4. API

Add the rows and sections to `docs/tech/API.md`.

### `GET /api/v1/progress/exercises`

- Auth required. No query parameters.
- Response 200: `{ items: [{ exerciseId, name, trackingType, thumbnailUrl, lastTrainedAt }], month: { workouts, volumeKg } }`.
  - `items`: each exercise with at least one counted set of the user, ordered by `lastTrainedAt` desc, then `exerciseId`. `lastTrainedAt` is the latest `startedAt` (ISO) of a completed session with a counted set. `name` uses the request locale, with the other locale as the fallback (`translationJoins`). An exercise that the user cannot see any more (`deleted_at` set) is left out.
  - `month.workouts`: completed sessions whose start date in the profile zone is in the current calendar month, up to today.
  - `month.volumeKg`: `Σ weight × reps` of the counted sets in those sessions, for `weight_reps` exercises and sets with a weight. Round to 0.01.
- Errors: 404 `PROFILE_NOT_FOUND` with no profile (the calendar service does the same).
- Two queries, whatever the number of exercises. `Cache-Control: private, no-store` (the `json` helper default).

### `GET /api/v1/progress/exercises/{id}?range=1m|3m|6m|1y|all`

- Auth required. `id` is a UUID. `range` defaults to `3m`. Another value gives 400 `VALIDATION_FAILED`.
- Response 200: `{ trackingType, points, records }`.
  - `points`: one point per completed session with a counted set of the exercise, with `date` in `[rangeStart(today, range), today]`, ordered by `startedAt` asc. Each point is `pointOf()` plus `sessionId` and `date`.
  - `records`: `recordsOf()` over all sessions, not only the range.
  - An exercise with no counted set gives `points: []` and `records: []`.
- Errors: 404 `EXERCISE_NOT_FOUND` when the exercise does not exist, is deleted, or is another user's own exercise.
- Three queries: the profile, the exercise, and the sets.

### `GET /api/v1/exercises/{id}/last-performance` (change)

- The response gains `bests`: `bestsOf()` over all counted sets of the exercise, or null when there is no completed session with a counted set. One more query.

All three are reads. No idempotency work (`request-safety.md`).

## 5. Server

### `src/server/progress/` (new domain)

- `queries.ts` (`import 'server-only'`):
  - `listTrainedExerciseRows(db, userId, locale)`: one SQL statement. It groups the counted sets by `l.exercise_id` with `max(s.started_at)`, joins `exercise e` (`e.deleted_at is null`, `e.owner_id is null or e.owner_id = userId`) and `translationJoins(locale)`, and returns `id`, `name` (`coalesce(tr.name, tf.name)`), `tracking_type`, `media`, `last_trained_at`.
  - `monthTotalsRow(db, userId, timeZone, monthStart, today)`: one statement. `count(distinct s.id)` and `coalesce(sum(l.weight_kg * l.reps) filter (where e.tracking_type = 'weight_reps' and l.weight_kg is not null), 0)`, over completed sessions where `(s.started_at at time zone ${timeZone})::date between monthStart and today`, with a left join to the counted sets and `exercise`.
  - `listExerciseSetRows(db, userId, exerciseId)`: one statement. Every counted set of the exercise: `session_id`, `started_at`, `weight_kg`, `reps`, `duration_sec`, `distance_m`, ordered by `s.started_at, s.id, l.completed_at, l.set_index`. It uses `set_log_exercise_idx`.
  - Every statement filters `s.user_id = userId`, `s.status = 'completed'` and `l.deleted_at is null`.
- `service.ts`:
  - `listProgressExercises(userId, locale, db = getDb())`: load the profile (`findProfileRow`, else `DomainError('PROFILE_NOT_FOUND')`), `today = todayIn(timeZone)`, `monthStart = today.slice(0, 8) + '01'`. Run the two queries. Map the thumbnails with `resolveFrames` from `src/server/exercises` (export it from there if needed; first frame thumb). Return the response.
  - `getExerciseProgress(userId, exerciseId, range, db = getDb())`: load the profile and `findExerciseRow` (visibility as the catalog: system or own, not deleted; else `DomainError('EXERCISE_NOT_FOUND')`). Load the sets, group them by session, convert `started_at` to the date in the profile zone (`dateIn(timeZone, startedAt)` from `src/lib/dates`, or add it there), build `points` with `pointOf()` filtered by `rangeStart()`, and `records` with `recordsOf()`.
  - Convert `numeric` strings with the existing `toNumber` helper.
- `__tests__/service.test.ts`: see Tests.

### `src/server/sessions/` (change)

- `queries.ts`: no change.
- `service.ts` `getLastPerformance` also calls `listExerciseSetRows` from `src/server/progress/queries.ts`. It returns `bests: bestsOf(null, rows)`, or null when `item` is null.
- `bestsOf(null, sets)` computes every field with no tracking-type filter. The fields that do not apply stay null, because the set values for them are null. Thus no extra query loads the tracking type.

### Route handlers (thin, `withHandler`)

- `src/app/api/v1/progress/exercises/route.ts`: `GET`, `auth: 'required'`, locale from `requestLocale(request)`, calls `listProgressExercises`.
- `src/app/api/v1/progress/exercises/[id]/route.ts`: `GET`, `params: exerciseIdParamsSchema`, `query: progressQuerySchema`, calls `getExerciseProgress`.
- Map `EXERCISE_NOT_FOUND` and `PROFILE_NOT_FOUND` to 404 in `src/server/http/errors.ts` if they are not there yet.

## 6. Client

### Dependencies

- `pnpm add recharts`, then `pnpm dlx shadcn@latest add chart`. This creates `src/components/ui/chart.tsx`. Keep the generated file as it is, apart from lint fixes.

### API module — `src/api/progress.ts` (new)

- `progressKeys = { all: ['progress'], exercises: () => [...all, 'exercises'], exercise: (id, range) => [...all, 'exercise', id, range] }`.
- `fetchProgressExercises()`, `fetchExerciseProgress(id, range)` through `http()` with the response schemas.
- `useProgressExercisesQuery({ enabled })` and `useExerciseProgressQuery(id, range, { enabled })`: `staleTime: 5 * 60_000` and `gcTime: 24 * 60 * 60_000`. Thus a range opened before shows at once, and it stays in memory while the app is open (AC9). `enabled: Boolean(id)` for the second one.
- `src/api/sessions.ts`: `fetchLastPerformance` returns `{ item, bests }` (the whole response). Update its callers.
- Finishing a session must make `/progress` fresh: in the finish path (the `finish` caller in `ActiveSession`), call `queryClient.invalidateQueries({ queryKey: progressKeys.all })` after `repository.finish`.

### Local data — `src/services/local-db/`

- `last-performance.ts` `prefetchLastPerformance`: store `bests` with the item. When `item` is null, delete the row as now.
- New `records.ts`:
  - `localBaseline(db, exerciseId, excludeSessionId): Promise<Bests | null>` = `mergeBests(stored.bests, bestsOf(null, sets of local completed sessions, other than excludeSessionId, with deletedAt = null))`. It returns null when both parts are empty.
  - `rememberNewRecords(db, sessionId)`: for each `session.exercises` entry with live sets, group the live sets by `exerciseId`. Then `newRecordsOf(trackingType, exerciseId, await localBaseline(...), sets)`. Write the flat list to the session row with `db.sessions.update(sessionId, { newRecords })`. Do not add an outbox entry.
- `session-repository.ts`:
  - `finish()`: after the status patch, call `rememberNewRecords(db, sessionId)` **before** `rememberLastPerformance(db, sessionId)`. The reason is that `rememberLastPerformance` overwrites the stored row.
  - `rememberLastPerformance`: write `bests: mergeBests(previousBaseline, bestsOf(null, sets))` for each exercise, so the stored bests stay current after the finish.
  - `importRemote()`: keep `existing?.newRecords ?? null`.
  - `start()` and any other `db.sessions.put` of a new row: set `newRecords: null`.
- Export `rememberNewRecords` only if a test needs it. `index.ts` exports nothing new for the UI.

### Session summary — `src/features/session/ActiveSession/`

- New `NewRecords.tsx`, rendered by `SessionSummary.tsx` between the `dl` of numbers and the exercise list.
  - Hidden when `session.newRecords` is null or empty.
  - Heading `h2` "Нові рекорди" (`text-base font-bold`), then one `ul` card (`rounded-lg bg-card divide-y divide-border`).
  - A row (`min-h-16`, `px-3.5 py-2.5`, `flex items-center gap-3`): `RecordIcon` (24px, `text-accent`, `aria-hidden`), then a column with the exercise name (16/700) over the record name (14px, muted), then the value on the right (15/600, `tabular-nums`). The exercise name comes from `session.exercises` by `exerciseId`.
  - Format the value with `formatRecordValue` from `@/features/progress`.

### Progress feature — `src/features/progress/` (new)

```text
features/progress/
├── ProgressScreen/ProgressScreen.tsx   # 'use client' entry
├── ProgressScreen/index.ts
├── MonthNumbers/MonthNumbers.tsx
├── ExerciseSelector/ExerciseSelector.tsx
├── ExerciseSelector/ExercisePickerSheet.tsx
├── ProgressChart/ProgressChart.tsx      # card, header, states, range control
├── ProgressChart/LineChartView.tsx      # Recharts part, loaded with next/dynamic
├── RecordList/RecordList.tsx
├── ProgressStates/ProgressStates.tsx    # skeleton, error, empty
├── utils.ts                             # formatRecordValue, formatMetricValue, chartSummary
├── index.ts                             # ProgressScreen, formatRecordValue
└── __tests__/
```

#### Route

- `src/app/[lang]/(app)/progress/page.tsx`: keep `generateMetadata`. Render `<PageHeader sectionTitle title={t('Progress')} />` and `<Suspense><ProgressScreen /></Suspense>` (the screen reads `useSearchParams`). Remove the placeholder `EmptyState`.

#### `ProgressScreen` (board `PMain`)

- Data: `useProgressExercisesQuery({ enabled: online })`, where `online = useIsOnline()`.
- The selected exercise: `?exercise=<id>` if it is in `items`, else `items[0]`. A change calls `router.replace('/progress?exercise=<id>', { scroll: false })`.
- `range` and `metric` are `useState` (`'3m'`, and the first metric of the tracking type). A change of exercise resets `metric` to the default of the new type.
- `useExerciseProgressQuery(selectedId, range, { enabled: online && Boolean(selectedId) })`.
- States, in this order:
  1. exercises query pending and online → `ProgressSkeleton`;
  2. exercises query error with no data → `ProgressError` ("Не вдалося завантажити прогрес.", "Спробувати ще раз" calls `refetch`);
  3. no data and offline → the offline notice in the chart card position ("Потрібен інтернет", `WifiOff`), as `role="status"`;
  4. `items` empty → `ProgressEmpty`;
  5. else the screen.
- Layout, mobile: one column, `gap-3.5`: `MonthNumbers`, `ExerciseSelector`, the metric switch (only when the type has more than one metric), `ProgressChart`, `RecordList`.
- Layout, desktop (`lg`): the `PageHeader` shows the visible `h1` (existing behaviour). Then a grid `lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6`, `max-w-[1040px]`. The left column has the selector, the metric switch and the chart. The right column has `MonthNumbers` and `RecordList`.

#### `MonthNumbers`

- A `dl` with 2 columns (`grid grid-cols-2 gap-4`), `py-3.5`, `border-y border-border-strong`. Each item is `flex flex-col-reverse gap-0.5`: `dt` 14px muted, `dd` `text-2xl font-extrabold tabular-nums`. The same style as the summary numbers.
- Values: `month.workouts`, and `t('{{value}} kg', { value: formatNumber(locale, volumeKg, { maximumFractionDigits: 0 }) })`.
- On desktop, it sits in a card (`rounded-lg bg-card px-4`) at the top of the right column, with no `border-y`.

#### `ExerciseSelector` and `ExercisePickerSheet`

- The selector is a `button` with `aria-haspopup="dialog"`, `rounded-lg bg-card p-3 min-h-[72px] flex items-center gap-3 text-left w-full`:
  - `ExerciseImage` or `img` thumbnail 48×48, `rounded-[3px] object-cover` (use the existing thumbnail component of the catalog rows if one fits);
  - the name (16/700, `truncate`) over "Востаннє {{date}}" (14px, muted). `date` is `weekday in the locative case + day month`: reuse the date helpers in `src/features/plan/formatPlanDate.ts` (it already formats "в понеділок, 16 листопада" for spec 12 copy). If no helper fits, add `lastTrainedText(t, locale, date)` there;
  - "Змінити" (14/600, muted) and `ChevronDown` (20px, muted).
- The sheet uses `ui/sheet`: bottom on mobile, right side on desktop (the same as other sheets in the app). Title "Вправа".
  - A search `Input` with the label "Пошук вправи" (visually hidden label, placeholder the same). It filters `items` by `name`, case-insensitive, with `normalizeSearch` rules if a client copy exists, else `toLocaleLowerCase(locale).includes()`.
  - The list: rows like the spec 12 history rows (thumbnail, name, "Востаннє …"), each a `button` with `aria-pressed` for the selected one and a `Check` icon. A tap selects and closes the sheet.
  - No match: "Нічого не знайдено" (14px, muted, centred, `role="status"`).

#### Metric switch

- The existing `SegmentedControl` component with 3 options: "Оцінка 1ПМ" (`e1rmKg`), "Вага" (`topWeightKg`), "Обʼєм" (`volumeKg`). `aria-label` "Показник" / "Metric". Hidden for the other types.

#### `ProgressChart`

- A `figure`, `rounded-lg bg-card p-4 flex flex-col gap-3`.
- Header: a flex row, `items-end justify-between`.
  - Left: "{{metric}} зараз" (14px, muted) over the latest value (`text-2xl font-extrabold tabular-nums`). `metric` is the metric name: "Оцінка 1ПМ", "Вага", "Обʼєм", "Повторення", "Час", "Дистанція".
  - Right: the change (14/600, tabular) and " за {{range}}" (14px, muted). `change = last − first` of the points in the range, with a `+` sign when it is above 0 and "−" when below. `range` text: "1 місяць", "3 місяці", "6 місяців", "1 рік", "весь час" (use i18next plurals for months).
  - With 0 points: the value is "—" and there is no change. With 1 point: the change is "—".
- Plot area, `h-[196px]`:
  - 0 points: "Немає тренувань за цей період." (14px, muted, centred).
  - Offline and the query has no data: `WifiOff` and "Потрібен інтернет".
  - Query error: "Не вдалося завантажити прогрес." with "Спробувати ще раз".
  - Pending: a `Skeleton` of the plot size.
  - Else `LineChartView`, loaded with `next/dynamic(() => import('./LineChartView'), { ssr: false, loading: () => <Skeleton … /> })`.
  - The plot wrapper has `role="img"` and `aria-label={chartSummary(...)}` (AC8). Example (uk): "Оцінка 1ПМ, Жим штанги лежачи: 102,1 кг 16 листопада, +10,1 кг за 3 місяці, 13 тренувань." The Recharts SVG inside gets `aria-hidden`.
- `LineChartView` (Recharts through `ChartContainer` from `ui/chart`):
  - `LineChart` with `data = points` mapped to `{ x: date, y: value }`, filtering out null values.
  - `Line` `type="linear"`, `stroke="var(--accent)"`, `strokeWidth={2}`, `strokeLinejoin="round"`, `isAnimationActive={false}` (no motion rule).
  - `dot`: a custom render. A 7px square rotated 45° with a 1px radius, `fill="var(--card)"`, `stroke="var(--accent)"`, `strokeWidth={1.5}`. The last point is a 12px filled accent diamond with a 2px radius. One point alone: only the 12px diamond.
  - `CartesianGrid` horizontal only, `stroke="var(--border)"`.
  - `YAxis` `orientation="right"`, 4 ticks, nice rounded domain, `tickLine={false}`, `axisLine={false}`, 12px muted tabular figures, width 36.
  - `XAxis` `dataKey="x"`, `type="category"`, ticks only at the first point of each month, formatted as the short month name ("серп", "вер"; `Intl.DateTimeFormat(locale, { month: 'short' })` without the dot). 12px muted. For `1m`, ticks at each point as "16 лист".
  - No `Tooltip`, no legend.
- Range control under the plot: `SegmentedControl` with 5 options "1М 3М 6М 1Р Все" (en "1M 3M 6M 1Y All"), `aria-label` "Період" / "Range".

#### `RecordList`

- Heading `h2` "Рекорди" (16/700), then one `ul` card with divided rows. A row is a `Link` to `/session/<sessionId>` (`sessionHref` from the session feature):
  - `min-h-16 flex items-center gap-3 py-2.5 pr-2 pl-3.5`, focus ring as the history rows;
  - `RecordIcon` 24px `text-accent`;
  - the record name (16/700) over the date line (14px, muted): `dayMonth(locale, date)`, and for `best_e1rm` also ", {{weight}} кг × {{reps}}";
  - the value (15/600 tabular) and `ChevronRight` (20px, muted).
- With no records (an exercise from `items` always has one): render nothing.

#### `ProgressStates`

- `ProgressSkeleton`: `aria-busy="true"`, `aria-label` "Прогрес": a 72px bar for the numbers, a 72px card for the selector, a 300px card for the chart, and one card with three 64px rows.
- `ProgressError`: reuse `CalendarError` from `@/features/calendar/CalendarStates` with the message "Не вдалося завантажити прогрес.".
- `ProgressEmpty`: the spec 12 `HistoryList` empty card: a dashed `--planned` diamond (`Diamond tone="planned" variant="outline"` with `border-dashed`), the `h2` "Ще немає прогресу" (20/800), the sentence, and a primary `Button` "Почати тренування" that calls `useOpenStartSheet()`. `w-full sm:w-auto`.

#### Value formatting — `utils.ts`

- `formatMetricValue(t, locale, metric, value)`: kg values with `formatNumber(locale, v, { maximumFractionDigits: 1 })` and `t('{{value}} kg')`; reps as a number; duration `t('{{value}} s')`; distance `t('{{value}} m')` below 1000, else `t('{{value}} km')` with 2 fraction digits. These are the spec 10 summary formats.
- `formatRecordValue(t, locale, record)`: `most_reps` with a weight → `t('{{reps}} × {{weight}}', …)` ("12 × 60 кг"); without a weight → reps. Others as `formatMetricValue`.
- `chartSummary(...)` builds the AC8 label.

### Exercise details — `src/features/exercises/ExerciseDetails/ExerciseDetails.tsx`

- Read `useProgressExercisesQuery({ enabled: online })`. When `items` has `exercise.id`, add a secondary `Link` button (`buttonVariants({ variant: 'secondary' })`) "Переглянути прогрес" with the lucide `TrendingUp` icon, to `/progress?exercise=<id>`, in the actions row.

### Offline summary

- `/progress` needs the network for new data. Cached views come from the in-memory query cache. The cache is not persisted, so a reload offline shows "Потрібен інтернет".
- The summary records work offline (local data only).

### Accessibility

- Every interactive element is a real `button` or `a`, at least 44px tall.
- The metric and range controls use `aria-pressed` (the `SegmentedControl` behaviour).
- The chart has the text summary. Colour is never the only signal: the last point is also larger.

## 7. Copy

Add each key to `src/i18n/locales/en.json` and `uk.json`. Keys are the English strings.

| Key (en) | uk |
| --- | --- |
| No progress yet | Ще немає прогресу (exists in en; check uk) |
| Finish your first workout to see your strength charts here. | Заверши перше тренування, і тут зʼявляться графіки сили. |
| Start workout | Почати тренування (existing) |
| Workouts this month | Тренувань цього місяця |
| Volume this month | Обʼєм цього місяця |
| Last trained {{date}} | Востаннє {{date}} |
| Change | Змінити |
| Exercise | Вправа |
| Search exercises | Пошук вправи (existing key; check the uk value) |
| Nothing found | Нічого не знайдено |
| Metric | Показник |
| Range | Період |
| Estimated 1RM | Оцінка 1ПМ |
| Weight | Вага (existing key; check) |
| Volume | Обʼєм (existing) |
| Reps | Повторення |
| Time | Час |
| Distance | Дистанція |
| {{metric}} now | {{metric}} зараз |
| {{change}} over {{range}} | {{change}} за {{range}} |
| {{count}} month (plural) | {{count}} місяць / місяці / місяців |
| 1 year | 1 рік |
| all time | весь час |
| 1M / 3M / 6M / 1Y / All | 1М / 3М / 6М / 1Р / Все |
| No workouts in this period. | Немає тренувань за цей період. |
| Couldn't load progress. | Не вдалося завантажити прогрес. |
| Try again | Спробувати ще раз (existing) |
| Needs internet | Потрібен інтернет (existing) |
| Records | Рекорди |
| Heaviest weight | Найбільша вага |
| Most reps | Найбільше повторень |
| Best volume | Найбільший обʼєм |
| Longest time | Найдовший час |
| Longest distance | Найбільша дистанція |
| {{date}}, {{weight}} × {{reps}} | {{date}}, {{weight}} × {{reps}} |
| {{reps}} × {{weight}} | {{reps}} × {{weight}} |
| New records | Нові рекорди |
| View progress | Переглянути прогрес |
| {{metric}}, {{exercise}}: {{value}} {{date}}, {{change}} over {{range}}, {{count}} workouts | {{metric}}, {{exercise}}: {{value}} {{date}}, {{change}} за {{range}}, {{count}} тренувань (plural forms) |

If a key exists with another meaning, add a context (`t('Change', { context: 'exercise' })`) instead of reusing it.

## 8. Steps

Each step ends in a state where `pnpm typecheck` passes.

1. **Schemas and metrics.** Create `src/shared/schemas/progress.ts` and `src/shared/progress/metrics.ts`. Add `bests` to `lastPerformanceResponseSchema`. Write `src/shared/progress/__tests__/metrics.test.ts`.
2. **Server progress domain.** Create `src/server/progress/queries.ts` and `service.ts`, and export `resolveFrames` from the exercises domain if needed. Add the error codes to `src/server/http/errors.ts`. Write `src/server/progress/__tests__/service.test.ts`.
3. **Routes.** Create `src/app/api/v1/progress/exercises/route.ts` and `[id]/route.ts` with tests in `src/app/api/v1/progress/__tests__/route.test.ts`.
4. **Last performance bests.** Change `getLastPerformance` in `src/server/sessions/service.ts`. Extend the existing last-performance test in `src/app/api/v1/sessions/__tests__/route.test.ts`.
5. **API docs.** Update `docs/tech/API.md` (two rows in the table, the endpoint sections, the `last-performance` change) and `docs/tech/DATA_MODEL.md` "Derived values" (records and the tie rule).
6. **Client API.** Create `src/api/progress.ts`. Change `fetchLastPerformance` to return `{ item, bests }` and update `prefetchLastPerformance`.
7. **Local DB.** Add `bests` and `newRecords` to `db.ts`. Create `src/services/local-db/records.ts`. Change `finish`, `rememberLastPerformance`, `importRemote` and the new-row writes in `session-repository.ts`. Write `src/services/local-db/__tests__/records.test.ts`.
8. **Summary row.** Create `NewRecords.tsx` and render it in `SessionSummary.tsx`. Invalidate `progressKeys.all` after finish. Extend the summary test.
9. **Dependencies.** `pnpm add recharts`, `pnpm dlx shadcn@latest add chart`.
10. **Progress feature.** Create the `src/features/progress/` files in this order: `utils.ts`, `ProgressStates`, `MonthNumbers`, `RecordList`, `ExerciseSelector` with the sheet, `ProgressChart` with `LineChartView`, `ProgressScreen`. Replace the page content in `src/app/[lang]/(app)/progress/page.tsx`.
11. **Copy.** Add every key to `en.json` and `uk.json`.
12. **Exercise details link.** Change `ExerciseDetails.tsx`.
13. **Component tests.** `src/features/progress/__tests__/ProgressScreen.test.tsx`.
14. **e2e.** Add `insertCompletedSessionWithSets(email, workoutId, { startedAt, scheduledFor?, sets: [{ exerciseId, weightKg, reps, durationSec, distanceM }] })` to `e2e/helpers/plan.ts` (one insert for the session, one for all its sets). Create `e2e/13-progress-strength.spec.ts`. Use `test.slow()` and 20 s timeouts for network steps, as `e2e/12-history-adherence.spec.ts` does. Use IP range `198.18.13`.
15. Run `pnpm lint`, `pnpm typecheck` and the touched test files.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/shared/progress/__tests__/metrics.test.ts`: `estimateOneRepMax` (87.5 × 5 = 102.0833…, 13 reps → null, 0 kg → null, null weight → null); `pointOf` for each tracking type with hand-computed values; `rangeStart` for each range, including 31 March − 1 month. `src/server/progress/__tests__/service.test.ts`: a fixture of 4 sessions gives the expected points and `date` in the profile zone (a session at 23:30 UTC is the next day in `Europe/Kyiv`). |
| AC1 | `src/app/api/v1/progress/__tests__/route.test.ts`: 400 for `range=2w`; 404 for another user's own exercise; 404 for a random UUID. |
| AC2 | `metrics.test.ts`: `recordsOf` picks the heaviest set and its session. `service.test.ts`: the `heaviest_weight` record has the session id and date. `ProgressScreen.test.tsx`: the record row is a link to `/session/<id>`. `src/features/session/ActiveSession/__tests__/SessionSummary.test.tsx` (or the existing summary test file): a session with `newRecords` shows "New records" and the row. |
| AC2 | `e2e/13-progress-strength.spec.ts`: two completed sessions by DB, then a third session through the UI with a heavier set; the summary shows "New records" with "Heaviest weight"; `/progress` shows the record with its date, and the row opens the session. |
| AC3 | `metrics.test.ts`: `newRecordsOf` with a null baseline gives `[]`; an equal value is not new; equal reps with a heavier weight is a new `most_reps`. `records.test.ts`: the first finished session of an exercise stores `newRecords: []`. |
| AC4 | `src/services/local-db/__tests__/records.test.ts`: with a stored `bests` and one local completed session, finishing a session with a better set stores the new record, with no network mock called. Also: `rememberLastPerformance` keeps the merged bests. |
| AC5 | `ProgressScreen.test.tsx`: empty `items` shows "No progress yet" and "Start workout", which calls the Start sheet opener; with items, the selector shows the first item and the sheet lists them in order. `service.test.ts`: `items` order by `lastTrainedAt`, and an exercise with only deleted sets is left out. |
| AC6 | `ProgressScreen.test.tsx`: a `time` exercise shows no "Metric" group and one record row. `metrics.test.ts`: `RECORDS_BY_TRACKING` and `pointOf` for `reps`, `time`, `distance`. |
| AC7 | `service.test.ts`: an abandoned session, an in-progress session and a deleted set log in the fixture change no point and no record. |
| AC8 | `ProgressScreen.test.tsx`: the chart has `role="img"` with the expected label (latest value, date, change, count). `metrics.test.ts` or `utils` test for `chartSummary` with 0 and 1 points. |
| AC9 | `ProgressScreen.test.tsx`: switch 3M → 6M → 3M; `fetchExerciseProgress` is called twice, not three times. Then set offline (`navigator.onLine` false and the `offline` event) and switch to 6M: the cached chart shows. |
| AC10 | `service.test.ts` in `Europe/Kyiv`: sessions on the first day of the month at 00:30 local time, on the last day of the previous month, and one abandoned session; `month.workouts` and `month.volumeKg` match. |
| AC11 | `e2e/13-progress-strength.spec.ts`: `/progress` in en and uk (dark) has no horizontal scroll on both projects; the empty state test for a new user. |

Server tests assert a constant query count for `listProgressExercises` with 1 and 5 trained exercises (the `logger.logQuery` counter, as `src/server/calendar/__tests__/service.test.ts` does).

## 10. Risks and open questions

- **Recharts in browser tests.** `ResponsiveContainer` needs a measured size. Give the chart container a fixed height, and in component tests assert the `role="img"` label, not the SVG.
- **Bundle size.** Recharts is about 100 KB gzip. The dynamic import keeps it off other routes. Check that `/progress` still passes the Lighthouse budget in CI.
- **Stale baseline offline.** A session done on another device and not on this one is not in the local baseline. Then the summary can show a false new record. The spec accepts this; spec 16 pull sync reduces it.
- **Old summaries.** Sessions finished before this release, or on another device, have `newRecords = null` and show no row (lead's decision).
- **Large history.** `listExerciseSetRows` reads all sets of one exercise. At 2 sessions a week and 5 sets, that is about 520 rows a year. This is fine. If it becomes slow, move the aggregation to SQL.
- **Month boundary.** `month.workouts` uses the start date in the profile zone. A session that starts at 23:50 on the last day of a month counts in that month.
- **Swap (18).** Records follow `set_log.exerciseId`. Spec 18 must keep this rule.
- **Body metrics (14).** Spec 14 can reuse `ui/chart` and the diamond dot render.

No open question blocks the implementation.

## 11. Implementation notes

- `PROGRESS_RANGE`, `RECORD_TYPE`, the metric lists and the cache times live in `src/constants/progress.ts`, not in the schema file. This follows `code-organization.md`.
- `estimateOneRepMax` rounds to 0.01 kg. Without rounding, float noise gave values such as 110.00000000000001 in the API, and equal sets could fail the tie rule.
- `getExerciseProgress` also takes the locale, because `findExerciseRow` needs it. The services run their queries one after another: parallel queries hung on the single-connection client of the query-count test.
- `lastPerformanceResponseSchema.bests` has `.default(null)`, so an older response without the field still parses.
- `/progress` is invalidated when the outbox sends the PATCH that completes a session (`onSent` in `flushOutbox`, used by `useOutboxRunner`), not right after `finish`. The reason is that the server has no new data until the outbox sends the finish.
- `rememberNewRecords` returns the bests after the session, and `rememberLastPerformance` stores them. Thus the stored bests stay current on the device.
- Copy changes:
  - "{{change}} over {{range}}" became the change value plus a separate muted "over {{range}}" ("за {{range}}").
  - "Search exercise" ("Пошук вправи") is a new key, because "Search exercises" already means "Пошук вправ".
  - "Metric" and "Reps" use the `chart` context, because both keys already exist with another meaning.
  - The uk value of "No progress yet" is now "Ще немає прогресу". The old placeholder sentence key was removed.
- The metric switch and the range control use the existing `SegmentedControl` (radio inputs) with the `quiet` look, so they expose checked radios, not `aria-pressed`.
- Browser tests load no Tailwind CSS, so the chart plot has no height there. The component tests assert the chart by its accessible name, not its visibility.
- Test helpers: `src/test/progress-fixtures.ts` (server) and `insertCompletedSessionWithSets` in `e2e/helpers/plan.ts`.
- Fixes after the review of 2026-11-17 (findings 1–4 and 6):
  - The records card uses the records of any cached range of the same exercise while a range loads or is offline (`cachedExerciseRecords` in `src/api/progress.ts`). The reason is that records are all-time values.
  - The desktop grid has `grid-rows-[auto_1fr]`. Thus the records stay under the month numbers.
  - The metric switch uses less label padding and no wrap. "Estimated 1RM" then fits on one line at 390 px.
  - `chartSummary` is in `utils.ts`, with tests for 0, 1 and 2 points. It takes `formatDate` from the caller. The reason is that `utils.ts` is on the server path of the page, and the plan feature index loads client components.
  - With one point, the chart label has no change part. This needs a new copy key: "{{metric}}, {{exercise}}: {{value}} {{date}}, {{count}} workouts" (uk "… {{count}} тренувань").
- Finding 5 stays as it is: a record type with no baseline value counts as new (lead's decision, see `DECISIONS.md`).

## 12. Review — 2026-11-17

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `metrics.test.ts`, `service.test.ts`. The walk shows correct values: e1RM 102.1 kg for 87.5 kg × 5, and volume 1 430 kg for 77.5 × 8 + 67.5 × 12. `AC1-*-metric-*.png`, `AC1-*-range-*.png` |
| AC2 | Pass | e2e AC2 test. The summary showed "Heaviest weight 90 kg", and the record row opened the session. `AC2-*-main.png`, `AC2-*-summary-new-records.png`, `AC2-*-record-opens-session.png` |
| AC3 | Pass | `metrics.test.ts`, `records.test.tsx`. A tie session (90 × 3 again) showed no "New records" row. `AC3-desktop-summary-tie.png` |
| AC4 | Pass | `records.test.tsx`. A session finished offline showed "Heaviest weight 95 kg" and "Estimated 1RM 101.3 kg". `AC4-*-summary-offline.png` |
| AC5 | Pass | `ProgressScreen.test.tsx`, e2e AC5 test. The sheet order was Bench Press > Plank > Back Squat, and "Start workout" opened the Start sheet. `AC5-*-empty*.png`, `AC5-*-selector-*.png` |
| AC6 | Pass | `ProgressScreen.test.tsx`. Plank shows "Time now", no metric switch and one record. `AC6-*-time-exercise.png` |
| AC7 | Pass | `service.test.ts` (abandoned, in-progress and deleted sets) |
| AC8 | Pass | `ProgressScreen.test.tsx`. The label in the walk was "Оцінка 1ПМ, Жим штанги лежачи: 99 кг 17 листопада, +0,8 кг за 3 місяці, 7 тренувань". See finding 4 for one point. |
| AC9 | Pass | `ProgressScreen.test.tsx`. Offline, the cached 3M view showed, and the 1Y view showed "Needs internet". `AC9-*-offline-*.png`. See finding 1. |
| AC10 | Pass | `service.test.ts` (Kyiv month edges). The walk showed 4 workouts and 2 665 kg, the same as the hand-computed values. |
| AC11 | Pass | The e2e tests and the walk: en and uk, light and dark, 390 and 1440. The walk found 0 px of horizontal overflow in every screenshot. `AC11-*.png`. See findings 2 and 3. |

### Findings

1. [major] The records card disappears while a range loads, and it also disappears offline for a range that is not cached — `src/features/progress/ProgressScreen/ProgressScreen.tsx:99`. Records are all-time values, but they come from the query for one range. A range change online removes the card until the response arrives, and the page jumps. Offline, the 1Y view shows no records although the screen already has them (`AC9-mobile-offline-not-cached.png`). The spec says that the range changes only the chart. A possible fix is to keep the last records of the same exercise, for example with `placeholderData` in `useExerciseProgressQuery` (`src/api/progress.ts:47`).
2. [minor] On desktop, a large gap separates the month numbers card from the records card — `ProgressScreen.tsx:67`. The right column uses two grid rows, and the left column spans both rows. Thus row 1 grows to the height of the chart, and the records start lower (`AC6-desktop-time-exercise.png`, `AC11-desktop-uk-dark.png`). The design puts the month numbers and the records in one column. One flex column on the right will remove the gap.
3. [minor] At 390 px in English, the metric switch wraps "Estimated 1RM" onto two lines — `ProgressScreen.tsx:77` (`AC2-mobile-main.png`, `UX-mobile-one-point.png`). The Ukrainian labels fit on one line.
4. [minor] With one point, the accessible label reads "…: 116.7 kg July 21, — over 6 months, 1 workout" — `src/features/progress/ProgressChart/ProgressChart.tsx:57`. A screen reader reads "— over 6 months", which has no meaning. Leave out the change part when the change is "—".
5. [minor] A record type that has no baseline value counts as new — `src/shared/progress/metrics.ts:287`. Example: an exercise with only bodyweight sets gets a "Heaviest weight" record on its first weighted session. Another example: an exercise with only sets above 12 reps gets an e1RM record on its first set of 12 reps or fewer. The spec makes only the first session of an exercise a baseline. It does not say what happens for one record type. This is a product question for the lead.
6. [minor] The plan puts `chartSummary` in `utils.ts` with a test for 0 and 1 points. The code builds the label inside `ProgressChart.tsx:57`, and no test covers 0 or 1 points. "Implementation notes" do not record this deviation.

### Checks

- lint: pass.
- typecheck: pass.
- tests: 765 of 766 passed in the full run. The one failure was `src/app/api/v1/me/profile/__tests__/route.test.ts` ("finishes onboarding with PUT…"): a foreign key error on the `profile` insert. This change does not touch that code. The file passes alone (6 of 6), so the failure is a flake of the parallel run. The spec 13 test files pass (124 of 124).
- e2e: `e2e/13-progress-strength.spec.ts` passed 6 of 6 (mobile and desktop).
- UI walk: a Playwright script in the scratchpad, at 390×844 and 1440×900. It saved 49 screenshots to `scratch/review/13-progress-strength/`.

### Out of scope

- `src/app/api/v1/me/profile/__tests__/route.test.ts` fails sometimes in the full parallel run (see Checks).
- Next.js shows a warning that `<html>` has `scroll-behavior: smooth` without `data-scroll-behavior="smooth"`.
- On Today, the "Start workout" button in the desktop side bar did not appear for a third start on the same day. The walk used a new user for AC4 because of this. Spec 10 or 12 owns this behaviour. Examine it there.
