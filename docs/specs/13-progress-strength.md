# 13. Strength progress

## Goal

Users see whether they are getting stronger: per-exercise trends and personal records.

## User stories

- As a lifter, I want to see how an exercise changes over time, so that I know if I get stronger.
- As a lifter, I want to see my personal records with their dates, so that I know my best results.
- As a lifter, I want the session summary to show my new records, so that I see progress at once.

## Scope

### Data rules

- Only completed sessions count. In-progress and abandoned sessions and deleted set logs do not count.
- A set counts for the exercise that the user performed (`set_log.exerciseId`).
- Units are kg only, as in specs 09 and 10.
- "Today", the session date and the month use the profile time zone.
- A session gives one chart point per exercise, on the date it started.
- Records are all-time values. The range changes only the chart.
- If two sessions have the same best value, the earlier session keeps the record.
- Unilateral sets count as logged. Volume is `weight × reps` per set with no doubling, the same as the spec 10 summary.

### Metrics by tracking type

| Tracking type | Chart metrics | Records |
| --- | --- | --- |
| `weight_reps` | estimated 1RM (default), top set weight, session volume | heaviest weight, best estimated 1RM, most reps in one set, best session volume |
| `reps` | most reps in a set | most reps in one set |
| `time` | longest duration | longest duration |
| `distance` | longest distance | longest distance |

- **Estimated 1RM:** Epley `weight × (1 + reps / 30)`, only for sets with 1–12 reps and a weight above 0.
- **Top set weight:** the heaviest weight in the session.
- **Session volume:** `Σ weight × reps` of the sets with a weight.
- A `weight_reps` set with an empty weight counts only for "most reps in one set".
- "Most reps in one set" shows the weight of that set too, for example "12 × 60 kg". With equal reps, the heavier set wins.
- A tracking type with one metric shows no metric switch.

### `/progress`

- **Month numbers:** two plain numbers at the top: completed workouts and total volume in the current calendar month. They use the spec 10 summary number style, not cards.
- **Exercise selector:**
  - It lists only the exercises with at least one counted set, the most recently trained first.
  - It has a search by name.
  - The first visit selects the most recently trained exercise.
  - `/progress?exercise=<id>` opens that exercise.
- **Range:** 1M / 3M / 6M / 1Y / All. The default is 3M. Each range ends today.
- **Chart:** a line chart (Recharts through shadcn chart) of the selected metric. It has a metric switch for `weight_reps`.
- **Records:** a list of the records for the tracking type, each with its value and date. A record row links to `/session/<id>`.
- **Empty state:** with no counted set at all, the whole page shows the empty state with "Почати тренування". The button opens the Start sheet.
- **Range with no points:** the chart area says that there are no workouts in this range. The records stay visible.
- The exercise details page (spec 06) links to `/progress?exercise=<id>` when the exercise has history.

### Records in the session summary

- The spec 10 summary shows a "Нові рекорди" row between the numbers and the exercise list.
- A record is new when the session value is strictly better than the best value before this session.
- The first session of an exercise sets a baseline. It shows no new records for that exercise.
- The row lists each new record as the exercise name, the record name and the value.
- The row is hidden when the session has no new records.
- **Offline:** at session start, the client stores the current bests of each exercise in Dexie, next to `lastPerformance`. The summary compares with these bests, so it works offline.
  - Without network at start, the bests come from local completed sessions, as "last time" does in spec 10.
  - An exercise that has no stored bests shows no new records.

### Offline

- The views that the user opened before (exercise and range) come from the query cache.
- A view that is not cached shows "Потрібен інтернет" with the `WifiOff` line, as the spec 12 history list does.

## Out of scope

- Body metrics (14).
- Muscle-group volume heatmap (later).
- A rep-max table (best reps per weight, or best weight per rep count).
- Records of total reps, time or distance per session.
- Imperial units.
- Editing completed sessions and the records that would change after an edit.

## UX

- **States:** loading, error with retry, offline (cached view or notice), no history at all, a range with no points, an exercise with one point.
- **Mobile (390px)** and **desktop (1440px)** in en and uk, light and dark.
- The record marker is the custom "record" icon (`VISUAL_LANGUAGE.md`).

## Design

Canvas: https://claude.ai/artifact/W46zvMzmRFmY9yagZgxrs5, the row "Прогрес сили (спек 13)". The board has a `theme` tweak (light, dark).

