# 12-history-adherence — technical plan

Spec: `docs/specs/12-history-adherence.md`

## 1. Summary

The calendar shows what really happened against the plan.

- **Statuses:** every occurrence is done on time, done late, missed or planned. A completed session with no plan link is extra. One pure shared function, `computeCalendar()`, gives these statuses on the server and on the client.
- **Make up:** a missed occurrence can be made up in its late window. The session then stores the missed date in `scheduledFor`. The user starts it from a dialog on start, or with "Відпрацювати" in the day panel.
- **Server:** a new `GET /api/v1/calendar`, cursor pages and `setCount` for `GET /api/v1/sessions`, and a wider `scheduledFor` rule on `PUT /api/v1/sessions/{id}`. There is no migration.
- **Client:**
  - status markers and a month summary (the summary is also the legend) on `/calendar`;
  - past-day rows in the day panel;
  - a "Місяць / Список" toggle with a history list;
  - the make-up dialog;
  - three new Today cards: the week, adherence and the last session.

"Today" always means the calendar date in the profile time zone (`profile.timeZone`), as `YYYY-MM-DD`. The "start date" of a session is the date of `startedAt` in the profile time zone.

## 2. Acceptance criteria

- **AC1:** Unit tests of `computeCalendar()` (`src/shared/plan/statuses.ts`) cover:
  - done on time: a completed session with `scheduledFor = D` and start date D;
  - done late: start date after D and not after the late window end;
  - missed: D before today and no fulfilling session;
  - planned: D today or later and no fulfilling session;
  - the late window: it ends on the earlier of the day before the next occurrence of the same workout (any rule) and D + 7;
  - an empty window (the next occurrence is D + 1);
  - two completed sessions for one occurrence: the one that started first fulfils it, and the other is extra;
  - in-progress and abandoned sessions change nothing;
  - a completed session with `scheduledFor = null` is extra on its start date.
  - The same cases run with `process.env.TZ` and the profile zone set to `Europe/Kyiv` and to `America/New_York`, including a session that starts at 23:30 local time on the day before a DST change.
- **AC2:**
  - The calendar grid, the week strip and the day panel show each status with its own marker: on time is a filled accent diamond; late is an accent outline; missed is a destructive outline; planned is a planned outline; extra is a filled muted diamond.
  - Each marker sits next to a text label in the month summary counts and in the day panel rows.
  - Each grid cell has an `aria-label` that names the statuses ("16 листопада, пропущено").
- **AC3:**
  - Adherence = (on time + late) ÷ due occurrences, rounded to a whole percent.
  - Due occurrences of a range are the ones before today, plus the ones on today that are done.
  - 8 due, 5 on time and 1 late give "75%".
  - A planned, not done occurrence today is not due. Extra sessions do not count.
  - With 0 due occurrences the percent is "—", and the diamond row is hidden.
- **AC4:**
  - A tap on a past day shows one row per occurrence and per completed session of that day.
  - A session row is a link to `/session/{id}` (the spec 10 summary).
- **AC5:**
  - The history list (`/calendar?view=list`) shows the first 20 completed sessions, newest first, grouped by month.
  - When the end sentinel scrolls into view, it loads the next 20 with the cursor from the previous page.
  - When `nextCursor` is null, it stops.
- **AC6:**
  - Workout W has a missed occurrence D, and today is in D's late window. W is not planned today without a session. When the user starts W from any start path, the dialog "Відпрацювати понеділкове Push Day?" opens.
  - "Так, відпрацювати" starts the session with `scheduledFor = D`. After it is completed, D shows as done late.
  - "Ні, просто тренування" starts it with `scheduledFor = null`. After it is completed, it shows as extra.
  - Escape or a tap on the scrim starts nothing.
- **AC7:**
  - "Відпрацювати" and the line "Можна відпрацювати до {date}." show on a missed occurrence only while its late window includes today.
  - The button starts the session with `scheduledFor = D` and no dialog.
- **AC8:** `PUT /api/v1/sessions/{id}` answers 400 `VALIDATION_FAILED` with path `['scheduledFor']` when `scheduledFor` is neither of these:
  - the start date;
  - a date D before the start date when W occurs on D in the user's non-deleted rules, and the start date is not after the late window end of D.
- **AC9:**
  - `GET /api/v1/calendar` runs the same number of SQL queries for a 7-day range with no data and a 62-day range with rules and sessions. The test asserts 3.
  - A range longer than 62 days, or `to` before `from`, gives 400.
- **AC10:** Today shows these three cards:
  - "Цей тиждень": hidden when the user has no schedule rules;
  - "Дотримання плану": hidden when the user has no schedule rules;
  - "Останнє тренування": hidden when the user has no completed session.
- **AC11:** Offline, a session that the user finishes on this device shows its status in the calendar and on Today at once. The Dexie row is merged into the statuses.
- **AC12:** `/calendar` (month and list), Today and the make-up dialog work at 390×844 and 1440×900, in en and uk, light and dark, with no horizontal scroll.

## 3. Data

No migration and no table change. `workout_session.scheduled_for` keeps its meaning: the occurrence date that the session fulfils.

### Constants — `src/constants/plan.ts` (add)

```ts
export const LATE_WINDOW_DAYS = 7;
export const CALENDAR_RANGE_MAX_DAYS = 62;
export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_PAGE_MAX = 50;

export const OCCURRENCE_STATUS = {
  ON_TIME: 'on_time',
  LATE: 'late',
  MISSED: 'missed',
  PLANNED: 'planned',
} as const;
export type OccurrenceStatus = ValueOf<typeof OCCURRENCE_STATUS>;

export const SESSION_KIND = { ON_TIME: 'on_time', LATE: 'late', EXTRA: 'extra' } as const;
export type SessionKind = ValueOf<typeof SESSION_KIND>;
```

### Status math — `src/shared/plan/statuses.ts` (pure, new)

This file has no I/O. It works on `YYYY-MM-DD` strings with the helpers from `occurrences.ts`. It uses `todayIn(timeZone, date)` from `src/lib/dates.ts` to get a start date.

```ts
export interface StatusRule extends RuleShape { id: string; workoutId: string; workoutName: string }
export interface StatusSession {
  id: string; workoutId: string | null; workoutName: string;
  scheduledFor: string | null; status: SessionStatus;
  startedAt: string; finishedAt: string | null; setCount: number;
}
export interface CalendarOccurrence {
  ruleId: string; workoutId: string; workoutName: string;
  status: OccurrenceStatus; sessionId: string | null; lateWindowEnd: string | null;
}
export interface CalendarSession extends StatusSession { kind: SessionKind }
export interface CalendarDay { date: string; occurrences: CalendarOccurrence[]; sessions: CalendarSession[] }
```

- **`startDateOf(session, timeZone)`:** returns `todayIn(timeZone, new Date(session.startedAt))`.
- **`lateWindowEnd(rules, workoutId, date)`:**
  - Let `next` be the earliest `nextOccurrence(rule, date)` over the rules of that workout. Null means no next occurrence.
  - The end is `min(addDays(next, -1), addDays(date, LATE_WINDOW_DAYS))`, or `addDays(date, 7)` when `next` is null.
  - If the end is before `addDays(date, 1)`, return null (an empty window).
- **`sessionKind(session, timeZone, windowEnd)`:**
  - `extra` when `scheduledFor` is null;
  - `on_time` when the start date equals `scheduledFor`;
  - `late` when the start date is after `scheduledFor` and not after `windowEnd`;
  - `extra` in every other case. A local or old row can be out of the window, and it then does not fulfil anything.
