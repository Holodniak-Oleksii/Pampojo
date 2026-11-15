# 11-calendar-plan — technical plan

Spec: `docs/specs/11-calendar-plan.md`

## 1. Summary

Users put workouts on a calendar with schedule rules: a one-off date, or weekly on chosen weekdays every 1–4 weeks, ending never, on a date or after N times. Occurrences are computed from the rules by one shared pure function and are never stored.

- **Server:** a `schedule_rule` table (migration `0006`), CRUD routes `/api/v1/schedule-rules`, and the rule-ending step in workout delete. Sessions gain `scheduledFor` on write and read.
- **Client:** the `/calendar` screen (month grid, day panel, rule form sheet, delete dialog), today's plan on Today, a "Сьогодні за планом" section in the Start sheet, and automatic `scheduledFor` when a workout planned for today is started.
- **Writes:** rule writes are online only (TanStack mutations with client ids). Rules are read from the query cache when offline.

## 2. Acceptance criteria

"Today" always means the calendar date in the user's profile time zone (`profile.timeZone`), as `YYYY-MM-DD`.

- **AC1:** A rule "Push Day, weekly, Monday and Thursday, start S, end 2027-03-01" yields exactly the Mondays and Thursdays from S to 2027-03-01 inclusive, and none after. The calendar shows a marker on exactly those days.
- **AC2:** A one-off rule (`weekdays = []`, `endDate = startDate`) yields exactly one date. Creating a rule with `endAfter: 5` stores `endDate` = the date of its 5th occurrence.
- **AC3:**
  - "Every 2 weeks on Monday" yields the Mondays of the start date's ISO week, then two weeks later, and so on. The week index counts from the Monday of the start week, not from the start date.
  - `expandOccurrences` works on plain dates, so the result is identical across the DST changes of `Europe/Kyiv` (2027-03-28, 2027-10-31) and `America/New_York` (2027-03-14, 2027-11-07). Unit tests run the same rule with the process time zone set to each.
- **AC4:**
  - "Почати" is rendered only for occurrences on today, in the calendar day panel, on Today and in the Start sheet section.
  - Every start path (those three, a workout row in the library, the workout editor, the Start sheet list) goes through `useStartSession`. It sends `scheduledFor = today` when the workout has an occurrence today and no in-progress or completed session with `scheduledFor = today` for that workout exists (server list or local Dexie). Otherwise it sends `scheduledFor: null`.
- **AC5:**
  - `PATCH` of a rule whose `startDate < today` sets its `endDate = yesterday` and creates a new rule (id `newId`) with the submitted settings, starting today or later. Occurrences before today are unchanged.
  - `PATCH` of a rule with `startDate ≥ today` updates it in place.
  - `DELETE` of a rule with `startDate < today` sets `endDate = yesterday`; with `startDate ≥ today` it soft deletes. The past occurrences stay.
- **AC6:**
  - Today lists today's planned workouts: not-done ones with "Почати", done ones (a completed session with `scheduledFor = today` for that workout) with "Виконано" and a link to `/session/{id}`.
  - With rules but nothing today, Today shows the next occurrence after today with its workout name and date.
  - With no rules at all, Today shows the existing `TodayEmpty`.
  - The Start sheet shows "Сьогодні за планом" with today's not-done planned workouts above "Усі тренування", which no longer lists them.
- **AC7:** The server answers:
  - 400 `VALIDATION_FAILED`:
    - `startDate < today`;
    - `endDate` before `startDate` or after `startDate` + 2 years;
    - a computed `endAfter` date after that;
    - a weekly rule with no weekdays;
    - `intervalWeeks` outside 1–4;
    - a one-off whose `endDate ≠ startDate`;
    - a workout that is foreign, deleted or has no exercises;
    - a `PATCH` of an ended rule.
  - 422 `SCHEDULE_OVERLAP` when the rule shares a date with another active rule of the same workout.
  - 422 `SCHEDULE_LIMIT_REACHED` when creating would make 101 active rules.
  - 404 `SCHEDULE_RULE_NOT_FOUND` for a missing, deleted or foreign rule.
  - The same `PUT` twice creates one row. The same `PATCH` (same `newId`) twice splits once.
- **AC8:** Deleting a workout ends its rules in the same transaction (started ones get `endDate = yesterday`, future ones are soft deleted). The workout delete dialog adds "Його також буде прибрано з календаря." when the workout has an active rule.
- **AC9:** Offline, the calendar renders the cached rules. "+", "Запланувати тренування", "Запланувати на цей день" and the row menus are disabled, with the line "Потрібен інтернет, щоб змінити розклад.". "Почати" still works.
- **AC10:** `/calendar`, Today and the Start sheet work at 390×844 and 1440×900, in en and uk, light and dark, without horizontal scroll.

## 3. Data

### Table `schedule_rule` (migration `0006`, additive) — `src/server/db/schema/plan.ts`, re-exported from `schema/index.ts`

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | client id |
| user_id | uuid not null → user (cascade) | |
| workout_id | uuid not null → workout (cascade) | workouts are soft deleted, so the row stays |
| start_date | date not null | |
| end_date | date null | null = never |
| weekdays | smallint[] not null default `'{}'` | ISO 1–7, sorted, unique; empty = one-off |
| interval_weeks | smallint not null default 1 | |
| created_at, updated_at | timestamptz not null default now() | |
| deleted_at | timestamptz null | |

Checks:

- `interval_weeks between 1 and 4`;
- `weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]`;
- `end_date is null or (end_date >= start_date and end_date <= start_date + interval '2 years')`;
- `cardinality(weekdays) > 0 or end_date = start_date`.

Indexes:

- `schedule_rule_user_active_idx (user_id, deleted_at, end_date)`;
- `schedule_rule_workout_idx (workout_id)`.

Use `pnpm db:generate`, then hand-check the SQL, then `pnpm db:migrate`.

`workout_session.scheduled_for` already exists (migration 0005). No schema change for sessions.

Update `docs/tech/DATA_MODEL.md` `schedule_rule` (checks, index, cascade) and the `workout_session.scheduledFor` note.

### Constants — `src/constants/plan.ts`

```ts
export const SCHEDULE = {
  intervalMin: 1,
  intervalMax: 4,
  endAfterMax: 100,
  activeRulesMax: 100,
  horizonYears: 2,
  markersMax: 3,           // mobile cell markers before "+N"
} as const;
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
```

