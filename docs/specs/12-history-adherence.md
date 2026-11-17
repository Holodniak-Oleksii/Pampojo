# 12. History and adherence

## Goal

The calendar shows what really happened against the plan. The user sees missed and late workouts and how well they follow the plan.

## User stories

- As a lifter, I want to see which planned workouts I did, did late or missed, so that I know how well I follow my plan.
- As a lifter, I want to make up a missed workout later in the week, so that my history shows it as done late, not as missed.
- As a lifter, I want to open any past day and see what I did, so that I can look back at my training.
- As a lifter, I want Today to show my week and my adherence, so that I see my progress without the calendar.

## Scope

### Statuses

An occurrence is one date of one workout in the plan (spec 11). Each occurrence has one status:

- **done on time:** a completed session of that workout has `scheduledFor` = the occurrence date and started on that date;
- **done late:** a completed session of that workout has `scheduledFor` = the occurrence date and started on a later date, in the late window;
- **missed:** the date is before today, and no completed session fulfils the occurrence;
- **planned:** the date is today or later, and no completed session fulfils the occurrence.

Rules for all statuses:

- "Today" and the start date of a session use the profile time zone (`profile.timeZone`).
- Only completed sessions count. In-progress and abandoned sessions do not change a status.
- If more than one completed session has the same workout and `scheduledFor`, the session that started first fulfils the occurrence. The other sessions show as extra.
- A completed session with `scheduledFor = null` is an **extra** session. It shows on the day it started.
- Occurrences of ended rules and of deleted workouts keep their statuses. The past never changes (spec 11).
- `occurrenceStatuses()` in `src/shared/plan/statuses.ts` is a pure function that the server and the client share. It works on calendar dates, as `expandOccurrences` does.

### Late window

- The late window of an occurrence on date D starts on D + 1.
- It ends on the earlier of these two dates:
  - the day before the next occurrence of the same workout, in any of the user's rules;
  - D + 7.
- If the next occurrence of the same workout is on D + 1, the window is empty. The occurrence cannot be made up.
- The window uses the start date of the session, not the date of the sync. Thus a late outbox replay still passes.

### Adherence

- Adherence = (done on time + done late) ÷ due occurrences, rounded to a whole percent.
- Due occurrences of a month are:
  - the occurrences before today;
  - the occurrences of today that are done.
- Thus today's workout does not lower the score before the user does it.
- An occurrence counts in the month of its date, also when the user made it up in the next month.
- Extra sessions do not count.
- If a month has no due occurrences, adherence shows "—".

### Make up a missed workout

The user links a session to a missed occurrence in two ways:

1. **Prompt on start.** The user starts workout W from anywhere. The app shows the dialog "Відпрацювати понеділкове Push Day?" when all these conditions are true:
   - W has a missed occurrence whose late window includes today;
   - W is not planned today with no session (spec 11 links that start to today first, with no dialog).
   - If W has more than one such occurrence, the dialog offers the latest one.
   - "Так, відпрацювати" starts the session with `scheduledFor` = the missed date.
   - "Ні, просто тренування" starts it with `scheduledFor = null`.
   - If the user closes the dialog, no session starts.
2. **Day panel.** A missed occurrence whose late window includes today has "Відпрацювати" in the calendar day panel. It starts the session with `scheduledFor` = the missed date and no dialog.

If a session is in progress, every start opens that session (spec 10). Then neither the dialog nor "Відпрацювати" starts a new session.

### Calendar (`/calendar`)

- **Markers:** each occurrence marker in the grid and in the week strip shows its status, as `DESIGN_SYSTEM.md` "Status markers" defines. Extra sessions have a filled muted diamond.
- **Month summary and legend:** for the visible month, if it is the current month or a past month, the calendar shows the adherence and the count of each status with its marker. These labelled counts are the legend. A future month shows no summary.
- **Day panel, past day:** one row per occurrence and per session on that day. A session row has the workout name, the status label, the start time, the duration and the set count. A tap on the row opens the session summary (spec 10). A missed occurrence row has the "Пропущено" label, and "Відпрацювати" if its late window includes today.
- **Day panel, a day with a late session:** the occurrence day shows the row as done late, with the date when the user did it. The day when the user did it shows the session row with "За понеділок" (the occurrence date).
- **Day panel, today and the future:** as in spec 11.
- **URL:** `/calendar?date=YYYY-MM-DD` opens the calendar with that day selected. Today's week strip uses it.