- **`computeCalendar({ rules, sessions, from, to, today, timeZone })` returns `CalendarDay[]`**, one entry per date from `from` to `to`:
  1. Use only sessions with `status === 'completed'`.
  2. Occurrences: for each rule, `expandOccurrences(rule, from, to)`. Each one gets `lateWindowEnd(rules, rule.workoutId, date)`.
  3. Group the completed sessions with `scheduledFor` by the key `workoutId|scheduledFor`, sorted by `startedAt` ascending. The first session whose kind is `on_time` or `late` fulfils the occurrence with the same key, if that occurrence exists in `rules`. Every other session gets `kind = 'extra'`.
  4. The occurrence status is:
     - the kind of the fulfilling session;
     - else `missed` if `date < today`;
     - else `planned`.
  5. Sessions go into the day of their start date, when it is in the range. Sort them by `startedAt`.
  6. Occurrences in a day are sorted: not done first, then by workout name.
- **`summarize(days, from, to, today)`** returns `{ onTime, late, missed, planned, extra, due, done, percent, dueRow }` for the days in `[from, to]`:
  - `due` counts the occurrences with `date < today`, plus those with `date === today` and status `on_time`;
  - `done = onTime + late`;
  - `percent = due ? Math.round(done / due × 100) : null`;
  - `planned` counts the occurrences with status `planned`;
  - `extra` counts the sessions with `kind === 'extra'`;
  - `dueRow` is the status of each due occurrence in date order. It drives the diamond row.
- **`findMakeUpDate({ days, workoutId, today })`:** the latest occurrence date of that workout with status `missed` and `lateWindowEnd ≥ today`, else null.

Unit tests: `src/shared/plan/__tests__/statuses.test.ts` (node project). The time zone cases set `process.env.TZ` in each `describe`.

### Zod — `src/shared/schemas/calendar.ts` (new)

- `calendarQuerySchema`, `.strict()`, has `{ from: calendarDateSchema, to: calendarDateSchema }`. Its refine requires `from ≤ to` and `daysBetween(from, to) + 1 ≤ CALENDAR_RANGE_MAX_DAYS`, with path `['to']`.
- `calendarOccurrenceSchema`, `calendarSessionSchema` (the session list item fields plus `setCount: int ≥ 0` and `kind`), `calendarDaySchema`.
- `calendarResponseSchema` is `{ today: calendarDate, days: CalendarDay[] }`.
- Types: `CalendarQuery`, `CalendarResponse`.

### Session schema changes — `src/shared/schemas/session.ts`

- `sessionListQuerySchema` gains:
  - `limit`: `z.coerce.number().int().min(1).max(HISTORY_PAGE_MAX).optional()`;
  - `cursor`: `z.string().max(200).optional()`.
- `sessionListItemSchema` gains `setCount: z.number().int().min(0)`.
- `sessionListResponseSchema` gains `nextCursor: z.string().nullable()`. The value is always null when `limit` and `cursor` are both absent.
- The existing callers (`fetchSessions` users, `DeleteExerciseDialog`, `useStartSession`, `useTodaySessions`) read only `items`. They do not change.

### Local rows

`localSessionSchema` is unchanged. Dexie gets no version bump, because nothing new is indexed.

## 4. API

All routes use `withHandler({ auth: 'required' })`, scope every query by `userId`, and send `Cache-Control: private, no-store`.

| Method and path | Query / body | Response | Notes |
| --- | --- | --- | --- |
| `GET /api/v1/calendar` | `from`, `to` (`calendarQuerySchema`) | `{ today, days }` | 400 `VALIDATION_FAILED` for a bad range. It runs exactly 3 queries (section 5). A user with no profile gets 404 `PROFILE_NOT_FOUND`, as `userToday` throws now. |
| `GET /api/v1/sessions` | + `limit`, `cursor` | `{ items, nextCursor }` | Items gain `setCount`. See "Cursor pages" below. |
| `PUT /api/v1/sessions/{id}` | `scheduledFor` rule widened | as now | See "Make-up validation" below. A replay of an existing id still returns the stored row with no checks. |

**Cursor pages:**

- With `limit` or `cursor`, the order is `started_at desc, id desc`, and the page size is `limit ?? HISTORY_PAGE_SIZE`.
- The cursor is base64url of the JSON `{ "s": startedAt ISO, "i": id }` of the last item.
- The next page uses the condition `(started_at, id) < ($s, $i)`.
- The query fetches `size + 1` rows. `nextCursor` is set when the extra row exists.
- A cursor that does not decode, or does not have a valid ISO date and a UUID, gives 400 `VALIDATION_FAILED` with path `['cursor']`.
- Without `limit` and `cursor`, the order and the 200 cap stay as now, and `nextCursor` is null.

**`setCount`:** a correlated subquery in the same select: `(select count(*) from set_log where session_id = workout_session.id and deleted_at is null)`. The list stays one query.

**Make-up validation** (`putSession`, inside its transaction, after the checks that exist now):

1. `start = await userToday(tx, userId, new Date(input.startedAt))`.
2. If `scheduledFor === start`, accept it, as now.
3. If `scheduledFor < start`:
   - load `listWorkoutRules(tx, userId, input.workoutId)` (non-deleted rules);
   - accept when one of them has `occursOn(rule, scheduledFor)`, and `lateWindowEnd(rules, workoutId, scheduledFor)` is not null and `≥ start`.
4. Otherwise throw `invalid(['scheduledFor'], 'Not a day this session can fulfil')`.

The server does not check if another session already fulfils that date. `computeCalendar` picks the session that started first.

Idempotency does not change: sessions use client ids (`request-safety.md`), and the calendar and list are reads.

Update `docs/tech/API.md`:

- the calendar row in the table, and a new "Calendar (spec 12)" section with the shape above;
- the sessions list paragraph (`limit`, `cursor`, `nextCursor`, `setCount`);
- the `scheduledFor` rule on `PUT`.

Update `docs/tech/DATA_MODEL.md`:

- the `workout_session.scheduledFor` note: "the occurrence date this session fulfils; the start date, or a missed date in its late window (spec 12)";
- "Derived values" → **Adherence**, with the due rule and the late window.

## 5. Server

- **`src/server/calendar/`** (new domain, `import 'server-only'`):
  - `queries.ts`: `listCalendarSessionRows(db, userId, fromInstant, toInstant, from, to)` is one select of completed sessions where `user_id = $1 and status = 'completed' and ((started_at >= $fromInstant and started_at < $toInstant) or scheduled_for between $from and $to)`, with the `setCount` subquery and `workoutName` from `workout_snapshot->>'name'`.
    - `fromInstant` = `from` at 00:00 UTC minus 14 hours.
    - `toInstant` = `to` + 1 day at 00:00 UTC plus 14 hours.
    - `computeCalendar` then drops the rows whose start date in the profile zone is outside the range.
  - `service.ts`: `getCalendar(userId, { from, to }, db = getDb())` makes 3 queries in this order:
    1. `findProfileRow` for the time zone and `today`;
    2. `listRuleRows(db, userId)` from `server/plan/queries.ts`, mapped to `StatusRule` with `workoutName` from the join;
    3. `listCalendarSessionRows`.
    - Then it returns `{ today, days: computeCalendar(…) }`.
    - It makes no query per day or per rule.