### Plan math — `src/shared/plan/occurrences.ts` (pure, no Date-of-day logic outside UTC)

Everything takes and returns `YYYY-MM-DD` strings. Internally it uses `Date.UTC` day numbers only: never local time, never `new Date('YYYY-MM-DD')` arithmetic in local zones.

- `type RuleShape = { startDate: string; endDate: string | null; weekdays: number[]; intervalWeeks: number }`.
- `addDays(date, n)`, `isoWeekday(date)` (1–7), `mondayOf(date)`, `compareDates`, `addYears(date, n)` (Feb 29 → Feb 28).
- `occursOn(rule, date)`:
  - true for a one-off when `date === startDate`;
  - true for a weekly rule when the date is within the rule's range, `weekdays` includes its ISO weekday, and `((mondayOf(date) − mondayOf(startDate)) / 7) % intervalWeeks === 0`.
- `expandOccurrences(rule, from, to)` returns the sorted dates in `[max(from, start), min(to, end)]` where `occursOn`.
- `nthOccurrence(rule, n)` returns the date of the n-th occurrence from the start, or null if past `startDate + horizonYears`.
- `nextOccurrence(rule, after)` returns the first occurrence strictly after `after`, or null. It scans at most `intervalWeeks × 7 + 7` days past `max(after, start − 1)`.
- `firstCommonDate(a, b)`: the first date both rules occur on, or null. It scans from `max(a.start, b.start)` to `min(a.end, b.end, max(a.start, b.start) + 12 weeks + 7 days)`. 12 weeks is the lcm of the 1–4 intervals.

Unit tests: `src/shared/plan/__tests__/occurrences.test.ts` (node project). The DST cases set `process.env.TZ` per `describe`.

### Zod — `src/shared/schemas/plan.ts`

- `isoDateSchema` is a `YYYY-MM-DD` regex plus `isRealDate`. Reuse it if one exists in `shared/schemas/utils.ts`; otherwise add it there.
- `scheduleRuleIdParamsSchema`: `{ id: z.uuid() }`.
- `ruleSettingsSchema`, `.strict()`:
  - `{ workoutId: uuid, startDate: isoDate, weekdays: int 1–7 array (≤ 7, unique), intervalWeeks: int 1–4, endDate: isoDate | null, endAfter: int 1–100 optional }`;
  - refines:
    - `endAfter` and a non-null `endDate` are exclusive;
    - one-off (`weekdays` empty) needs `endDate === startDate` and no `endAfter`;
    - `endDate ≥ startDate`.
- `putScheduleRuleInputSchema = ruleSettingsSchema`.
- `patchScheduleRuleInputSchema = ruleSettingsSchema.extend({ newId: z.uuid() })`.
- `scheduleRuleSchema`: `{ id, workoutId, startDate, endDate|null, weekdays, intervalWeeks, updatedAt, workout: { id, name, exerciseCount, deleted } }`.
- `scheduleRuleListResponseSchema`: `{ items }`.
- `scheduleRuleWriteResponseSchema`: `{ items: ScheduleRule[] }` (one or two rules).
- Types: `ScheduleRule`, `PutScheduleRuleInput`, `PatchScheduleRuleInput`.

### Sessions schema changes — `src/shared/schemas/session.ts`

- `putSessionInputSchema` gains `scheduledFor: isoDate.nullable().optional()`.
- `sessionSchema` and `sessionListItemSchema` gain `scheduledFor: isoDate | null`.
- `sessionListQuerySchema` gains `scheduledFor: isoDate.optional()`.
- `localSessionSchema` (`src/services/local-db/db.ts`) inherits `scheduledFor`. It is parsed with `.default(null)` so rows written before spec 11 still parse. No Dexie version bump, because the field is not indexed.

## 4. API

All routes use `withHandler({ auth: 'required' })`, scope by `userId`, and send `Cache-Control: private, no-store`.

- Add to `ERROR_STATUS`: `SCHEDULE_RULE_NOT_FOUND: 404`, `SCHEDULE_OVERLAP: 422`, `SCHEDULE_LIMIT_REACHED: 422`.
- Overlap and limit errors carry `details: { workoutName }` / `{ max: 100 }`.