### History list

- A toggle "Місяць / Список" at the top of `/calendar` switches between the month grid and the history list. `?view=list` keeps the list view in the URL.
- The list shows completed sessions, planned and extra, newest first. Month headings group the rows.
- A row has the date, the workout name, the status label (done on time, done late with the occurrence date, or extra), the duration and the set count. A tap opens the session summary.
- The list loads 20 sessions per page. It loads the next page when the user scrolls to the end.
- Missed occurrences are not in the list.

### Today

Today keeps the spec 11 cards and adds:

- **Week strip:** the current week, Monday to Sunday, with the status marker of each occurrence and of each extra session. A tap on a day opens `/calendar?date=…`.
- **Adherence this month:** the percent and the counts, shown as a diamond row and plain numbers (`DESIGN_SYSTEM.md`). `SegmentedGauge` is not used. The block is hidden when the user has no rules.
- **Last session:** the latest completed session with the workout name, the date, the duration and the set count, and a link to its summary. The block is hidden when the user has no completed sessions.

### Offline

- The calendar shows the last loaded range. The client applies `occurrenceStatuses()` to the local Dexie sessions that are not synced yet. Thus a workout that the user did offline shows at once.
- The make-up dialog and "Відпрацювати" work offline. They use the cached rules, and spec 10 starts sessions offline.
- The history list shows the pages that are already loaded, plus the local sessions. It loads no more pages offline.
- Rule changes stay disabled offline (spec 11).

## Out of scope

- Skipping or moving a single occurrence. A missed day stays missed. There is no `occurrence_exception` table.
- Extra sessions in the adherence score.
- Missed occurrences in the history list.
- A new screen for session details. The spec 10 summary is the details screen.
- Streaks, reminders and notifications.
- Full offline sync of the calendar range (16).

## UX

- **States:** loading, error with retry, offline (last loaded data), a month with no plan, a past day with no plan and no session, an empty history list.
- **Make-up dialog:** the stacked `ConfirmDialog` (spec 10) with a primary "Так, відпрацювати" and a ghost "Ні, просто тренування".
- **Mobile (390px)** and **desktop (1440px)** in en and uk, light and dark.

## Design

Canvas: https://claude.ai/artifact/KE2i97nBoPYQjQjF6b6RMB, the two rows under "Історія і дотримання плану (спек 12)" and "Спек 12, десктоп 1440". The spec 11 boards above them stay as they are. Every board has a `theme` tweak (light, dark).

The example data on every board: today is Tuesday, 17 November 2026. Push Day is planned on Monday and Thursday, and Ноги on Wednesday and Sunday, from 2 November.

| Board | Screen and state |
| --- | --- |
| `HMissed` | Calendar, mobile, a missed day with "Відпрацювати" |
| `HLate` | Calendar, mobile, a past day with a session done late |
| `HList` | History list, mobile. The `state` tweak shows the next page loading or offline |
| `HListEmpty` | History list, mobile, no completed sessions |
| `HToday` | Today, mobile, with the week strip, adherence and the last session |
| `HMakeUp` | Make-up dialog over the Start sheet |
| `HDesktop` | Calendar, desktop 1440, with statuses and a missed day |
| `HDesktopList` | History list, desktop 1440, as a table |
| `HDesktopToday` | Today, desktop 1440 |

### Status markers

The markers follow `DESIGN_SYSTEM.md` "Status markers". This spec adds the marker for an extra session:

| Status | Marker | Class on the canvas |
| --- | --- | --- |
| Done on time | Filled `--accent` diamond | `mk-on` |
| Done late | `--accent` outline diamond | `mk-late` |
| Missed | `--destructive` outline diamond | `mk-miss` |
| Planned | `--planned` outline diamond | `mk-plan` |
| Extra (new) | Filled `--muted-foreground` diamond (`#5C5751` light, `#B3ACA3` dark) | `mk-extra` |

- **Sizes:** 7px in the mobile grid and in rows, 8px on desktop, 10px in the adherence row and the week strip. Outlines are 1.5px, and 2px at 10px.
- **Grid:** one marker per occurrence and one per extra session, in date order, up to 3 and then "+N" (spec 11).
- **Status labels:** the status text sits next to its marker in every row. The missed label uses `--destructive-text`. Other labels use `--foreground`.