- **Route:** `src/app/api/v1/calendar/route.ts`: `GET = withHandler({ auth: 'required', query: calendarQuerySchema }, ({ userId, query }) => json(await getCalendar(userId, query)))`.
- **`src/server/sessions/queries.ts`:** `listSessionRows` takes `{ limit?, cursor? }` (the decoded cursor) and selects `setCount` as above. In cursor mode it uses the new order and the row comparison (`sql\`(${startedAt}, ${id}) < (${s}, ${i})\``).
- **`src/server/sessions/service.ts`:**
  - `listSessions` decodes the cursor with `decodeHistoryCursor` (in a new file `src/server/sessions/cursor.ts`, with `encodeHistoryCursor`). A bad cursor throws `invalid(['cursor'])`.
  - It returns `nextCursor`, and `setCount` on items.
  - `putSession` gets the make-up validation from section 4.
  - `listWorkoutRules` and `lateWindowEnd` are imported. The plan domain owns the rules, and `statuses.ts` is shared code.
- **Scoping:** every new or changed query filters `user_id = userId`. `listWorkoutRules` already does.

## 6. Client

### API modules

- **`src/api/calendar.ts`** (new):
  - `calendarKeys = { all: ['calendar'], range: (from, to) => [...all, from, to] }`;
  - `fetchCalendar({ from, to })` through `http`, parsed with `calendarResponseSchema`;
  - `useCalendarQuery(range, { enabled })` with `staleTime` 30 s.
- **`src/api/sessions.ts`:**
  - `listQuery` adds `limit` and `cursor`;
  - add `sessionKeys.history()` and `useSessionHistoryQuery()`. This is a `useInfiniteQuery` with `initialPageParam: null`, `queryFn: ({ pageParam }) => fetchSessions({ status: 'completed', limit: HISTORY_PAGE_SIZE, cursor: pageParam ?? undefined })` and `getNextPageParam: (last) => last.nextCursor`.
- **Invalidation:** the outbox runner invalidates `calendarKeys.all` and `sessionKeys.history()` after a successful flush that included a session `PATCH` with `status: completed`. This lives in `src/services/local-db/useOutboxRunner.ts`, next to the invalidation it already does. If it does none, add one `queryClient.invalidateQueries` call there. Rule mutations in `src/api/plan.ts` also invalidate `calendarKeys.all`.

### Local sessions — `src/services/local-db/`

- **`scheduled.ts`:** add `findCompletedSessionsBetween(db, fromInstant, toInstant, from, to)`. It returns the completed local sessions whose `startedAt` is in the instant range or whose `scheduledFor` is in `[from, to]`. Each has `setCount`, the count of the session's `setLogs` with `deletedAt === null` (one `where('sessionId').anyOf(ids)` read). It is mapped to `StatusSession`.
- **`hooks.ts`:** `useLocalCompletedSessions(userId, from, to)` is a `useLiveQuery` over the function above. It computes the instants as the server does.
- **`index.ts`:** export both.

### Plan domain — `src/features/plan/`

- **`hooks/usePlanToday.ts`:** add `usePlanTimeZone()`. It returns `profile.timeZone`, or the device zone while the profile loads, as `usePlanToday` does now.
- **`hooks/useCalendarDays.ts`** (new) is `useCalendarDays(from, to)`. It returns `{ status: 'loading' | 'error' | 'ready', historyKnown, days: Map<string, CalendarDay>, rules }`:
  - `rules`: `useScheduleRulesQuery()`, live and ended, mapped to `StatusRule`.
  - `remote`: `useCalendarQuery({ from, to }, { enabled: online })`.
  - `local`: `useLocalCompletedSessions(userId, from, to)`.
  - `sessions`: `remote.data.days.flatMap(d => d.sessions)` merged with `local` by id. The local row wins.
  - `days`: `computeCalendar({ rules, sessions, from, to, today: usePlanToday(), timeZone: usePlanTimeZone() })`. The client always computes the statuses itself, so unsynced sessions count at once (AC11).
  - `historyKnown = Boolean(remote.data)`. While it is false, the hook maps `missed` to `planned` and the summary is hidden. Without server data, a past day cannot be called missed.
  - `status`:
    - `loading` until the rules load;
    - `error` when the rules failed and there is no cache;
    - `ready` otherwise.
    - A failed calendar request alone leaves `historyKnown` false. It does not cause an error state.
- **`hooks/useMakeUpPrompt.tsx`** (new) has a React context, because the repo has no Zustand:
  - `MakeUpPromptProvider` renders the dialog (below) and provides `ask({ workoutName, date }) → Promise<'make_up' | 'plain' | 'cancel'>`.
  - `useMakeUpPrompt()` returns `ask`. Without a provider, `ask` resolves `'plain'`, so the existing component tests that render start buttons keep working.
  - Mount the provider in `src/features/app-shell/AppShell/AppShell.tsx` around `children`.
- **`MakeUpDialog`** (in the same folder, board `HMakeUp`):
  - `ConfirmDialog stacked` with `title = t(makeUpTitleKey(weekday), { name })` (section 7);
  - `description = t('{{name}} was planned for {{date}}. If you make it up now, the calendar shows it as done late.', { name, date: dayMonth(locale, date) })`;
  - `confirmLabel = t('Yes, make it up')` (primary, not destructive) and `cancelLabel = t('No, just a workout')`.
  - The cancel button resolves `'plain'`. Escape, the close button and the scrim resolve `'cancel'`. `ConfirmDialog`'s cancel button calls `onOpenChange(false)`. Give `MakeUpDialog` its own handlers: the cancel button resolves `'plain'`, and `onOpenChange(false)` from Radix (Escape or scrim) resolves `'cancel'`. If `ConfirmDialog` cannot tell the two apart, add an optional `onCancel` prop to it. It defaults to `onOpenChange(false)`.
- **`StatusMarker`** (`src/features/plan/StatusMarker/StatusMarker.tsx`): `({ status: OccurrenceStatus | 'extra', size: 'sm' | 'md' | 'lg' })` renders `Diamond`:

  | status | Diamond |
  | --- | --- |
  | `on_time` | `tone="accent"` fill |
  | `late` | `tone="accent" variant="outline"` |
  | `missed` | `tone="destructive" variant="outline"` |
  | `planned` | `tone="planned" variant="outline"` |
  | `extra` | `tone="muted"` fill |

  - **Sizes:** `sm` 7px with 1.5px outline (`border-[1.5px]`), `md` 8px with 1.5px outline, `lg` 10px with 2px outline.
  - **`Diamond` change** (`src/components/Diamond/Diamond.tsx`): add `muted: { fill: 'bg-muted-foreground', outline: 'border-muted-foreground' }` to `TONE`, and `xs: 'size-2'` to `SIZE` for 8px.
- **`MonthSummary`** (`src/features/plan/MonthSummary/MonthSummary.tsx`, boards `HMissed`, `HDesktop`): props `{ summary, variant: 'counts' | 'sentence', monthLabel? }`.
  - **Head row:** `h2` "Дотримання плану" (16px, 700), and on the right the percent (`formatPercent` / "—", 20px, 800, `tabular-nums`).
  - **`AdherenceRow`:** `role="img"`, `aria-label` "{{done}} з {{due}} запланованих тренувань виконано". It shows one `StatusMarker size="lg"` per `dueRow` item, `flex-wrap gap-[9px]`. It is hidden when `due === 0`.
  - **`counts` (calendar):** a `ul` with `flex-wrap gap-x-4 gap-y-1.5 text-sm`. One `li` per non-zero count, in the order on time, late, missed, planned, extra. Each has a `StatusMarker sm`, a bold number and the label. The planned and extra labels are muted, with the number in `--foreground`.
  - **`sentence` (Today):** one muted 14px sentence. With `due > 0`: "{{done}} з {{due}} тренувань за планом у {{month}}: {{onTime}} вчасно, {{late}} із запізненням, {{missed}} пропущено.". With `due === 0`: "У {{month}} ще немає тренувань за планом.".