| Method and path | Body / query | Response | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/schedule-rules` | — | `{ items: ScheduleRule[] }` | Non-deleted rules of the user, ended included, ordered by `start_date`, with the workout embed (`deleted` = `workout.deleted_at is not null`; `exerciseCount` = live exercise rows). One query. |
| `PUT /api/v1/schedule-rules/{id}` | `PutScheduleRuleInput` | 201 `{ items: [rule] }`; 200 on a replay | Own id already exists → 200 with the stored row unchanged. Foreign id → 404. Otherwise validate (below), then insert. |
| `PATCH /api/v1/schedule-rules/{id}` | `PatchScheduleRuleInput` | 200 `{ items }` | Missing, deleted or foreign → 404. Ended (`end_date < today`) → 400 `['id']`. If a rule with `newId` already exists and is the user's: replay, return `[rule, newRule]` unchanged. Started (`start_date < today`): set `end_date = yesterday`, insert `newId` with the settings → `[old, new]`. Not started: update in place → `[rule]`. |
| `DELETE /api/v1/schedule-rules/{id}` | — | 204 | Foreign or missing → 404. Deleted or ended → 204 no-op. Started → `end_date = yesterday`. Not started → `deleted_at = now()`. |
| `PUT /api/v1/sessions/{id}` | + `scheduledFor?` | as spec 10 | `scheduledFor` must equal `todayIn(profile.timeZone, startedAt)`, else 400 `['scheduledFor']`. It is stored on insert only. |
| `GET /api/v1/sessions` | + `?scheduledFor=` | items with `scheduledFor` | Filter `scheduled_for = $date`. |
| `DELETE /api/v1/workouts/{id}` | — | 204 | Also ends the workout's rules (section 5). |

**Validation for `PUT` and the new rule of a split** (service, after Zod, `today` from the profile):

1. `startDate ≥ today`.
2. If `endAfter` is present, set `endDate = nthOccurrence(rule, endAfter)`. Null → 400 `['endAfter']`.
3. `endDate ≤ addYears(startDate, 2)` → else 400 `['endDate']`.
4. The workout belongs to the user, is not deleted and has at least one exercise → else 400 `['workoutId']`.
5. There is at least one occurrence (a weekly rule whose end comes before its first weekday) → else 400 `['endDate']`.
6. **Overlap:** for each other non-deleted rule of the same workout with `end_date is null or end_date ≥ startDate` (excluding the rule being split or edited), `firstCommonDate` must be null. Otherwise 422 `SCHEDULE_OVERLAP`.
7. **Limit (create only, not split or in-place):** `count(active) < 100`, where active is `deleted_at is null and (end_date is null or end_date ≥ today)`. Otherwise 422 `SCHEDULE_LIMIT_REACHED`.

**In-place PATCH:** the same checks, except the limit.

**Concurrency:** every write takes `lockPlanOwner(tx, userId)` (`pg_advisory_xact_lock(hashtext('plan-owner:' || userId))`), so the overlap and limit checks are race-free.

**Idempotency** (`request-safety.md`):

- `PUT` with a client id;
- `PATCH` carries the split's client id `newId`;
- `DELETE` repeats are 204.

Update `docs/tech/API.md`: the schedule-rule rows, the error codes and the sessions changes.

## 5. Server

- **`src/server/plan/errors.ts`:** `PLAN_ERROR = { NOT_FOUND: 'SCHEDULE_RULE_NOT_FOUND', OVERLAP: 'SCHEDULE_OVERLAP', LIMIT_REACHED: 'SCHEDULE_LIMIT_REACHED' }`.
- **`src/server/plan/queries.ts`** (`import 'server-only'`; every query filters on `user_id`, except `lockRuleRow`, which the service checks):
  - `lockPlanOwner(tx, userId)`, `lockRuleRow(tx, id)` (`for update`);
  - `findRuleRow(db, userId, id)`;
  - `listRuleRows(db, userId)` (joined with `workout` and a count of `workout_exercise`);
  - `listWorkoutRules(tx, userId, workoutId)` (non-deleted);
  - `countActiveRules(tx, userId, today)`;
  - `insertRule(tx, values)`, `updateRuleColumns(tx, userId, id, fields)` (with `updated_at = now()`), `endRule(tx, userId, id, endDate)`, `softDeleteRule(tx, userId, id)`;
  - `endWorkoutRules(tx, userId, workoutId, today)`: two updates. Rules with `start_date < today and (end_date is null or end_date >= today)` get `end_date = today − 1`. Rules with `start_date >= today` get `deleted_at = now()`.
  - `hasActiveWorkoutRule(db, userId, workoutId, today)`.
- **`src/server/plan/today.ts`:** `userToday(db, userId, at = new Date())` reads `profile.time_zone` through `findProfileRow` and returns `todayIn(tz, at)`. With no profile it throws `PROFILE_NOT_FOUND`.
- **`src/server/plan/service.ts`:** `listRules`, `putRule`, `patchRule`, `deleteRule`. Each write is one transaction: `lockPlanOwner` → `lockRuleRow` → validate → write, then the rows are read back through `listRuleRows` filtered by id. Workout checks use `findWorkoutRow` and `listWorkoutExerciseRows` (or a count query) from `server/workouts/queries.ts`.
- **Routes:**
  - `src/app/api/v1/schedule-rules/route.ts` (GET);
  - `src/app/api/v1/schedule-rules/[id]/route.ts` (PUT, PATCH, DELETE).
  - Each handler calls one service function.
- **Workout delete:**
  - `src/server/workouts/service.ts` `deleteWorkout` calls `endWorkoutRules(tx, userId, id, await userToday(tx, userId))` inside its transaction, only on the first delete (not the no-op replay).
  - `GET /api/v1/workouts/{id}` is unchanged. The dialog line uses the client rule cache (section 6).
- **Sessions:**
  - `putSession` validates `scheduledFor` against `userToday(tx, userId, new Date(input.startedAt))` and passes it to `insertSession`;
  - `toSession` and the list rows map `scheduled_for`;
  - `listSessionRows` gains the `scheduledFor` filter.

## 6. Client

### API module — `src/api/plan.ts`

- `planKeys = { all: ['schedule-rules'], list: () => [...all, 'list'] }`.
- `fetchScheduleRules()`, `putScheduleRule(id, input)`, `patchScheduleRule(id, input)`, `deleteScheduleRule(id)` through `http`, parsed with the schemas.
- **Hooks:**
  - `useScheduleRulesQuery()` (`staleTime` 60 s);
  - `usePutScheduleRuleMutation`, `usePatchScheduleRuleMutation`, `useDeleteScheduleRuleMutation`. On success they invalidate `planKeys.all`. Delete is optimistic: it applies the same end-or-delete rule in the cache and rolls back on error.
- **`workoutKeys` invalidation:** after a workout delete, also invalidate `planKeys.all` (`useDeleteWorkoutMutation`).
- **`src/api/sessions.ts`:** `fetchSessions` accepts `scheduledFor`. Add `useSessionsQuery({ scheduledFor })` usage (it exists).

### Plan domain hooks — `src/features/plan/` (used by calendar, Today, Start sheet and session start)

- `hooks/usePlanToday.ts` returns `today`:
  - it is `todayIn(profile.timeZone)` from `useProfileQuery()`, falling back to the device zone while the profile loads;
  - it re-renders at the next midnight through `useNow(60_000)` from `features/session/hooks/useNow`.
- `hooks/useTodaySessions.ts` returns today's non-abandoned sessions with `scheduledFor = today`:
  - it merges `useSessionsQuery({ scheduledFor: today })` (when online) with a Dexie `useLiveQuery` over `sessions` filtered in memory by `scheduledFor === today`;
  - by id, the local row wins.
- `hooks/useTodayPlan.ts` returns `{ status: 'loading' | 'error' | 'ready', hasRules, items, next }`:
  - `items`: `{ rule, workout, done: Session | null, active: Session | null }[]` for the rules occurring today, not-done first, then by name;
  - `next`: the earliest `nextOccurrence(rule, today)` over active rules, as `{ date, rule }`.
  - `workout` comes from the `useWorkoutsQuery()` list by id (for `thumbnailUrls`), else the rule's embed.
- `resolveScheduledFor.ts`: `resolveScheduledFor({ workoutId, rules, today, sessions }) → string | null`, a pure function (unit tested).
- `ruleSummary.ts`: `ruleSummary(t, locale, rule)` returns the summary line (section 7 forms).
- `formatPlanDate.ts`: `dayHeading(locale, date, today)` ("Сьогодні, неділя, 15 листопада" / "Четвер, 3 грудня") and `nextDateLabel(locale, date)` ("у середу, 18 листопада" / "on Wednesday, November 18"). It uses `Intl.DateTimeFormat` with `timeZone: 'UTC'` on `Date.UTC` values, so the date never shifts.
- `index.ts` exports these.

### Session start — `src/features/session/hooks/useStartSession.ts`

- `start(workoutId)` reads the rules with `queryClient.getQueryData(planKeys.list())`, fetching them online when absent and ignoring errors.
- It reads today's sessions:
  - online: `fetchSessions({ scheduledFor: today })`, failures ignored;
  - always: the Dexie in-progress and completed rows with `scheduledFor`.
- It computes `scheduledFor = resolveScheduledFor(…)` and passes it to `repository.start`.
- `StartSessionInput` and the local row gain `scheduledFor`, and the `PUT` body includes it.
- `today` comes from the profile query cache, falling back to the device zone.
- No other caller changes: every start path already uses this hook.

### Route — `src/app/[lang]/(app)/calendar/page.tsx`

- It replaces the placeholder with `<PlanCalendar />` and keeps the metadata.
- The page header keeps `PageHeader sectionTitle title={t('Calendar')}` on desktop. Mobile uses the top bar title as today.

### Feature — `src/features/calendar/`

- **`PlanCalendar/PlanCalendar.tsx`** (`'use client'`, entry):
  - **state:** `month` (`YYYY-MM`, starts at today's month) and `selected` (date, starts at today), both in local state;
  - **queries:** `useScheduleRulesQuery()`, `useTodayPlan()` and `useIsOnline()`;
  - **states:** loading → `CalendarSkeleton` (board `Loading`); error with no cached data → `CalendarError` with retry (board `Error`); data → grid plus panel.
  - **layout:**
    - mobile is a column: `MonthHeader`, `MonthGrid variant="compact"`, `DayPanel`;
    - desktop (`lg:`) is a row: a flex-1 column with `MonthHeader` and `MonthGrid variant="full"`, plus a 340px `DayPanel`.
- **`MonthHeader`:**
  - the month title is `Intl` `{ month: 'long', year: 'numeric' }` with a capital first letter, `text-xl font-extrabold`, `lg:text-3xl`;
  - "Сьогодні" (`variant="secondary"`, h-9) shows only when `month` is not today's month. It sets `month` and `selected` to today.
  - previous and next are ghost icon buttons (`ChevronLeft` / `ChevronRight`, `aria-label`);
  - the accent "+" (`size-11`, `bg-accent text-accent-foreground`, `aria-label` "Запланувати тренування"). On desktop it is the full button "+ Запланувати тренування".
  - Both are disabled offline.
- **`MonthGrid`:**
  - `role="grid"` with weekday headers from `Intl` short weekdays, Monday first, capitalised (Пн…Нд / Mon…Sun);
  - 6 rows when needed (`weeksOfMonth(month)` in `utils.ts`, Monday-first);
  - each cell is a `button role="gridcell" aria-selected` with `aria-label` "{date}, {n} planned" ("15 листопада, заплановано: 2").
  - **`compact`** (mobile): 48px rows, the number 15px semibold, today bold with a 14×2px `bg-foreground` bar under the number. Out-of-month days are `text-planned`. Markers are up to 3 `Diamond` outlines (7px, `border-planned`), then "+N" (12px muted). The selected cell gets `bg-card ring-1 ring-inset ring-border-strong`.
  - **`full`** (desktop): 6 equal rows filling `calc(100dvh − header)`, `min-h-[96px]`. Cells are `bg-card rounded-sm p-2`, out-of-month cells transparent. Each cell shows the number, the "сьогодні" label for today (12px muted bold) and one line per occurrence (marker + workout name, `truncate`, 13px semibold). The selected cell gets `ring-2 ring-inset ring-foreground`.
  - Arrow keys move `selected` (±1 / ±7, crossing months), and Enter selects. The selected cell has `tabIndex 0`, the others −1.
  - Occurrences are computed with `expandOccurrences` for the visible 6-week range, memoised on `[rules, month]`.
- **`DayPanel`:**
  - the heading `dayHeading(…)` (`text-[17px] font-extrabold`, desktop 20px). On mobile it sits above a top border (`border-t border-border-strong pt-1.5`).
  - **list:** a card `ul` with one `PlannedRow` per occurrence on `selected`, not-done first.
  - **empty day:** a card with a dashed `Diamond` (`border-planned border-dashed`), "На цей день нічого не заплановано." and, when online and `selected ≥ today`, a full-width primary "Запланувати тренування". This card is the mobile empty state (board `Empty`).
  - **desktop footer:** a secondary "+ Запланувати на цей день" (online, `selected ≥ today`).
  - **offline:** the line "Потрібен інтернет, щоб змінити розклад." with the `WifiOff` icon (14px muted).
- **`PlannedRow`:**
  - a 48px `ExerciseImage` thumbnail (the first of `thumbnailUrls`; a placeholder when the workout is deleted);
  - the name (16px bold) and `ruleSummary` (14px muted);
  - the action on the right:
    - **today, not done:** "Почати" (primary, h-11), which calls `useStartSession().start(workoutId)`;
    - **today, done:** the accent `Diamond` with "Виконано", linking to `/session/{id}`;
    - **other days:** none.
  - The "…" `DropdownMenu` (`aria-label` "Дії для {name}") has "Змінити розклад" (`Pencil`) and "Видалити з календаря" (`Trash2`, `text-destructive`). It is hidden for ended rules (`endDate < today`) and for rules whose workout is deleted, and disabled offline.
- **`RuleFormSheet`** (boards `Form`, `FormEdit`, `DesktopForm`):
  - `Sheet` `side="bottom"` on mobile (`bg-card`, top inset 52px, grabber) and `side="right"` 480px on desktop. It is a react-hook-form form with `zodResolver(ruleFormSchema)`, where `ruleFormSchema` is the client shape.
  - **Header:** "Запланувати тренування" (new) or "Змінити розклад" (edit).
  - **Fields:**
    - "Тренування": a `Select` (existing component) over `useWorkoutsQuery()` items with `exerciseCount > 0`, showing the thumbnail, the name and "· N вправ".
    - "Дата початку": a native `input type="date"` styled like the select (`min` = today).
      - New: the selected day if `≥ today`, else today.
      - Edit of a started rule: today, disabled, with the note "Зміни діють з сьогодні. Минулі тренування не зміняться.".
      - Edit of a future rule: the rule's start.
    - "Повторення": `SegmentedControl` with "Один раз" and "Щотижня".
    - For "Щотижня": seven toggle buttons (`aria-pressed`, h-11, pressed = `bg-foreground text-background`, `aria-label` the full weekday) and an interval `Select` "Щотижня" / "Кожні 2 тижні" / "Кожні 3 тижні" / "Кожні 4 тижні". New forms default to the weekday of the start date.
    - "Закінчення": `SegmentedControl` with "Ніколи", "До дати" and "Після", hidden for "Один раз".
      - "До дати": a date input (`min` = start, `max` = start + 2 years).
      - "Після": a 72px number input (1–100) plus "разів" and the live preview "Останнє: {short date}" from `nthOccurrence`.
      - Edit shows a stored end as "До дати".
  - **Footer:** pinned, with "Запланувати" or "Зберегти" (primary, full width, pending state).
  - **Errors:** server errors render above the button in `text-destructive` with `role="alert"`:
    - `SCHEDULE_OVERLAP` → "{name} уже заплановане на ці дні.";
    - `SCHEDULE_LIMIT_REACHED` → "Можна мати до 100 активних розкладів.";
    - anything else → "Не вдалося зберегти розклад. Спробуй ще раз.".
  - Field errors use the existing field error style.
  - **Client ids:** a new form generates `ruleId` once per open and reuses it on retry. An edit generates `newId` once per open.
  - **Submit:** new → `PUT`; edit → `PATCH` with `newId`. On success the sheet closes, `selected` moves to the rule's start, and the toast reads "Збережено".
- **`DeleteRuleDialog`** (board `DeleteRule`): the stacked destructive `ConfirmDialog` with "Видалити «{name}» з календаря?" / "Минулі тренування залишаться в історії." and the buttons "Видалити" / "Скасувати". It calls the delete mutation.
- **`CalendarSkeleton`, `CalendarError`:** follow the boards. The error card uses `AlertCircle` in `text-destructive`, "Не вдалося завантажити календар." and "Спробувати ще раз".
- **`utils.ts`:** `monthOf(date)`, `addMonths`, `weeksOfMonth(month)` (42 or 35 dates, Monday-first), `occurrencesByDate(rules, from, to)` → `Map<date, ScheduleRule[]>`.

### Today — `src/features/today/`

- **`TodayView`:** it keeps the greeting and `GymNudgeCard`, then renders `TodayPlan` instead of `TodayEmpty`.
- **`TodayPlan/TodayPlan.tsx`** (`'use client'`) uses `useTodayPlan()`:
  - **loading:** a card skeleton;
  - **no rules or error:** `<TodayEmpty hasWorkouts />` (the existing states);
  - **items:** the heading "Сьогодні за планом" (`text-[17px] font-extrabold`), then the cards, in a two-column grid on desktop (`lg:grid-cols-2`, max-w 960px):
    - **`PlannedCard` (to do)** (board `Today`): the name `text-[28px] font-extrabold`, "N вправ", up to 4 thumbnails (52px, rounded-sm) and a full-width primary "Почати" with `PlayDiamond`.
    - **`PlannedCard` (done):** the name `text-[22px]`, "N вправ", a "Виконано" chip (`bg-background`, accent `Diamond` 9px) and the link "Переглянути підсумок" with `ChevronRight` to `/session/{id}`.
    - An in-progress planned workout shows "Почати" too; `useStartSession` opens the running session.
  - **no items, rules exist** (board `TodayNext`): a card with the heading "На сьогодні нічого не заплановано" and an inset `bg-background` block. The block has the outline marker with "Наступне тренування", the name (28px extrabold), `nextDateLabel` (semibold) and the thumbnails. After the block come "Хочеш потренуватися зараз? Натисни ▶ і вибери тренування." (▶ rendered as an inline `PlayDiamond`, `aria-hidden`, with the text "▶" for screen readers kept) and a secondary "Відкрити календар" linking to `/calendar`. With rules but no next occurrence (all ended), show `TodayEmpty`.

### Start sheet — `src/features/app-shell/StartWorkoutSheet/StartWorkoutSheet.tsx`

- `WorkoutChoices` uses `useTodayPlan()`:
  - when the items not done include workouts, it renders the heading "Сьогодні за планом" (15px extrabold, with an accent outline `Diamond`), then a card ringed `ring-[1.5px] ring-accent` holding those rows;
  - then the muted heading "Усі тренування" and the existing list without those ids.
- Rows keep their current markup (extract `WorkoutChoiceRow`).
- With no such items the sheet is unchanged.

### Workout delete dialog — `src/features/workouts/WorkoutList/WorkoutList.tsx`

- The description becomes `Past workouts stay in your history.` plus, when the workout has an active rule in `useScheduleRulesQuery()` data (`endDate` null or ≥ today, workout id match), a second bold line "Його також буде прибрано з календаря.".
- Also apply this in the editor's delete dialog, if it has one (`WorkoutEditorForm`).

### Offline

- The rules come from the TanStack cache. If `/calendar` opens offline with no cache, `CalendarError` shows (persistence is spec 16).
- Writes are disabled through `useIsOnline()`.
- "Почати" follows spec 10 (it starts from the cached workout).

### Layout checks

- 390px: the header row fits "Сьогодні" + 2 arrows + "+" next to "Листопад 2026"/"Вересень 2026". The title truncates if needed.
- 1440px: the grid fills the height without page scroll at 900px.
- Light and dark use tokens only.

## 7. Copy

en key → uk. Keys are added to `src/i18n/locales/en.json` and `uk.json`. Plurals follow the existing `_one/_few/_many/_other` pattern.

| en | uk |
| --- | --- |
| Calendar | Календар (existing) |
| Schedule workout | Запланувати тренування |
| Schedule | Запланувати |
| Save | Зберегти (existing) |
| Schedule on this day | Запланувати на цей день |
| Edit schedule | Змінити розклад |
| Remove from calendar | Видалити з календаря |
| Actions for {{name}} | Дії для {{name}} |
| Previous month | Попередній місяць |
| Next month | Наступний місяць |
| Today | Сьогодні (existing) |
| today (desktop cell label) | сьогодні |
| {{date}}, {{planned}} planned | {{date}}, заплановано: {{planned}} |
| Today, {{date}} | Сьогодні, {{date}} |
| Nothing planned on this day. | На цей день нічого не заплановано. |
| Needs internet to change the schedule. | Потрібен інтернет, щоб змінити розклад. |
| Couldn't load the calendar. | Не вдалося завантажити календар. |
| Try again | Спробувати ще раз (existing) |
| Workout | Тренування |
| Start date | Дата початку |
| Changes apply from today. Past workouts stay as they were. | Зміни діють з сьогодні. Минулі тренування не зміняться. |
| Repeat | Повторення |
| Once | Один раз |
| Weekly | Щотижня |
| Days of the week | Дні тижня |
| Every week | Щотижня |
| Every {{count}} weeks | Кожні {{count}} тижні (`_one` тиждень, `_few` тижні, `_many` тижнів, `_other` тижня) |
| Ends | Закінчення |
| Never | Ніколи |
| On date | До дати |
| After | Після |
| times | разів |
| Number of workouts | Кількість тренувань |
| Last: {{date}} | Останнє: {{date}} |
| Couldn't save the schedule. Try again. | Не вдалося зберегти розклад. Спробуй ще раз. |
| {{name}} is already planned on these days. | {{name}} уже заплановане на ці дні. |
| You can have up to 100 active schedules. | Можна мати до 100 активних розкладів. |
| Saved | Збережено (existing, else add) |
| Remove "{{name}}" from the calendar? | Видалити «{{name}}» з календаря? |
| Past workouts stay in your history. | Минулі тренування залишаться в історії. (existing) |
| It will also be removed from the calendar. | Його також буде прибрано з календаря. |
| Delete | Видалити (existing) |
| Cancel | Скасувати (existing) |
| Start | Почати |
| Done (plan status) | Виконано, with `context: 'plan'` because "Done" already means «Готово» |
| View summary | Переглянути підсумок |
| Planned for today | Сьогодні за планом |
| All workouts | Усі тренування |
| Nothing planned for today | На сьогодні нічого не заплановано |
| Next workout | Наступне тренування |
| Want to train now? Tap ▶ and choose a workout. | Хочеш потренуватися зараз? Натисни ▶ і вибери тренування. |
| Open calendar | Відкрити календар |
| {{count}} exercises | existing plural |

Rule summaries (`ruleSummary`):

| Case | en | uk |
| --- | --- | --- |
| One-off | Once | Один раз |
| Weekly, all 7 days | Every day | Щодня |
| Weekly, every week | Every {{days}}, with full names joined by ", " and " and " ("Every Monday and Thursday") | Що-forms joined by ", " and " й ", first letter capitalised: "Щопонеділка й щочетверга" |
| Every N weeks | Every {{count}} weeks: {{days}}, short names ("Every 2 weeks: Mon, Thu") | Кожні {{count}} тижні: {{days}}, short lowercase names ("Кожні 2 тижні: пн, чт") |

- The uk weekly forms are keys `Every Monday`…`Every Sunday` → щопонеділка, щовівторка, щосереди, щочетверга, щоп'ятниці, щосуботи, щонеділі. In en they translate to the plain names Monday…Sunday, and the en sentence adds "Every ".
- Joins use keys `{{a}} and {{b}}` → `{{a}} й {{b}}`. Lists of three or more join with ", ", and the last pair uses that key.
- Date formats come from `Intl` in the active locale with `timeZone: 'UTC'`:
  - day heading: `{ weekday: 'long', day: 'numeric', month: 'long' }`, capitalised, with "Сьогодні, " / "Today, " prefixed (and the weekday then lowercased in uk) for today;
  - next date: `{ weekday: 'long', day: 'numeric', month: 'long' }`, prefixed through the key `on {{date}}` → `у {{date}}`. The uk weekday must be in the accusative ("у середу", "у пʼятницю", "у неділю"). `Intl` gives the nominative, so map the weekday through the keys `on Monday`…`on Sunday` → у понеділок, у вівторок, у середу, у четвер, у пʼятницю, у суботу, у неділю, and append the day and month;
  - "Останнє" date: `{ weekday: 'short', day: 'numeric', month: 'long' }` → "чт, 10 грудня".

## 8. Steps

1. **Plan math:** `src/constants/plan.ts`, `src/shared/plan/occurrences.ts` and its unit tests (AC1–3, overlap, `nthOccurrence`, `nextOccurrence`).
2. **Schemas:** `src/shared/schemas/plan.ts` (+ `isoDateSchema` in `utils.ts` if missing) and the session schema changes (`scheduledFor`), with schema tests.
3. **DB:** `src/server/db/schema/plan.ts`, export it, `pnpm db:generate` → `0006_*.sql` (check the checks), `pnpm db:migrate`. Update `DATA_MODEL.md`.
4. **Server plan:** `src/server/plan/{errors,queries,today,service}.ts`, `ERROR_STATUS` entries, routes `schedule-rules/route.ts` and `[id]/route.ts`. Add integration tests.
5. **Server sessions:** the `scheduledFor` validation, storage, read-back and list filter. Extend the session tests.
6. **Server workout delete:** `endWorkoutRules` in `deleteWorkout`, with a test. Update `API.md`.
7. **Client API:** `src/api/plan.ts`, the `fetchSessions` filter, `planKeys` invalidation on workout delete.
8. **Plan feature:** `src/features/plan/` (hooks, `resolveScheduledFor`, `ruleSummary`, `formatPlanDate`) with unit tests.
9. **Session start:** the local `scheduledFor` (`db.ts` schema default, repository `start`, `StartSessionInput`), and `useStartSession` computing it.
10. **Calendar feature:** `src/features/calendar/` (utils, `MonthHeader`, `MonthGrid`, `PlannedRow`, `DayPanel`, `CalendarSkeleton`, `CalendarError`, `PlanCalendar`), the `calendar/page.tsx` swap.
11. **Rule form and delete:** `RuleFormSheet` and `DeleteRuleDialog`, wired into `PlanCalendar`.
12. **Today:** `TodayPlan`, `PlannedCard`, `NextWorkoutCard`, `TodayView` change.
13. **Start sheet:** the section, with `WorkoutChoiceRow` extracted.
14. **Workout delete dialog:** the extra line.
15. **i18n:** keys in `en.json` and `uk.json`; `check-catalogs` passes.
16. **e2e:** `e2e/11-calendar-plan.spec.ts`. Then lint, typecheck and the touched tests.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/shared/plan/__tests__/occurrences.test.ts` (Mon/Thu until 2027-03-01, bounds inclusive); `e2e/11-calendar-plan.spec.ts` "weekly rule shows markers on Mondays and Thursdays only" |
| AC2 | `occurrences.test.ts` (one-off, `nthOccurrence(…, 5)`); `src/server/plan/__tests__/service.test.ts` "endAfter 5 stores the 5th date" |
| AC3 | `occurrences.test.ts` "every 2 weeks counts from the start week", "same dates under TZ=Europe/Kyiv and TZ=America/New_York across DST" |
| AC4 | `src/features/plan/__tests__/resolveScheduledFor.test.ts` (planned, already done, in progress, not planned, other workout planned); `src/server/sessions/__tests__/service.test.ts` "scheduledFor must equal the startedAt date in the profile zone", "late replay of yesterday's start passes"; `src/features/calendar/__tests__/PlannedRow.test.tsx` "Почати only for today"; e2e "start from the day panel links the session" (checks `GET /sessions?scheduledFor=` returns it) |
| AC5 | `src/server/plan/__tests__/service.test.ts` "patch of a started rule splits", "patch of a future rule edits in place", "delete started ends yesterday", "delete future soft deletes"; e2e "edit schedule keeps past markers" (rule started in the past is seeded in the DB with a past `startDate`) |
| AC6 | `src/features/today/__tests__/TodayPlan.test.tsx` (to do, done, next, no rules → TodayEmpty); `src/features/app-shell/__tests__/StartWorkoutSheet.test.tsx` "planned section first, not repeated"; e2e "Today shows Виконано after finishing a planned workout" |
| AC7 | `src/server/plan/__tests__/service.test.ts` and `src/app/api/v1/schedule-rules/__tests__/route.test.ts`, each case listed in AC7 and the PUT twice / PATCH twice checks |
| AC8 | `src/server/workouts/__tests__/service.test.ts` "delete ends the workout's rules"; `src/features/workouts/__tests__/WorkoutList.test.tsx` "delete dialog mentions the calendar"; e2e |
| AC9 | `src/features/calendar/__tests__/PlanCalendar.test.tsx` "offline disables schedule controls and shows the hint"; e2e with `context.setOffline(true)` |
| AC10 | e2e runs on the `mobile` and `desktop` projects, a uk pass checks `scrollWidth <= innerWidth` on `/calendar`, Today and the sheet, and a dark pass (`colorScheme: 'dark'`) takes the same screenshots |