### Calendar, mobile (`HMissed`, `HLate`)

- **View toggle:** under the top bar, a full-width two-part segmented control "Місяць" / "Список" (the existing `.seg` style, 2 columns).
- **Header and grid:** as in spec 11, with status markers instead of the planned outlines. Today keeps its 14×2px bar.
- **Month summary:** under the grid, after a 1px `--border-strong` rule. This block is also the legend, so there is no separate legend.
  - The first line is "Дотримання плану" (16px, 700) and the percent on the right (20px, 800, tabular figures).
  - Then the adherence row: one 10px diamond per due occurrence, in date order, with a 9px gap. It wraps when it is wider than the column. It has `role="img"` and the label "6 з 9 запланованих тренувань виконано".
  - Then the counts, 14px, wrapped with a 16px gap: each count has its marker and a label, "5 вчасно", "1 із запізненням", "3 пропущено", "8 заплановано", "1 додаткове". The planned and extra labels are muted, with the number in `--foreground`. A count of 0 is hidden.
  - A month with no due occurrences shows "—" instead of the percent, and no diamond row.
  - A future month shows no summary.
- **Day panel, missed occurrence (`HMissed`):** a card with the thumbnail, the workout name and the "Пропущено" label. While the late window includes today, the card also has:
  - the line "Можна відпрацювати до середи, 18 листопада." (14px, muted), with the last date of the window;
  - a full-width primary "Відпрацювати".
- **Day panel, session row (`HLate`):** the whole row is a link to the session summary, at least 64px tall, with a chevron.
  - The row shows the thumbnail, the name, then the status line with its marker.
  - A done late row on the occurrence day adds "Виконано в пʼятницю, 6 листопада".
  - The last line is "18:40, 52 хв, 16 підходів" (start time, duration, set count; muted, tabular figures).
  - On the day when the user made it up, the status line reads "Із запізненням, за четвер".
  - An extra session row has the "Додаткове" label.
- **Offline:** as in spec 11. "Відпрацювати" stays enabled, because a session can start offline.

### History list, mobile (`HList`, `HListEmpty`)

- The same toggle with "Список" selected. Month headings (16px, 700), then one card per month with divided rows.
- **Row:**
  - a 36px date column with the short weekday (13px, muted) over the day number (20px, 800);
  - then the name, the status line and the "start, duration, sets" line, as in the day panel;
  - then a chevron.
  - The row is a link to the session summary.
- **Next page:** at the end of the list, a status line with a 10px planned diamond and "Завантажуємо старіші тренування".
- **Offline:** the end line is "Старіші тренування зʼявляться, коли буде інтернет." with the wifi-off icon.
- **Loading the first page:** three skeleton rows in one card, with `aria-busy`.
- **Error:** the spec 11 error card with "Не вдалося завантажити історію." and "Спробувати ще раз".
- **Empty (`HListEmpty`):** a card with a dashed `--planned` diamond, "Тут буде твоя історія" (20px, 800), "Заверши перше тренування, і воно зʼявиться в цьому списку." and a primary "Почати тренування", which opens the Start sheet.

### Make-up dialog (`HMakeUp`)

- The stacked `ConfirmDialog` (spec 10) over the screen the user started from:
  - the title "Відпрацювати понеділкове Push Day?";
  - the description "Push Day було заплановане на 16 листопада. Якщо відпрацюєш зараз, у календарі воно буде виконане із запізненням.";
  - a full-width primary "Так, відпрацювати";
  - a ghost "Ні, просто тренування".
- Escape and the scrim close the dialog, and no session starts.

### Today (`HToday`, `HDesktopToday`)

The spec 11 cards stay at the top. Under them are three new cards, in this order:

- **"Цей тиждень":** the heading (16px, 700) with "0 з 1 виконано" on the right (14px, muted). This is the count of done due occurrences of this week out of all due ones.
  - Seven columns follow, Monday to Sunday. Each column is a link to `/calendar?date=…`, at least 44px tall.
  - A column has the short weekday (13px), the 10px status markers of that day, and the date (15px).
  - Today's weekday and date are 800 in `--foreground`, with the 14×2px bar under the date.
  - The card is hidden when the user has no rules.