| Board | Screen and state |
| --- | --- |
| `PMain` | `/progress`, mobile, a `weight_reps` exercise with data, range 3M |

The lead approved `PMain` and asked to plan without more boards. The other states below use the patterns of specs 10 and 12. `/review` checks them against this text.

The example data: today is Tuesday, 17 November 2026. The exercise is "Жим штанги лежачи", trained on Mondays.

### `/progress`, mobile (`PMain`)

From top to bottom, in one column with a 14px gap:

- **Top bar:** "Прогрес" as the section label. The `h1` is for screen readers only (2026-11-14 decision).
- **Month numbers:** a `dl` with two plain numbers in 2 columns, between two 1px `--border-strong` rules. The number is 24/800 with tabular figures, and the label (14px, muted) is under it. Example: "7" "Тренувань цього місяця", "21 340 кг" "Обʼєм цього місяця".
- **Exercise selector:** a card button, at least 72px tall, with `aria-haspopup="dialog"`:
  - a 48px thumbnail (3px radius);
  - the exercise name (16/700) over "Востаннє в понеділок, 16 листопада" (14px, muted);
  - "Змінити" (14/600, muted) and a chevron-down on the right.
- **Metric switch:** the `.seg` control with 3 parts: "Оцінка 1ПМ", "Вага", "Обʼєм". It shows only for `weight_reps`.
- **Chart card:** a `figure` in a card with 16px padding:
  - the header: "Оцінка 1ПМ зараз" (14px, muted) over the latest value (24/800). On the right is the change, "+10,1 кг" (14/600) and "за 3 місяці" (14px, muted);
  - the plot, 196px tall: a 2px `--accent` line with round joins. Each point is a 7px diamond with a 1.5px accent outline on `--card`. The last point is a 12px filled accent diamond;
  - horizontal grid lines in `--border` with the values on the right (12px, muted, tabular figures). Month labels go under the plot, at the first day of each month (12px, muted);
  - the plot has `role="img"` and an `aria-label` with the metric, the exercise, the latest value with its date, the change over the range and the number of workouts (AC8);
  - the range control under the plot: `.seg` with 5 parts, "1М 3М 6М 1Р Все".
- **Records:** the heading "Рекорди" (16/700), then one card with divided rows. Each row is a link to the session summary, at least 64px tall:
  - the record icon (24px, accent stroke);
  - the record name (16/700) over the date (14px, muted). For the estimated 1RM, the date line adds the set: "16 листопада, 87,5 кг × 5";
  - the value on the right (15/600, tabular figures) and a chevron.

### Other states (no board)

- **`reps`, `time`, `distance`:** no metric switch. The chart header names the one metric, and the records card has one row.
- **Selector sheet:** the bottom sheet (side sheet on desktop) titled "Вправа". It has a search field "Пошук вправи" and the list rows of spec 12 (thumbnail, name, "Востаннє …"). The selected row has a check. "Нічого не знайдено" shows when the search has no match.
- **Range with no points:** the chart card keeps its header with "—" and shows "Немає тренувань за цей період." in the plot area. The records stay visible.
- **One point:** the point is the 12px accent diamond with no line. The change shows "—".
- **No history:** the spec 12 empty card with a dashed `--planned` diamond, "Ще немає прогресу", the sentence, and a primary "Почати тренування" that opens the Start sheet. The month numbers and the selector are hidden.
- **Loading:** skeleton blocks in the page geometry: the numbers, the selector, the chart card, and three record rows, with `aria-busy`.
- **Error:** the spec 11 error card with "Не вдалося завантажити прогрес." and "Спробувати ще раз".
- **Offline, view not cached:** the chart card shows the `WifiOff` icon and "Потрібен інтернет" in the plot area.
- **Desktop 1440:** the `h1` "Прогрес" (30/800) is visible. Two columns, max width 1040px. The left column has the selector, the metric switch and the chart card. The right column (380px) has the month numbers and the records.

### Session summary records row

- The row sits between the numbers and the exercise list (spec 10).
- It has the heading "Нові рекорди" (16/700), then one card with a divided row per new record. A row has the record icon, the exercise name (16/700) over the record name (14px, muted), and the value on the right (15/600).
- The row is hidden when the session has no new records.

### Left out