Server tests follow `docs/development/backend/testing.md` (real DB, own user per test). For "today", tests set the profile time zone and use dates relative to `userToday`, never a hard-coded today.

## 10. Risks and open questions

- **Midnight edges:** the client "today" follows the profile zone; a device in another zone sees the profile's day. This is intended. `usePlanToday` re-renders on the minute so the view flips at midnight.
- **Profile zone change:** after a zone change, `userToday` moves. Already stored rules keep their dates.
- **Same-day replays:** two devices may both auto-link the same occurrence while offline. Both sessions keep `scheduledFor`. Spec 12 decides which one counts.
- **Calendar cache offline:** without persistence (spec 16), a cold start offline shows the error state.
- **Weekly rule with no occurrence:** for example a start on Tuesday, Monday only, ending Wednesday. It is rejected with 400 so no empty rule exists.
- **Statuses, week strip, history, skip or move one occurrence:** spec 12.
- No blocking questions remain.

## 11. Implementation notes
- `isoDateSchema` is named `calendarDateSchema` (`src/shared/schemas/utils.ts`), because `session.ts` already has an `isoDate` for datetimes.
- `endWorkoutRules(tx, userId, workoutId)` takes today from the profile time zone in SQL instead of a `today` argument. A user without a profile has no rules, so workout deletes in older tests keep working.
- The `scheduledFor` session test and the AC8 workout-delete test live in `src/server/plan/__tests__/service.test.ts`, not in the sessions and workouts test files.
- The rule form uses component state, not react-hook-form; no other form in the app uses it.
  - Invalid input disables "Запланувати"/"Зберегти" instead of showing field errors, since the plan has no field-error copy.
  - The last weekday cannot be switched off.
  - The workout picker is the native `Select`, with the chosen workout's thumbnail beside it.