- **"Дотримання плану":** the heading and the percent, the adherence row, and one sentence: "6 з 9 тренувань за планом у листопаді: 5 вчасно, 1 із запізненням, 3 пропущено." The card is hidden when the user has no rules. With no due occurrences, the percent is "—", and the sentence is "У листопаді ще немає тренувань за планом.".
- **"Останнє тренування":**
  - the heading (14px, 700, muted) and the name (22px, 800);
  - "Неділя, 15 листопада. 1 год 05 хв, 18 підходів" (muted);
  - on the right, a status chip (the marker and the label on `--background`), as in the spec 11 "Виконано" chip;
  - the link "Переглянути підсумок".
  - The card is hidden when the user has no completed sessions.
- **Desktop:** two columns, max width 1040px. The left column has the plan cards and the last session. The right column (380px) has the week and adherence.

### Calendar, desktop (`HDesktop`)

- **Header:** the month title, the "Місяць" / "Список" toggle (220px), the arrows and "+ Запланувати тренування". "Сьогодні" shows only for another month (spec 11).
- **Cells:** one line per occurrence and per extra session, each with its 8px marker and the workout name. A missed line uses `--destructive-text`, and a planned line is muted. A made-up session adds a line on its own day, "Push Day, за чт", with the late marker.
- **Right column (340px):** the month summary in a card, then the day panel with the same rows as on mobile. "Запланувати на цей день" shows only for today and later (spec 11).

### History list, desktop (`HDesktopList`)

- The page title "Історія тренувань" (30px, 800) with the toggle on the right.
- A table in one card, max width 1000px, with the columns "Дата", "Тренування", "Статус", "Початок", "Тривалість", "Підходи" and a chevron. Each row is 56px tall and is a link to the summary.
- A month heading row (16px, 700) starts each month. The end line is the same as on mobile.

### Left out

- Skipping a single occurrence (out of scope).
- A details screen for a session: the row opens the spec 10 summary.

## Data and API

- No migration. `workout_session.scheduledFor` keeps its meaning: the occurrence date that the session fulfils.
- **`PUT /api/v1/sessions/{id}`** changes the `scheduledFor` rule from spec 11. `scheduledFor` must be one of these:
  - the start date of the session in the profile time zone;
  - an earlier date D when the workout occurs on D in the user's rules, and the start date is in the late window of D.
  - Any other value gives 400 `VALIDATION_FAILED`. The server does not check if another session already fulfils D. The status function resolves this.
- **`GET /api/v1/calendar?from=&to=`** returns the range with statuses:
  - `from` and `to` are dates, `from` ≤ `to`, and the range is at most 62 days. Other values give 400.
  - The response is `{ today, days: [{ date, occurrences, sessions }] }`.
  - An occurrence is `{ ruleId, workoutId, workoutName, status, sessionId, lateWindowEnd }`. `sessionId` is the fulfilling session or null. `lateWindowEnd` is a date or null.
  - A session is `{ id, workoutId, workoutName, scheduledFor, status, startedAt, finishedAt, setCount }`. A session is in the day when it started. Its link to an occurrence comes from `scheduledFor`.
  - The server reads the sessions that started in the range or have `scheduledFor` in the range. It reads the rules that cover the range plus 7 days after it, for the late windows.
  - The endpoint runs a constant number of queries for any range.
- **`GET /api/v1/sessions`** gets cursor pages:
  - new optional `limit` (1–50, default 20 with a cursor) and `cursor` parameters;
  - the response gains `nextCursor` (null on the last page);
  - list items gain `setCount`;
  - without `limit` and `cursor`, the endpoint behaves as now.
- Every query is scoped to the current user.
- `docs/tech/API.md` and `DATA_MODEL.md` ("Derived values") get these rules in the scratch plan.

## Copy