- **`formatPlanDate.ts`** (extend):
  - `dayMonth(locale, date)` gives "16 листопада" / "November 16";
  - `weekdayFor(t, date)` gives the `_for` context ("четвер" / "Thursday");
  - `weekdayShort(locale, date)` gives "чт" / "Thu";
  - `windowEndLabel(locale, date)` gives "середи, 18 листопада" / "Wednesday, November 18". In uk this is the genitive weekday: add the weekday context `_until`.
  - `formatDuration(t, seconds)` gives "52 хв" / "1 год 05 хв" (keys in section 7). Minutes are rounded down. Under 1 minute it shows "1 хв".
- **`index.ts`:** export `useCalendarDays`, `MakeUpPromptProvider`, `useMakeUpPrompt`, `StatusMarker`, `MonthSummary` and the new formatters.

### Session start — `src/features/session/hooks/useStartSession.ts`

- The signature becomes `start(workoutId, options?: { makeUpFor?: string })`.
- After the in-progress check, and before the workout fetch:
  1. If `options.makeUpFor` is set, `scheduledFor = options.makeUpFor`, with no dialog (AC7).
  2. Else `planned = await plannedDateFor(workoutId)`. When it is not null, `scheduledFor = planned`, as now.
  3. Else `date = await makeUpDateFor(workoutId)`:
     - `today = await planTodayForStart(queryClient)`. When it is null, `date = null`.
     - `range = [addDays(today, -8), addDays(today, -1)]`.
     - `remote`: online, `queryClient.fetchQuery({ queryKey: calendarKeys.range(...range), queryFn })`, with failures ignored. Offline, the cached data for that key, if any.
     - `local = await findCompletedSessionsBetween(db, …)`.
     - Compute `computeCalendar` with the cached or fetched rules (as `plannedDateFor` loads them), then `findMakeUpDate`.
  4. When `date` is not null, `choice = await ask({ workoutName, date })`:
     - `'cancel'` returns `false` with no session;
     - `'make_up'` sets `scheduledFor = date`;
     - `'plain'` sets `scheduledFor = null`.
- **Pending state:** `pending` stays true while the dialog is open, so a double tap does not open two dialogs.
- **Callers:**
  - every start path (`PlannedRow`, `PlannedCard`, `StartWorkoutSheet`, `WorkoutList`, the editor) keeps calling `start(workoutId)`;
  - only the new day panel button passes `makeUpFor`.

### Route and URL — `src/features/calendar/PlanCalendar/PlanCalendar.tsx`

- Read `useSearchParams()`:
  - `date` (a valid `YYYY-MM-DD`) sets the first `selected` and `month`, and counts as `touched`;
  - `view=list` shows the list.
- The toggle calls `router.replace` with `?view=list` or with no `view`. It keeps `date` only in month view.
- The page is a client component already. Wrap `PlanCalendar` in `Suspense` in `calendar/page.tsx`, because `useSearchParams` needs it.

### Calendar month view (boards `HMissed`, `HLate`, `HDesktop`)

- **View toggle `CalendarViewToggle`** (`src/features/calendar/CalendarViewToggle/`):
  - It is `SegmentedControl` with `name="calendar-view"`, `legend` "Вигляд" (hidden), and the options "Місяць" / "Список".
  - On mobile it is full width, above `MonthHeader`.
  - On desktop it is 220px inside `MonthHeader`, before the arrows. Pass it as a `toggle` slot prop.
- **`PlanCalendar`** calls `useCalendarDays(dates[0], dates.at(-1))` for the visible 6-week grid. The grid is at most 42 days, under the 62-day limit. It passes `days` to `MonthGrid` and `DayPanel`. `summary = summarize(days, monthStart, monthEnd, today)`.
- **`MonthGrid`:**
  - **markers:** the markers come from `days.get(date)`, one per occurrence and one per `extra` session, in date order: occurrences sorted by workout name, then extras by `startedAt`.
  - **compact:** `StatusMarker size="sm"`, up to 3, then "+N", as now.
  - **full (desktop):** one line per marker with `StatusMarker size="md"` and the name. A missed line uses `text-destructive-text`, and a planned line `text-muted-foreground`. A late session on its own start day adds a line `t('{{name}}, for {{weekday}}', { name, weekday: weekdayShort(...) })` with the late marker.
  - **`aria-label`:** "{date}, {status labels joined with ', '}", plus ", сьогодні" for today. Use `dayMonth` for the date. This replaces "заплановано: N".
  - `occurrencesByDate` in `utils.ts` is not used here any more. Keep it if other code imports it, otherwise remove it.
- **`MonthSummary variant="counts"`:**
  - **placement:** on mobile, under the grid, in a section with `border-t border-border-strong pt-3.5`. On desktop, the first block in the 340px right column, in a `rounded-lg bg-card p-4` card, above `DayPanel`.
  - **when it shows:** only when `month ≤ monthOf(today)` and `historyKnown`.
- **`DayPanel`** gets `day: CalendarDay | undefined`. The rules list stays for edit and delete.
  - **today and future:** as now, with `PlannedRow`.
  - **past days:**
    - one `MissedRow` per `missed` occurrence;
    - one `SessionRow` per completed session of the day. This includes a late session for another day and extras.
    - A fulfilled occurrence is shown only through its session row on the occurrence day. When the session started on a later day, a `SessionRow` for the same session also renders on the occurrence day, with `variant="occurrence"`.
    - A past day with nothing on it keeps the existing empty card. "Запланувати тренування" is already hidden for past days.