- Extra copy keys: `End date` / `Interval` (screen-reader labels), `{{a}} and {{b}}`, `Every {{days}}`, the weekday `_every`/`_on` context forms, and the `_one`/`_few`/`_many`/`_other` forms of the "Every N weeks" keys. The extractor removed the two keys of the old calendar placeholder.
- The desktop grid uses fixed 88px rows instead of filling the height. This lets 6 weeks fit 1440×900 without page scroll under the section heading.
- Local Dexie lookups for planned sessions: `findScheduledSessions` and `useLocalScheduledSessions` in `src/services/local-db/`.
- `WorkoutEditorForm` has no delete dialog, so only `WorkoutList` gets the calendar line.
- Test updates outside the new files:
  - `e2e/05-app-shell.spec.ts`: the calendar is no longer a placeholder.
  - `TodayView.test.tsx`: mocks `next/navigation`, which `useStartSession` needs.
  - `DeleteExerciseDialog.test.tsx`: the list fixture gains `scheduledFor`.
- The "Done" e2e waits for the outbox before reloading. See the spec 10 race in the summary.

## 12. Review — 2026-11-15

**Verdict:** Pass with notes

Screenshots: `scratch/review/11-calendar-plan/`, 15 states × mobile/desktop × light/dark, uk. The UI walk found no page errors and no horizontal overflow at 390 and 1440, and the finished planned session carried `scheduledFor = 2026-11-15`.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `src/shared/plan/__tests__/occurrences.test.ts`; `src/features/calendar/__tests__/utils.test.ts`; e2e "schedules from the form…"; `AC1-calendar-{empty,filled,loading,error}-*.png` |
| AC2 | Pass | `occurrences.test.ts` (one-off, `nthOccurrence`); `src/server/plan/__tests__/service.test.ts` "stores the 5th occurrence"; e2e (after 3 → end = start + 14); `AC2-form-new-after-*.png` (preview "Останнє: пн, 23 листопада") |
| AC3 | Pass | `occurrences.test.ts` "counts every 2 weeks from the start week", DST cases under `Europe/Kyiv` and `America/New_York` |
| AC4 | Pass, see finding 1 | `src/features/plan/__tests__/plan.test.ts` (`resolveScheduledFor`); `PlanCalendar.test.tsx` "offers Start only on today"; service test "late replay still passes"; e2e `?scheduledFor=` |
| AC5 | Pass | service tests (split once, in place, delete end/soft delete); route test PATCH twice; e2e "edits a started rule…"; `AC5-form-edit-*.png`, `AC5-delete-rule-dialog-*.png` |
| AC6 | Pass | `TodayPlan.test.tsx`; `StartWorkoutSheet.test.tsx` "planned for today first"; e2e "Today and the Start sheet…"; `AC6-today-{planned,done,next}-*.png`, `AC6-start-sheet-*.png`, `AC6-calendar-done-*.png` |
| AC7 | Pass | `service.test.ts` "rejects invalid rules", "stops at 100 active rules", "hides another user rule"; `src/app/api/v1/schedule-rules/__tests__/route.test.ts` (201/200 replay, 400/422/404); `AC7-form-overlap-*.png` |
| AC8 | Pass, see finding 4 | service test "deleting a workout"; `WorkoutList.test.tsx` "says a planned workout also leaves the calendar"; e2e; `AC8-workout-delete-dialog-*.png` |
| AC9 | Pass, see finding 3 | `PlanCalendar.test.tsx` "read-only offline"; e2e offline; `AC9-calendar-offline-*.png` |
| AC10 | Pass, see finding 2 | e2e uk/dark overflow checks; UI walk overflow 0 at 390 and 1440 in light and dark |