| Key (en) | uk |
| --- | --- |
| Done on time | Вчасно |
| Done late | Із запізненням |
| Missed | Пропущено |
| Planned | Заплановано |
| Extra | Додаткове |
| {{count}} on time / late / missed / planned / extra (counts) | {{count}} вчасно / із запізненням / пропущено / заплановано / додаткове |
| Plan adherence | Дотримання плану |
| {{done}} of {{due}} planned workouts done (adherence row label) | {{done}} з {{due}} запланованих тренувань виконано |
| Make up | Відпрацювати |
| You can make it up until {{date}}. | Можна відпрацювати до {{date}}. (`середи, 18 листопада`) |
| Make up Monday's {{name}}? | Відпрацювати понеділкове {{name}}? (weekday adjective forms: понеділкове, вівторкове, середове, четвергове, пʼятничне, суботнє, недільне) |
| {{name}} was planned for {{date}}. If you make it up now, the calendar shows it as done late. | {{name}} було заплановане на {{date}}. Якщо відпрацюєш зараз, у календарі воно буде виконане із запізненням. |
| Yes, make it up | Так, відпрацювати |
| No, just a workout | Ні, просто тренування |
| Done on {{date}} | Виконано {{date}} (`в пʼятницю, 6 листопада`) |
| Done late, for {{weekday}} | Із запізненням, за {{weekday}} (`за четвер`) |
| {{name}}, for {{weekday}} (desktop cell) | {{name}}, за {{weekday}} (`Push Day, за чт`) |
| {{time}}, {{duration}}, {{count}} sets | {{time}}, {{duration}}, {{count}} підходів (plural) |
| Month / List | Місяць / Список |
| View (toggle label) | Вигляд |
| Workout history | Історія тренувань |
| Date / Workout / Status / Start / Duration / Sets | Дата / Тренування / Статус / Початок / Тривалість / Підходи |
| Loading older workouts | Завантажуємо старіші тренування |
| Older workouts appear when you are online. | Старіші тренування зʼявляться, коли буде інтернет. |
| Couldn't load the history. | Не вдалося завантажити історію. |
| Your history will be here | Тут буде твоя історія |
| Finish your first workout, and it appears in this list. | Заверши перше тренування, і воно зʼявиться в цьому списку. |
| Start workout | Почати тренування (existing) |
| This week | Цей тиждень |
| {{done}} of {{due}} done | {{done}} з {{due}} виконано |
| {{done}} of {{due}} planned workouts in {{month}}: {{onTime}} on time, {{late}} late, {{missed}} missed. | {{done}} з {{due}} тренувань за планом у {{month}}: {{onTime}} вчасно, {{late}} із запізненням, {{missed}} пропущено. (`у листопаді`) |
| No planned workouts in {{month}} yet. | У {{month}} ще немає тренувань за планом. |
| Last workout | Останнє тренування |
| {{date}}. {{duration}}, {{count}} sets | {{date}}. {{duration}}, {{count}} підходів (`Неділя, 15 листопада. 1 год 05 хв, 18 підходів`) |
| View summary | Переглянути підсумок (existing) |
| — (no due occurrences) | — |

## Acceptance criteria

- [ ] AC1: Unit tests of `occurrenceStatuses()` cover each status, the late window (next occurrence before 7 days, 7-day cap, empty window), two sessions for one occurrence, abandoned and in-progress sessions, and extra sessions. They run in `Europe/Kyiv` and `America/New_York`, across a DST change.
- [ ] AC2: The calendar and the week strip show each status with a distinct marker shape and a text label in the legend and the day panel, not color alone.
- [ ] AC3: Adherence for a month with 8 due occurrences, 5 done on time and 1 done late is 75%. A planned occurrence today that is not done does not change it. Extra sessions do not change it. A month with no due occurrences shows "—".
- [ ] AC4: A tap on a past day shows its occurrences and sessions. A tap on a session row opens its summary.
- [ ] AC5: The history list shows 20 sessions, then loads the next 20 when the user scrolls to the end.
- [ ] AC6: The user starts a workout that has a missed occurrence in its late window. The dialog offers to make it up. "Так, відпрацювати" saves `scheduledFor` = the missed date, and the occurrence shows as done late. "Ні, просто тренування" saves null, and the session shows as extra.
- [ ] AC7: "Відпрацювати" shows on a missed occurrence only while its late window includes today. It starts a linked session.
- [ ] AC8: The server rejects a `scheduledFor` that is not the start date and is not a missed occurrence of that workout with the start date in its late window.
- [ ] AC9: `GET /api/v1/calendar` runs the same number of queries for a 7-day range and a 62-day range. It rejects a range longer than 62 days.
- [ ] AC10: Today shows the week strip, the adherence for this month and the last session. Each block is hidden in its empty case.
- [ ] AC11: Offline, a session that the user finished offline shows its status in the calendar and in Today at once.
- [ ] AC12: Mobile (390px) and desktop (1440px) work in en and uk, light and dark, with no horizontal scroll.

## Depends on

10, 11.

## Open questions