- Board mockups for the states other than `PMain` (the lead's choice).
- Muscle family colours in the chart: the chart shows one exercise.

## Data and API

- No migration.
- **`GET /api/v1/progress/exercises`** returns the selector list and the month numbers:
  - `{ items: [{ exerciseId, name, trackingType, thumbnailUrl, lastTrainedAt }], month: { workouts, volumeKg } }`;
  - items are ordered by `lastTrainedAt` desc.
- **`GET /api/v1/progress/exercises/{id}?range=1m|3m|6m|1y|all`** returns the series and the records:
  - `{ trackingType, points: [{ sessionId, date, topWeightKg, e1rmKg, volumeKg, reps, durationSec, distanceM }], records: [{ type, value, weightKg, sessionId, date }] }`;
  - points are ordered by date asc. A field that does not apply to the tracking type is null;
  - an exercise with no counted set gives empty `points` and `records`. Another user's exercise gives 404.
- **`GET /api/v1/exercises/{id}/last-performance`** adds `bests` to the response: the record values before now, or null with no history. The client stores them in Dexie at session start.
- The client caches each `(exercise, range)` response with TanStack Query.
- Every query is scoped to the current user.
- `docs/tech/API.md` gets these endpoints in the scratch plan.

## Copy

| Key (en) | uk |
| --- | --- |
| No progress yet | Ще немає прогресу |
| Finish your first workout to see your strength charts here. | Заверши перше тренування, і тут зʼявляться графіки сили. |
| Start workout | Почати тренування (existing) |
| Heaviest weight | Найбільша вага |
| Estimated 1RM | Оцінка 1ПМ |
| Most reps | Найбільше повторень |
| Best volume | Найбільший обʼєм |
| New records | Нові рекорди |
| Workouts this month | Тренувань цього місяця |
| Volume this month | Обʼєм цього місяця |
| 1M / 3M / 6M / 1Y / All | 1М / 3М / 6М / 1Р / Все |
| Records | Рекорди |
| Weight / Volume (metric switch) | Вага / Обʼєм |
| {{metric}} now | {{metric}} зараз (`Оцінка 1ПМ зараз`) |
| {{change}} over {{range}} | {{change}} за {{range}} (`+10,1 кг за 3 місяці`) |
| Last trained {{date}} | Востаннє {{date}} (`Востаннє в понеділок, 16 листопада`) |
| Change | Змінити |
| {{date}}, {{weight}} × {{reps}} (estimated 1RM set) | `16 листопада, 87,5 кг × 5` |
| Exercise (sheet title) | Вправа |
| Search exercises | Пошук вправи |
| Nothing found | Нічого не знайдено |
| No workouts in this period. | Немає тренувань за цей період. |
| Couldn't load progress. | Не вдалося завантажити прогрес. |
| Try again | Спробувати ще раз (existing) |
| Needs internet | Потрібен інтернет (existing) |
| Reps (chart, `reps` type) | Повторення |
| Longest time / Time (`time` type) | Найдовший час / Час |
| Longest distance / Distance (`distance` type) | Найбільша дистанція / Дистанція |
| View progress (exercise details) | Переглянути прогрес |

## Acceptance criteria

- [ ] AC1: For a fixture of sessions, the chart points and estimated 1RM values match hand-computed values. Sets with more than 12 reps or no weight give no estimated 1RM.
- [ ] AC2: A new heaviest set appears as a record with its date, and its row opens that session. The session summary lists it under "Нові рекорди".
- [ ] AC3: The first session of an exercise shows no new records in the summary. A tie with the previous best is not a new record.
- [ ] AC4: A session finished offline shows its new records in the summary, from the bests stored at start.
- [ ] AC5: A user with no counted sets sees the empty state with "Почати тренування". The selector lists only trained exercises, the most recent first.
- [ ] AC6: `reps`, `time` and `distance` exercises show one metric with no switch and one record.
- [ ] AC7: Abandoned sessions, in-progress sessions and deleted set logs do not change points or records.
- [ ] AC8: Charts have accessible summaries: the latest value and the change over the range.
- [ ] AC9: A range opened before does not refetch when the user switches back to it, and it shows offline.
- [ ] AC10: The month numbers count the completed workouts and the volume of the current month in the profile time zone.
- [ ] AC11: Mobile (390px) and desktop (1440px) work in en and uk, light and dark, with no horizontal scroll.

## Depends on

10, 12.