### Findings

1. [major] **Wrong-day `scheduledFor` can lose a whole workout.** The start path computes today with the device time zone when the profile is not in the query cache (`src/features/plan/hooks/usePlanToday.ts:14`, used by `src/features/session/hooks/useStartSession.ts:43`). The server compares against the profile zone and answers 400 (`src/server/sessions/service.ts:256`). The outbox drops a 4xx, so the session `PUT` and then every set `PUT` (404) are dropped, and the workout never reaches the server.
   - **When it happens:** a start from a page that does not load the profile, for example the workout editor opened directly, while the device and profile zones are on different dates (travel, a device set to another zone).
   - **Fix:** in `plannedDateFor`, call `queryClient.ensureQueryData` for the profile when online, and send `scheduledFor: null` when the zone is unknown, rather than guessing.
2. [minor] **The mobile month title truncates when "Сьогодні" is shown:** "Грудень 20…" (`AC4-future-day-menu-mobile-light.png`, `src/features/calendar/MonthHeader/MonthHeader.tsx:31`). The `FutureDay` board shows "Грудень 2026" in full. Tighter button padding or a smaller title at this state would fit it.
3. [minor] **The disabled "+" offline is a faded accent.** The `Offline` board shows it in `--card` with a `--planned` icon (`MonthHeader.tsx:63`, `AC9-calendar-offline-mobile-light.png`). It still reads as a pale primary action.
4. [minor] **The workout delete dialog (spec 09) keeps its old two-button footer band** with a primary "Видалити" (`src/features/workouts/WorkoutList/WorkoutList.tsx:205`, `AC8-workout-delete-dialog-*.png`). The spec 11 design says both delete dialogs use the stacked destructive `ConfirmDialog`. Only the calendar line was added.
5. [minor] **The calendar's selected day can drift from the profile zone.** It starts at today from the device zone while the profile is loading (`src/features/calendar/PlanCalendar/PlanCalendar.tsx:29`). If the profile zone is on another date, the panel opens on the device's day. This only matters near midnight with mismatched zones.
6. [minor] **The uk weekday forms mix apostrophes:** `щоп'ятниці` and `у пʼятницю` (`src/i18n/locales/uk.json:280-281`). The catalog mostly uses `'`.