- **`MissedRow`** (`src/features/calendar/MissedRow/`, board `HMissed`):
  - a `rounded-lg bg-card p-3 flex flex-col gap-3` block;
  - **row:** a 48px `ExerciseImage` thumbnail (the first of the library item's `thumbnailUrls`), the name (16px bold), and under it `StatusMarker sm` with "Пропущено" in `text-destructive-text` (14px, 600).
  - **when `lateWindowEnd ≥ today`:**
    - a muted 14px line `t('You can make it up until {{date}}.', { date: windowEndLabel(...) })`;
    - a full-width primary `Button` "Відпрацювати", which calls `start(workoutId, { makeUpFor: date })`.
    - It is disabled while `pending`. It stays enabled offline.
- **`SessionRow`** (`src/features/calendar/SessionRow/`, board `HLate`):
  - a `next/link` to `/session/{id}`, `min-h-16`, `flex items-center gap-3 px-3 py-3 pr-2`, with a `ChevronRight` (muted) at the end;
  - a 48px thumbnail (`self-start`), then a column:
    - the name (16px bold);
    - the status line: `StatusMarker sm` with the label. `on_time` shows "Вчасно". `late` shows "Із запізненням" in `variant="occurrence"`, and `t('Done late, for {{weekday}}', { weekday: weekdayFor(t, scheduledFor) })` on the start day. `extra` shows "Додаткове".
    - only `late` + `variant="occurrence"`: a muted line `t('Done {{date}}', { date: nextDateLabel(locale, startDate) })` ("Виконано у пʼятницю, 6 листопада");
    - a muted `tabular-nums` line `t('{{time}}, {{duration}}, {{count}} sets', …)`. `time` is the start time in the profile zone (`Intl` `hour: '2-digit', minute: '2-digit'`). `duration` is `formatDuration(finishedAt − startedAt)`.
  - A card `ul` with `divide-y divide-border` holds the session rows. Missed rows sit above it.

### History list (boards `HList`, `HListEmpty`, `HDesktopList`)

- **`HistoryList`** (`src/features/history/HistoryList/HistoryList.tsx`, `'use client'`), rendered by `PlanCalendar` when `view === 'list'`, under the toggle.
  - **data:** `useSessionHistoryQuery()` merged with `useLocalCompletedSessions` for the last 62 days. Local rows not in the loaded pages are inserted by `startedAt`. A local row is shown only if it is newer than the oldest loaded item, or if the list has no more pages.
  - **kind:** `sessionKind(item, timeZone, null)`, but `late` is accepted for any start date after `scheduledFor`, because the server already checked the window.
  - **grouping:** by the start month in the profile zone. The heading is `Intl` `{ month: 'long', year: 'numeric' }` with a capital first letter (16px, 700).
  - **mobile row** (a `next/link` to `/session/{id}`, `min-h-16`):
    - a 36px date column: the short weekday (13px, muted, 600) over the day (20px, 800, `tabular-nums`);
    - the name (16px bold);
    - the status line (`StatusMarker sm` + label: "Вчасно", "Із запізненням, за четвер", "Додаткове");
    - the muted "18:40, 52 хв, 16 підходів" line;
    - a chevron.
  - **desktop (`lg:`):** a `table` in one `rounded-lg bg-card` card, max width 1000px. The columns are "Дата" (`{weekdayShort}, {dayMonth}`, 600), "Тренування" (700, the link), "Статус" (marker + label), "Початок", "Тривалість", "Підходи" (muted, `tabular-nums`) and an empty chevron column (`sr-only` header "Підсумок").
    - Rows are 56px, with `border-t border-border`.
    - A month row is `th scope="rowgroup" colSpan=7` (16px, 700).
    - The whole row is clickable: the name cell holds the link, and a `::after` overlay on the link covers the row (`relative` on `tr`).
  - **desktop header:** `h1` "Історія тренувань" (30px, 800) with the 220px toggle on the right. On mobile the `h1` is `sr-only`.
  - **paging:** an end sentinel `div` watched by `IntersectionObserver` (`rootMargin: '200px'`) calls `fetchNextPage()` when `hasNextPage && !isFetchingNextPage && online`.
  - **end line:** `role="status"`, centered, 14px, muted, `min-h-12`:
    - while fetching: `StatusMarker planned lg` + "Завантажуємо старіші тренування";
    - offline with `hasNextPage`: the `WifiOff` icon + "Старіші тренування зʼявляться, коли буде інтернет.";
    - nothing when there are no more pages.
  - **loading (first page):** one card with 3 `Skeleton` rows (64px), `aria-busy="true"`.
  - **error with no data:** reuse `CalendarError` with the text "Не вдалося завантажити історію." and retry → `refetch()`. Give `CalendarError` a `message` prop.
  - **empty** (`HListEmpty`, no server items and no local items): a `rounded-lg bg-card` card, `px-5 pt-6 pb-5`:
    - a 22px dashed `--planned` diamond;
    - "Тут буде твоя історія" (20px, 800);
    - "Заверши перше тренування, і воно зʼявиться в цьому списку." (muted);
    - a primary `Button` "Почати тренування", which opens the Start sheet. Use the existing open-sheet action from `features/app-shell`, as the Today empty state does. It is full width below `sm`.

### Today (boards `HToday`, `HDesktopToday`)

- **`TodayView`** renders, after `TodayPlan`, a new `TodayHistory` (`src/features/today/TodayHistory/TodayHistory.tsx`).
- **range:** `from = min(monthStart, mondayOf(today))`, `to = max(monthEnd, addDays(mondayOf(today), 6))`, with one `useCalendarDays(from, to)`. The range is at most 43 days.
- **layout:**
  - mobile: a column with gap 14px, in the order week, adherence, last session;
  - desktop (`lg:`): `TodayView` becomes a two-column flex, max width 1040px. The left column (flex 1) has `TodayPlan` and `LastSessionCard`. The right column (380px) has `WeekCard` and `AdherenceCard`.
  - `GymNudgeCard` and `InstallCard` stay above, at full width.
- **`WeekCard`** (shows when `rules.length > 0`):
  - a `rounded-lg bg-card px-3 pt-3.5 pb-2` card;
  - the head row: `h2` "Цей тиждень" (16px, 700) and on the right `t('{{done}} of {{due}} done', summarize(week))` (14px, 600, muted);
  - an `ol` grid with 7 columns. Each `li` holds a `next/link` to `/calendar?date=YYYY-MM-DD` (`min-h-11`, `flex-col items-center gap-1.5 py-2`) with:
    - the short weekday (13px; muted 600, or `--foreground` 800 for today);
    - a 12px-tall row of `StatusMarker lg` per occurrence and extra;
    - the day number (15px, `tabular-nums`; 800 for today);
    - for today, a 14×2px `bg-foreground` bar.
  - The `aria-label` matches the grid cell label.
- **`AdherenceCard`** (shows when `rules.length > 0` and `historyKnown`): `MonthSummary variant="sentence"` in a `rounded-lg bg-card p-4` card, for the current month.
- **`LastSessionCard`** (shows when there is a latest completed session):
  - **data:** the newer of `useSessionsQuery({ status: 'completed', limit: 1 })` (online) and the latest local completed session.
  - **card:** a `rounded-lg bg-card p-4` card:
    - `h2` "Останнє тренування" (14px, 700, muted);
    - the name (22px, 800);
    - the muted line `t('{{date}}. {{duration}}, {{count}} sets', …)`, with `date` as the capitalised long weekday and `dayMonth` ("Неділя, 15 листопада");
    - on the right, a chip: `h-8 px-2.5 rounded-sm bg-background text-sm font-bold` with `StatusMarker sm` and the kind label;
    - the link "Переглянути підсумок" with a chevron to `/session/{id}`, `min-h-11`.
- The spec 11 cards do not change.

### Offline

- `useCalendarDays` keeps the last data for each range in the TanStack cache. With no data, `historyKnown` is false: past occurrences look planned, and the summary and the adherence card are hidden.
- The make-up dialog and "Відпрацювати" work offline (spec 10 starts offline).
- The history list shows the loaded pages plus local rows, and does not page offline.
- Rule changes stay disabled offline (spec 11).

## 7. Copy

Add to `src/i18n/locales/en.json` and `uk.json`. `pnpm i18n:check` must pass. Use the catalog's usual apostrophe `'`.

| Key (en) | uk |
| --- | --- |
| On time | Вчасно |
| Done late | Із запізненням |
| Missed | Пропущено |
| Planned_status | Заплановано |
| Extra | Додаткове |
| {{count}} on time | {{count}} вчасно |
| {{count}} late | {{count}} із запізненням |
| {{count}} missed | {{count}} пропущено |
| {{count}} planned (`_one/_few/_many/_other`) | {{count}} заплановано |
| {{count}} extra (`_one/_few/_many/_other`) | {{count}} додаткове / додаткові / додаткових / додаткового |
| Plan adherence | Дотримання плану |
| {{done}} of {{due}} planned workouts done | {{done}} з {{due}} запланованих тренувань виконано |
| Make up | Відпрацювати |
| You can make it up until {{date}}. | Можна відпрацювати до {{date}}. |
| Make up Monday's {{name}}? … Make up Sunday's {{name}}? (7 keys) | Відпрацювати понеділкове / вівторкове / середове / четвергове / п'ятничне / суботнє / недільне {{name}}? |
| {{name}} was planned for {{date}}. If you make it up now, the calendar shows it as done late. | {{name}} було заплановане на {{date}}. Якщо відпрацюєш зараз, у календарі воно буде виконане із запізненням. |
| Yes, make it up | Так, відпрацювати |
| No, just a workout | Ні, просто тренування |
| Done {{date}} | Виконано {{date}} |
| Done late, for {{weekday}} | Із запізненням, за {{weekday}} |
| {{name}}, for {{weekday}} | {{name}}, за {{weekday}} |
| {{time}}, {{duration}}, {{count}} sets (plural) | {{time}}, {{duration}}, {{count}} підхід / підходи / підходів / підходу |
| {{minutes}} min | {{minutes}} хв |
| {{hours}} h {{minutes}} min | {{hours}} год {{minutes}} хв |
| Month | Місяць |
| List | Список |
| View | Вигляд |
| Workout history | Історія тренувань |
| Date / Workout / Status / Start / Duration / Sets / Summary | Дата / Тренування / Статус / Початок / Тривалість / Підходи / Підсумок |
| Loading older workouts | Завантажуємо старіші тренування |
| Older workouts appear when you are online. | Старіші тренування з'являться, коли буде інтернет. |
| Couldn't load the history. | Не вдалося завантажити історію. |
| Your history will be here | Тут буде твоя історія |
| Finish your first workout, and it appears in this list. | Заверши перше тренування, і воно з'явиться в цьому списку. |
| This week | Цей тиждень |
| {{done}} of {{due}} done | {{done}} з {{due}} виконано |
| {{done}} of {{due}} planned workouts {{month}}: {{onTime}} on time, {{late}} late, {{missed}} missed. | {{done}} з {{due}} тренувань за планом {{month}}: {{onTime}} вчасно, {{late}} із запізненням, {{missed}} пропущено. |
| No planned workouts {{month}} yet. | {{month}} ще немає тренувань за планом. |
| Last workout | Останнє тренування |
| {{date}}. {{duration}}, {{count}} sets (plural) | {{date}}. {{duration}}, {{count}} підходів (plural forms as above) |
| today (cell label suffix) | сьогодні |

**Weekday contexts:** add these to the existing weekday keys:

- `_for` (en: Monday…; uk: понеділок, вівторок, середу, четвер, п'ятницю, суботу, неділю);
- `_until` (en: Monday…; uk: понеділка, вівторка, середи, четверга, п'ятниці, суботи, неділі).

**Month in the sentence:** "у листопаді" needs the locative. Add `month_in` forms for the 12 months:

- uk: "у січні", "у лютому", "у березні", "у квітні", "у травні", "у червні", "у липні", "у серпні", "у вересні", "у жовтні", "у листопаді", "у грудні";
- en: "in November".

`{{month}}` in the two sentence keys above is this form, with its preposition ("у листопаді" / "in November"). Capitalise the first letter in code for the second key ("У листопаді ще немає…").

## 8. Steps

1. **Constants and status math:** `src/constants/plan.ts` additions, then `src/shared/plan/statuses.ts` and `src/shared/plan/__tests__/statuses.test.ts` (AC1, AC3).
2. **Schemas:** `src/shared/schemas/calendar.ts`, the `session.ts` list changes, and the schema tests in `src/shared/schemas/__tests__/`.
3. **Server sessions:** `src/server/sessions/cursor.ts`, then the `listSessionRows` and `listSessions` cursor and `setCount` changes, then the `putSession` make-up validation. Extend `src/server/sessions/__tests__/service.test.ts` and `src/app/api/v1/sessions/__tests__/route.test.ts` (AC5 server side, AC8).
4. **Server calendar:** `src/server/calendar/{queries,service}.ts`, `src/app/api/v1/calendar/route.ts`, `src/server/calendar/__tests__/service.test.ts` (with the query count) and `src/app/api/v1/calendar/__tests__/route.test.ts` (AC9). Update `API.md` and `DATA_MODEL.md`.
5. **Client API:** `src/api/calendar.ts`, plus `src/api/sessions.ts` (`limit`, `cursor`, `useSessionHistoryQuery`), plus the invalidations in `src/api/plan.ts` and `useOutboxRunner.ts`.
6. **Local data:** `findCompletedSessionsBetween`, `useLocalCompletedSessions` and the exports, with a test in `src/services/local-db/__tests__/scheduled.test.ts`.
7. **Plan feature:**
   - `Diamond` tone and size;
   - `usePlanTimeZone`, `useCalendarDays`, `StatusMarker`, `MonthSummary` (with `AdherenceRow`);
   - the formatters, the exports and their tests.
8. **Make-up prompt:** `useMakeUpPrompt.tsx` (provider, dialog), the `ConfirmDialog` `onCancel` prop if needed, the provider in `AppShell`, and the `useStartSession` changes, with tests.
9. **Calendar month view:**
   - `CalendarViewToggle`;
   - the `PlanCalendar` URL params and `useCalendarDays`;
   - the `MonthGrid` markers and labels;
   - the summary placement;
   - `DayPanel`, `MissedRow`, `SessionRow`;
   - the `Suspense` in `calendar/page.tsx`.
10. **History list:** `src/features/history/HistoryList/` with the mobile rows, the desktop table, paging, the end line and the empty, loading and error states. Add the `message` prop to `CalendarError`.
11. **Today:** `TodayHistory`, `WeekCard`, `AdherenceCard`, `LastSessionCard`, and the `TodayView` desktop columns.
12. **i18n:** the keys and contexts from section 7. `pnpm i18n:check`.
13. **e2e:**
    - add `e2e/helpers/plan.ts` with direct DB inserts for past rules and completed sessions, using the `postgres` client that `e2e/helpers/db.ts` already uses;
    - write `e2e/12-history-adherence.spec.ts`.
14. **Checks:** `pnpm lint`, `pnpm typecheck` and the touched tests.

## 9. Tests

Server tests follow `docs/development/backend/testing.md`: a real DB and an own user per test. Dates are relative to `userToday`, never a fixed today. Past rules and sessions are inserted with Drizzle directly, because the API rejects past start dates.

| AC | Test |
| --- | --- |
| AC1 | `src/shared/plan/__tests__/statuses.test.ts`: every case in AC1, with `describe` blocks for `TZ=Europe/Kyiv` and `TZ=America/New_York`, and a 23:30 start before a DST change |
| AC2 | `src/features/plan/__tests__/StatusMarker.test.tsx` (`data-variant` and tone per status, through the `Diamond` `data-variant` attribute); `src/features/calendar/__tests__/PlanCalendar.test.tsx` "grid cell labels name the statuses" and "the summary lists each count with its label"; e2e screenshots in the month view |
| AC3 | `statuses.test.ts` `summarize` (8 due, 5 on time, 1 late → 75; today planned not due; extras ignored; 0 due → null); `src/features/plan/__tests__/MonthSummary.test.tsx` ("75%", "—" and no row) |
| AC4 | `PlanCalendar.test.tsx` "a past day lists its sessions as links to the summary" (mocked `fetchCalendar`); e2e "past day opens the session summary" |
| AC5 | `src/server/sessions/__tests__/service.test.ts`: "pages by cursor with no overlap or gap" (45 sessions → 20/20/5, `nextCursor` null at the end), "bad cursor is 400", "setCount counts live sets only", "without limit the list is unchanged"; `src/features/history/__tests__/HistoryList.test.tsx` "loads the next page at the end", using a mocked `IntersectionObserver` that fires; e2e "list shows 20 then more" (25 seeded sessions) |
| AC6 | `src/features/session/__tests__/useStartSession.test.tsx`: "offers the make-up for a missed occurrence in its window", "make up sends the missed date", "plain sends null", "cancel starts nothing", "no offer when the workout is planned today", "no offer after the window"; e2e "make up a missed Monday" (seeded rule and past date → dialog → finish → the calendar shows late) |
| AC7 | `src/features/calendar/__tests__/MissedRow.test.tsx` (button and line inside the window, none after it; the click calls `start` with `makeUpFor`) |
| AC8 | `src/server/sessions/__tests__/service.test.ts`: "accepts the start date", "accepts a missed date in the window", "rejects a date with no occurrence", "rejects a date after the window ends", "rejects a future date", "late outbox replay passes" (`startedAt` in the window, sent after it) |
| AC9 | `src/server/calendar/__tests__/service.test.ts` "query count is 3 for 7 and 62 days" (the counting `drizzle` logger, as in `src/server/workouts/__tests__/service.test.ts`), "another user's sessions never appear"; `src/app/api/v1/calendar/__tests__/route.test.ts` (63 days → 400, `to < from` → 400, 401 without a session) |
| AC10 | `src/features/today/__tests__/TodayHistory.test.tsx` (each card hidden in its empty case; the week links to `/calendar?date=`); e2e Today |
| AC11 | `src/features/plan/__tests__/useCalendarDays.test.tsx` "a local completed session changes the status before sync" (Dexie in the browser project); e2e offline: finish a planned session with `context.setOffline(true)` and check the calendar marker and the Today week |
| AC12 | e2e on the `mobile` and `desktop` projects: a uk pass checks `scrollWidth <= innerWidth` on `/calendar`, `/calendar?view=list`, Today and the dialog, and a dark pass (`colorScheme: 'dark'`) runs the same pages |

## 10. Risks and open questions

- **No index on `scheduled_for`:** the calendar query filters by `user_id` first through `workout_session_user_status_idx`. Per-user volume is small. If it grows, add `(user_id, scheduled_for)` in a later migration (lead approval).
- **Profile zone change:** start dates use the current profile zone. A session done before a zone change can move to another day. This is accepted. Spec 11 has the same rule for "today".
- **Two sessions for one occurrence** (two devices offline): the one that started first wins, and the other is extra. Both stay in history.
- **History before the first load:** offline with no cached calendar data, past occurrences show as planned and the summary is hidden. This is better than a false "missed".
- **The uk preposition** "у/в": "Виконано у пʼятницю" reuses the spec 11 `nextDateLabel` form ("у"). The canvas shows "в". This is a small difference, and the copy stays consistent with spec 11.
- **`GET /schedule-rules` grows** with every split (spec 11 review note). `computeCalendar` scans all rules. This is fine at the 100 active rule limit plus ended rules. Spec 16 can add a window.
- **Out of scope:** skipping one occurrence; streaks; notifications; a session details screen (spec 10 summary); full offline sync of the calendar range (spec 16).
- No blocking questions remain.

## 11. Implementation notes

- **Shared helpers:**
  - `instantRange()` lives in `src/shared/plan/statuses.ts`, not in the calendar service, because the client uses it too.
  - `linkedKind()` was added there: it gives the kind of a stored session from its link alone. The history list and the last session card use it.
- **Server statuses win for remote sessions:** the client keeps an occurrence's server status when the server saw a fulfilling session that is not in the response. This happens when the session started after `to`. `useCalendarDays` and the make-up lookup both do this.
- **Make-up lookup offline:** with no cached calendar data and no network, the offer uses only this device's sessions. Online, a failed calendar request gives no offer.
- **No outbox invalidation:** finished sessions stay in Dexie, and the local copy wins in every merge, so `useOutboxRunner` does not invalidate the calendar or history queries. Rule mutations invalidate `calendarKeys.all`.
- **Start sheet context:** there was no action to open the Start sheet from page content. `StartSheetContext` (`src/features/app-shell/StartSheetContext.tsx`) now opens it, for the empty history card.
- **Desktop toggle:** "Місяць / Список" sits in the page header row on desktop, not in the month row. In the month row it truncated "Листопад 2026" at 1440. The list view uses the same header with the title "Історія тренувань", so `HistoryList` has no header of its own.
- **Toggle style:** the toggle is the existing `SegmentedControl`. The selected option is primary-filled, not the canvas's card-on-background style.
- **Context keys:**
  - "Plan adherence" uses the context `history` ("Дотримання плану"), because the landing page already uses "Виконання плану" for the same English key.
  - The "Початок" table header uses `Start_column`.
- **Calendar loading:** `CalendarStates` got `'use client'`, because `calendar/page.tsx` now uses `CalendarSkeleton` as the `Suspense` fallback.
- **Spec 11 test changes:**
  - The grid cell label changed from "{date}, N planned" to "{date}, {statuses}". `e2e/11-calendar-plan.spec.ts` and `PlanCalendar.test.tsx` were updated.
  - The spec 11 test "hides the menu of an ended rule" is now "shows a past planned day as missed": past days show statuses, not rule rows.
- **Test files:**
  - The session paging and make-up server tests are in `src/server/sessions/__tests__/history.test.ts`, with shared fixtures in `src/test/history-fixtures.ts`.
  - The local lookup test is `scheduled.test.tsx`, a browser test, because it needs IndexedDB.
  - Other list mocks gained `nextCursor` and `setCount`.
- **e2e:**
  - It seeds past rules and finished sessions through `e2e/helpers/plan.ts`. The make-up test checks the `PUT` body for `scheduledFor`, then inserts the finished make-up. It does not finish a session through the UI, because that flow stalled on CI before.
  - The offline case (AC11) is covered by `useCalendarDays.test.tsx` only.
- **Copy:** "Виконано у п'ятницю" uses "у" from the spec 11 date form, as section 10 planned.

## 12. Review — 2026-11-17

**Verdict:** Pass with notes

Screenshots: `scratch/review/12-history-adherence/`, 44 files, uk light at 390 and 1440, plus uk dark and en passes. The UI walk had no page errors. The change set is the uncommitted diff on `feat/12-history-adherence`. The diff also holds the `ste` skill and the `drill` → `grilling` rename, which the lead asked to ship with this spec.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `src/shared/plan/__tests__/statuses.test.ts` (every status, the window cases, two sessions, in-progress and abandoned, extras, `Europe/Kyiv` and `America/New_York` across DST) |
| AC2 | Pass | `src/features/plan/__tests__/StatusMarker.test.tsx`; `PlanCalendar.test.tsx` "names the statuses in the cells…"; `AC2-{mobile,desktop}-month.png`, `AC2-*-error.png` |
| AC3 | Pass | `statuses.test.ts` `summarize` (75%, today not due, extras ignored, 0 due); `MonthSummary.test.tsx`; `AC3-*-summary.png` (2 of 4 → 50%) |
| AC4 | Pass, see finding 1 | `PlanCalendar.test.tsx` "opens a past day…"; e2e "a missed day is made up…"; `AC4-*-past-on-time.png`, `AC4-*-late-planned-day.png`, `AC4-*-late-start-day.png`, `AC4-*-extra.png` |
| AC5 | Pass, see findings 2 and 3 | `src/server/sessions/__tests__/history.test.ts` (45 → 20/20/5, bad cursor, `setCount`); `HistoryList.test.tsx`; e2e "the history list loads older workouts…"; `AC5-*-list.png`, `AC5-*-empty.png`, `AC5-*-error.png`, `AC5-*-loading.png` |
| AC6 | Pass | `src/features/session/__tests__/useStartSession.test.tsx` (offer, make up, plain, cancel, planned today, after the window); e2e checks the `PUT` body; `AC6-*-dialog.png` |
| AC7 | Pass | `MissedRow.test.tsx`; `AC7-*-missed-open.png` (line and button), `AC7-*-missed-closed.png` (status only) |
| AC8 | Pass | `history.test.ts` "accepts the start date and a missed date…", "rejects a date with no occurrence, a date after the window and a future date", "closes the window before the next occurrence", "passes a late outbox replay" |
| AC9 | Pass | `src/server/calendar/__tests__/service.test.ts` "runs 3 queries…" (7 and 62 days); `src/app/api/v1/calendar/__tests__/route.test.ts` (63 days and reversed → 400, 401) |
| AC10 | Pass | `TodayHistory.test.tsx` (each card and its empty case); `AC10-*-today.png`, `AC10-*-no-plan.png` (week and adherence hidden, last workout shown) |
| AC11 | Pass | `src/features/plan/__tests__/useCalendarDays.test.tsx` (a local finished session changes the status before sync); `AC11-*-offline-calendar.png` (last data kept, "Відпрацювати" enabled). No offline e2e, as the implementation notes say. |
| AC12 | Pass, see findings 4 and 5 | e2e uk and dark overflow checks on the calendar, the list and Today; `AC12-*-dark-{month,list,today}.png`, `AC12-*-en-{month,today}.png` |

### Findings

1. [major] **Today's day panel does not show the workouts finished today.** `src/features/calendar/DayPanel/DayPanel.tsx:80` shows session rows only for past days. Today and later days keep the spec 11 planned rows.
   - **Effect:** a make-up done today ("Із запізненням, за понеділок") and an extra workout done today appear on that day only from tomorrow.
   - **Spec:** the spec says that the day when the user made a workout up shows the session row, and that day is usually today.
   - **Fix:** for today, add the session rows of `day.sessions` that are late or extra under the planned rows.
2. [minor] **The history list shows a blank page while its first page loads.** At `src/features/history/HistoryList/HistoryList.tsx:107`, the skeleton shows only while the local query is `undefined`. Dexie answers first, so nothing renders until the server answers (`AC5-*-loading.png`). The plan asks for 3 skeleton rows.
3. [minor] **Cold offline, the list says "Тут буде твоя історія" even when the server has history.** This happens with no cached page and no local sessions (`HistoryList.tsx:122`). The spec says that offline the list shows the loaded pages plus local sessions. A neutral offline line would be more honest than the empty state.
4. [minor] **A make-up line on a desktop cell is cut.** "Push Day, за сб" shows as "Push Day, …" at 1440 (`src/features/calendar/MonthGrid/MonthGrid.tsx:138`, `AC4-desktop-late-start-day.png`). The `HDesktop` board shows the full line.
5. [minor] **The desktop list and its header do not line up.** The table stops at 1000px (`HistoryList.tsx:180`), but the toggle in the page header sits at the right edge of the content (`AC5-desktop-list.png`).
6. [minor] **The make-up dialog's second button is an outlined secondary button.** The `HMakeUp` board has a ghost button. `ConfirmDialog` uses `variant="secondary"` for every stacked dialog (`src/components/ConfirmDialog/ConfirmDialog.tsx:54`), so this matches the other dialogs but not this board.
7. [minor] **The "Місяць / Список" toggle uses the existing `SegmentedControl` style**, with a dark filled selection. The canvas has a card on the background. The implementation notes record this. The lead must confirm it or ask for the canvas style.
8. [minor] **Desktop Today: the next-workout card and the last-workout card have different widths.** The next-workout card stays at 560px (`src/features/today/TodayPlan/TodayPlan.tsx:45`), but the last-workout card fills the left column (`AC10-desktop-today.png`).

### Checks

- lint: pass.
- typecheck: pass.
- tests: `pnpm test` 118 files, 727 tests, all pass. During implementation, `src/app/api/v1/me/profile/__tests__/route.test.ts` failed once and passed on 3 reruns. It is not in this diff.
- e2e: `e2e/12-history-adherence.spec.ts` 6/6 (mobile and desktop). During implementation, `05`, `10` and `11` passed, 32/32 with one sign-up timeout in `11` that passed 4/4 on rerun.
- Scope and safety:
  - every new query filters on `user_id`;
  - the new endpoint is a read, and the session `PUT` keeps its client-id idempotency;
  - no secrets or build output in the diff;
  - the deviations are in Implementation notes.

### Out of scope

- The dev server still logs "Could not validate `instant`… NEXT_REDIRECT" on `/[lang]/today` (spec 11 review).
- On phones the bottom nav covers the end of the day panel in full-page screenshots. In the app the page scrolls above it, so this is only a screenshot effect.

## 12. Review — 2026-11-17 (fixes)

**Verdict:** Pass

The lead asked to fix all findings. For 6 and 7 the fix follows the canvas, with opt-in props so that other screens do not change.

1. [major] **Fixed.** Today's day panel lists today's late and extra sessions under the planned rows (`DayPanel.tsx`). On-time sessions keep their "Виконано" planned row. Test: `PlanCalendar.test.tsx` "lists a make-up finished today…". Screenshot: `FIX1-*-today-made-up.png`.
2. [minor] **Fixed.** The first page shows 3 skeleton rows in a busy region labelled "Історія тренувань", also when Dexie answers first. Test: `HistoryList.test.tsx` "shows skeleton rows…". Screenshot: `FIX2-*-list-loading.png`.
3. [minor] **Fixed.** Offline with no loaded page and no local sessions, the list shows "Старіші тренування з'являться, коли буде інтернет." instead of the empty state. The empty state now needs a successful server answer. Test: `HistoryList.test.tsx` "does not claim an empty history offline…".
4. [minor] **Fixed.** A make-up line on a desktop cell wraps to two lines ("Push Day, / за сб") instead of being cut. Screenshot: `FIX1-desktop-today-made-up.png`.
5. [minor] **Fixed.** In list view the page header is 1000px wide, the same as the table. Screenshot: `FIX5-desktop-list-header.png`.
6. [minor] **Fixed.** `ConfirmDialog` takes `cancelVariant`. The make-up dialog uses `ghost`, and the other dialogs keep `secondary`.
7. [minor] **Fixed.** `SegmentedControl` takes `appearance="quiet"`: the selected option is a card with a strong ring on the page background, as on the canvas. Only the calendar toggle uses it. Screenshots: `FIX1-*`, `FIX5-*`.
8. [minor] **Fixed.** The next-workout card on Today fills its column, so it has the same width as the last-workout card (`TodayPlan.tsx`). Screenshot: `FIX8-desktop-today.png`.

### Checks

- lint, typecheck: pass.
- tests: 118 files, 730 tests. One test in `src/app/api/v1/me/profile/__tests__/route.test.ts` failed once and passed 3/3 on rerun. That file is not in this diff, and it failed in the same way during implementation.
- e2e: `12-history-adherence` and `11-calendar-plan`, 12/12 (mobile and desktop).