### Checks

- lint: pass.
- typecheck: pass.
- i18n:check: pass ("Translation catalogs are complete").
- tests: `pnpm test` 100 files, 649 tests, all pass.
- e2e: `e2e/11-calendar-plan.spec.ts` 10/10 (mobile + desktop). During implementation: 20/20 with `--repeat-each=2`, and `05`, `09`, `10` green. `05` "wordmark leads to Today" failed once in dev and passed 4/4 on repeat.
- Scope and safety:
  - every new query filters on `user_id`, except `lockRuleRow`, which the service checks;
  - writes take the per-user advisory lock;
  - `PUT` uses a client id, `PATCH` carries `newId`, and `DELETE` is repeat-safe;
  - no secrets or build output in the diff;
  - the deviations are listed in Implementation notes.

### Out of scope

- **Spec 10:** a reload right after finishing, before the outbox flushes, shows the session as running again. `useInProgress` imports the server's `in_progress` copy over the local completed row (`src/features/session/hooks/useInProgress.ts:35`). The spec 11 e2e waits for the sync to avoid it.
- **Spec 10:** pressing "Завершити" right after checking a set can open "Жодного підходу не позначено", because the live query has not caught up yet. The UI walk needed a short wait.
- The native date inputs show the browser or OS date format (for example 11/15/2026), not the app language.
- `GET /schedule-rules` returns ended rules without a limit, and every split adds one. Spec 12 or 16 may want a date window.
- Dev server log: `NEXT_REDIRECT` while validating instant UI on `/[lang]/today` before onboarding.

## 12. Review — 2026-11-15 (fixes)

**Verdict:** Pass

All six findings of the review above are fixed:

1. [major] **Fixed.** `planTodayForStart` (`src/features/plan/hooks/usePlanToday.ts`) uses the cached profile zone and loads the profile when it is missing. With no zone (offline, no cache, or a failed load) the start sends `scheduledFor: null` instead of a device-zone guess, so the server never rejects the session `PUT`. Test: `src/features/plan/__tests__/planTodayForStart.test.tsx`.
2. [minor] **Fixed.** With "Сьогодні" shown, the mobile month title steps down to 18px and the button padding tightens. "Грудень 2026" and "Серпень 2027" fit at 390 without truncation.
3. [minor] **Fixed.** The offline "+" and "Запланувати тренування" use `--card` with a `--planned` icon, not a faded accent.
4. [minor] **Fixed.** The workout delete dialog is the stacked destructive `ConfirmDialog`, as in the spec 11 design.
5. [minor] **Fixed.** Until the user picks a day or moves the month, the selected day follows today when the profile zone loads or the date changes at midnight. "Сьогодні" resumes following. Test: `PlanCalendar.test.tsx` "selects today in the profile zone once the profile loads".
6. [minor] **Fixed.** `у п'ятницю` now uses the catalog's usual apostrophe.

### Checks

- lint, typecheck, i18n:check: pass.
- tests: 101 files, 653 tests, all pass.
- e2e: `09-workout-builder` and `11-calendar-plan`, 26/26 (mobile + desktop).
