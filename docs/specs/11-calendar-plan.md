# 11. Calendar plan

## Goal

Users place workouts on the calendar once, including weekly repeats, instead of tapping every day. Today and the Start sheet then show what is planned for today.

## User stories

- As a lifter, I want "Push Day every Monday and Thursday", so that I set my week once.
- As a lifter, I want to change my schedule from now on without rewriting the past, so that my history stays true.
- As a lifter, I want Today to show today's plan with Start, so that I begin in one tap.

## Scope

### Rules

- A rule is a workout, a start date, a repeat and an end. Occurrences are computed, never stored.
- **Repeat:**
  - "Один раз": `weekdays = []`, `endDate = startDate`;
  - "Щотижня" on selected weekdays (ISO 1–7, at least one), every N weeks with N 1–4. Weeks count from the ISO week (Monday) of the start date: with N = 2, the start week, the week two later, and so on.
- **End:**
  - "Ніколи" (`endDate = null`);
  - "До дати": the end date is at most 2 years after the start;
  - "Після N разів" (N 1–100): converted to the date of the N-th occurrence when saved, so only `endDate` is stored. The edit form shows it as "До дати".
- **Limits:**
  - the start date is today or later, in the profile time zone; the past is never rewritten;
  - at most 100 active rules per user, where active means `endDate` is null or not before today;
  - a rule must not put the same workout twice on one date. A rule that overlaps another rule of the same workout fails with 422 `SCHEDULE_OVERLAP`. Different workouts on one day are allowed, any number of them.
- **Workout:** only the user's live workouts that have at least one exercise.

### Occurrences

- `expandOccurrences(rule, from, to)` is a pure function in `src/shared/plan/occurrences.ts`, shared by client and server.
- It works on calendar dates (`YYYY-MM-DD`), not instants, so DST never moves an occurrence.
- "Today" is the date in the profile time zone (`profile.timeZone`).

### Editing and deleting

- **Edit** changes the rule from today on, with the past kept:
  - a rule that starts today or later is changed in place;
  - a rule that started before today is split: the old rule ends yesterday, and a new rule with the new settings starts today. Both stay linked to the same workout.
- **Delete** a rule:
  - a rule that started before today ends yesterday, so its past occurrences stay for history (spec 12);
  - a rule that starts today or later is soft deleted.
  - Both ask first.
- **Deleting a workout** ends its rules the same way. The workout delete dialog (spec 09) adds the line "Його також буде прибрано з календаря." when the workout has active rules.

### Calendar (`/calendar`)

- A month grid, Monday first, in both languages.
- **Navigation:** previous and next month, and "Сьогодні" to return.
- **Markers:** planned occurrences are `--planned` outline diamonds. Mobile shows only the markers (up to 3, then "+N"); desktop shows the workout names in the cell.
- **Day panel:**
  - **content:** the selected day's planned workouts. Each has a menu with "Змінити розклад" and "Видалити з календаря". Only today's workouts have "Почати".
  - **placement:** under the grid on mobile, a side panel on desktop.
  - **default:** today is selected when the calendar opens.
- **"Запланувати тренування"** opens the rule form: a bottom sheet on mobile, a side sheet on desktop.
  - The fields are the workout, the start date, the repeat and the end, as above. The form opened from the day panel starts on the selected day (if it is today or later).
  - "Змінити розклад" opens the same form, prefilled.
- **Offline:** the calendar shows the cached rules read-only. Scheduling, editing and deleting are disabled with "Потрібен інтернет" (DECISIONS 2026-11-08 "Offline behaviour").
- **Empty:** with no rules, the grid is shown without markers, and the day panel invites "Запланувати тренування".

### Starting a planned workout

- "Почати" on today's occurrence (day panel, Today, Start sheet) starts the session with `scheduledFor = today`.
- **Auto link:** starting a workout from anywhere sets `scheduledFor = today` when that workout is planned today and today's occurrence has no session yet. Otherwise `scheduledFor` is null.
- Starting from past or future days is not possible. Making up a missed workout is spec 12.

### Today

Today lists today's planned workouts, one card each, with the name, the exercise count and "Почати".

- A planned workout already done today (a completed session with `scheduledFor = today`) shows an accent diamond with "Виконано" and a link to its summary, instead of "Почати".
- **Nothing planned today** but rules exist: a card "Наступне тренування" with its workout name and the date ("у четвер, 19 листопада"), plus the hint that Play starts any workout.
- **No rules:** the existing spec 09/28 states stay.

### Start sheet

When workouts are planned today and not done, the sheet shows a "Сьогодні за планом" section above "Усі тренування". Each workout appears once.

## Out of scope

- Statuses (done, late, missed), adherence, the week strip, history and making up a missed workout (12).
- Skipping or moving a single occurrence (12, if needed).
- Reminders and notifications.
- Offline creation of rules (16 keeps plans read-only offline).

## UX

- **States:** loading (grid skeleton), error with retry, offline read-only, empty (no rules), day with no plan.
- **Dialogs:**
  - delete rule: "Видалити «Push Day» з календаря? Минулі тренування залишаться в історії." with "Видалити" and "Скасувати";
  - overlap error under the form: "Push Day уже заплановане на ці дні.";
  - limit: "Можна мати до 100 активних розкладів.".
- **Mobile (390px):** a compact grid (44px cells) with the day panel under it.
- **Desktop (1440px):** a large grid with names, and the day panel on the right.

## Design

Canvas: https://claude.ai/artifact/KE2i97nBoPYQjQjF6b6RMB. Every board has a `theme` tweak (light, dark).

| Board | Screen and state |
| --- | --- |
| `Main` | Calendar, mobile, today selected with a plan |
| `FutureDay` | Calendar, mobile, another month, a future day, the row menu open |
| `Empty` | Calendar, mobile, no rules |
| `Offline` | Calendar, mobile, offline read-only |
| `Loading` / `Error` | Calendar, mobile, skeleton and load error |
| `Form` / `FormEdit` | Rule form, mobile bottom sheet: new ("Після 8 разів"), and edit of a started rule with the overlap error |
| `DeleteRule` | "Видалити з календаря" confirm |
| `DeleteWorkout` | Spec 09 workout delete dialog with the calendar line |
| `Today` | Today, one planned workout to start and one done |
| `TodayNext` | Today, nothing planned, the next workout |
| `StartSheet` | Start sheet with "Сьогодні за планом" |
| `Desktop` / `DesktopForm` / `DesktopToday` | 1440 calendar, the form as a right side sheet, Today |

### Calendar, mobile

- **Header row:** month title (20px, 800), then "Сьогодні" (secondary, 36px tall, shown only when the visible month is not the current one), previous and next (ghost, 40–44px), and the accent "+" square button (44px, `aria-label` "Запланувати тренування").
- **Grid:** `role="grid"`, weekday headers Пн…Нд (13px, muted), 7 columns, rows of 48px, 6 rows when the month needs them. Days outside the month are in `--planned`.
  - The day number is 15px/600. Today is 800 with a 14×2px bar under the number.
  - Markers: one 7px `--planned` outline diamond per occurrence, under the number, up to 3, then "+N" (12px, muted).
  - The selected day gets `--card` with an inset 1px `--border-strong` ring.
- **Day panel:** under the grid, after a 1px `--border-strong` rule.
  - Heading (17px, 800): "Сьогодні, неділя, 15 листопада" for today, "Четвер, 3 грудня" for any other day (weekday capitalised, no year).
  - A `card` list: 48px thumbnail (the workout's first exercise), the name (16px, 700), the rule summary (14px, muted), then "Почати" (primary, 44px) for today's not-done workouts, or the accent diamond with "Виконано" for today's done ones. A "…" button opens a menu with "Змінити розклад" and "Видалити з календаря" (destructive text).
  - **No plan on the day:** a card with a dashed `--planned` diamond, "На цей день нічого не заплановано." and, when online, a full-width primary "Запланувати тренування". The same card is the empty state with no rules.
- **Offline:** the header pill turns "Офлайн". The "+" and "…" buttons are disabled in `--planned`. Under the day panel: "Потрібен інтернет, щоб змінити розклад." with the wifi-off icon. "Почати" still works (spec 10 starts from cache).
- **Loading:** weekday headers, `--card` blocks in the cells and a skeleton day panel, `aria-busy`.
- **Error:** a card with the alert icon, "Не вдалося завантажити календар." and "Спробувати ще раз" (primary), in place of the grid.

### Rule form

- **Mobile:** a bottom sheet in `--card` from 52px below the top, with a grabber, the title (20px, 800) and a close button. The footer with the submit button is pinned.
- **Desktop:** the same content in a 480px right side sheet over a scrim.
- **Fields, top to bottom:**
  - "Тренування": a select button with the thumbnail, the name and "· N вправ". It lists live workouts with at least one exercise.
  - "Дата початку": a date button. In the edit of a started rule it reads "Сьогодні, 15 листопада", is disabled (muted), and has the note "Зміни діють з сьогодні. Минулі тренування не зміняться.".
  - "Повторення": a two-part segmented control "Один раз" / "Щотижня". With "Щотижня": seven 44px weekday toggles (`aria-pressed`, filled `--fg` when on) and an interval select "Щотижня", "Кожні 2 тижні", "Кожні 3 тижні", "Кожні 4 тижні".
  - "Закінчення": a three-part segmented control "Ніколи" / "До дати" / "Після". "До дати" shows a date button. "Після" shows a 72px number input, "разів" and the computed last date on the right: "Останнє: чт, 10 грудня".
- **Footer:** the submit button "Запланувати" (new) or "Зберегти" (edit), full width, primary. Server errors (overlap, limit, save failure) show above it in `--destructive-text` with the alert icon, `role="alert"`.

### Dialogs

- Both use the stacked `ConfirmDialog` (spec 10): title, muted description, a full-width destructive "Видалити" and a ghost "Скасувати".
- `DeleteRule`: "Видалити «Ноги» з календаря?" / "Минулі тренування залишаться в історії.".
- `DeleteWorkout`: the existing title and description, plus the bold line "Його також буде прибрано з календаря." when the workout has active rules.

### Today

- The greeting line stays. Under it, the heading "Сьогодні за планом" (17px, 800) and one card per planned workout, not-done first:
  - **To do:** the name (28px, 800), "N вправ", up to four 52px exercise thumbnails, and a full-width primary "Почати" with the play diamond.
  - **Done:** the name (22px, 800), "N вправ", a "Виконано" chip (accent diamond on `--bg`) on the right, and the link "Переглянути підсумок" to the session summary.
- **Nothing planned today, rules exist:** one card with the heading "На сьогодні нічого не заплановано", an inset `--bg` block with the outline marker, "Наступне тренування", the name (28px, 800), the date "у середу, 18 листопада" and thumbnails, then "Хочеш потренуватися зараз? Натисни ▶ і вибери тренування." and a secondary "Відкрити календар".
- **Desktop:** the same cards in a two-column grid, max width 960px.

### Start sheet

- Above the existing list, a heading "Сьогодні за планом" with an accent outline diamond and a card ringed with 1.5px `--accent` that holds today's not-done planned workouts.
- Then a muted heading "Усі тренування" and the existing list without those workouts. Rows keep the existing layout.
- With nothing planned and not done, the sheet is unchanged.

### Calendar, desktop

- **Layout:** the sidebar stays. The main area has the month (flex 1) and a 340px day panel on the right.
- **Header:** the month title (30px, 800), "Сьогодні", previous and next, and the accent button "+ Запланувати тренування".
- **Grid:** 7 columns, 6 equal rows filling the height, `--card` cells with 6px gaps, out-of-month cells transparent.
  - Each cell shows the day number, "сьогодні" (12px, muted) for today, and one line per occurrence: the outline marker and the workout name, ellipsised.
  - The selected cell has a 2px `--fg` inset ring.
- **Day panel:** the heading (20px, 800), the same list as on mobile, and a secondary "Запланувати на цей день" (only for today or later, online). Mobile has no such button: "+" opens the form on the selected day.

### Rule summary

The summary line under a workout name is built from the rule:

- one-off: "Один раз";
- weekly, every week: "Щопонеділка й щочетверга" (uk) / "Every Monday and Thursday" (en). All seven days are "Щодня" / "Every day";
- every N weeks: "Кожні 2 тижні: пн, чт" / "Every 2 weeks: Mon, Thu".

### Left out

- Done, missed and late markers in the grid, the week strip, and making up a missed day (12).
- Skipping one occurrence (12).

## Data and API

- `docs/tech/DATA_MODEL.md` `schedule_rule` stays as drafted, with these rules:
  - `weekdays smallint[]` is empty for a one-off;
  - `intervalWeeks` is 1–4;
  - `endDate` is null or between `startDate` and `startDate` + 2 years.
  - Index `(userId, deletedAt, endDate)`.
- **`GET /api/v1/schedule-rules`** returns `{ items }`: the user's non-deleted rules, ended ones included (the calendar shows the past). Each item embeds `workout: { id, name, exerciseCount, deleted }`.
- **`PUT /api/v1/schedule-rules/{id}`** creates a rule with a client id (idempotent): `{ workoutId, startDate, weekdays, intervalWeeks, endDate | endAfter }`. `endAfter` is converted to `endDate` on the server.
- **`PATCH /api/v1/schedule-rules/{id}`** edits a rule: `{ newId, workoutId, startDate, weekdays, intervalWeeks, endDate | endAfter }`.
  - The server edits in place or splits, in one transaction; `newId` is the client id of the split rule, so a retry finds it.
  - It returns the resulting rules.
- **`DELETE /api/v1/schedule-rules/{id}`** ends or soft deletes the rule; a repeat is 204.
- **Errors:**
  - `SCHEDULE_RULE_NOT_FOUND` (404, also for another user's id);
  - `SCHEDULE_OVERLAP` and `SCHEDULE_LIMIT_REACHED` (422);
  - validation 400 (start before today, end after 2 years, no weekdays for a weekly rule, interval outside 1–4, an empty or foreign workout).
- **`PUT /api/v1/sessions/{id}`** (spec 10) gains an optional `scheduledFor` date. It must equal the date of `startedAt` in the profile time zone (400 otherwise), so a late outbox replay of an offline start still passes.
- **Sessions read:** `Session` and the list items gain `scheduledFor`. `GET /api/v1/sessions` gains `?scheduledFor=YYYY-MM-DD`. The client merges it with local sessions to tell started or done planned workouts.
- **Ended rules** (`endDate` before today) are read-only: their rows have no menu, `PATCH` returns 400, `DELETE` is a 204 no-op.
- **Workout delete** (`DELETE /api/v1/workouts/{id}`) ends or soft deletes the workout's rules in the same transaction.
- Every query is scoped to the current user.

## Copy

| Key (en) | uk |
| --- | --- |
| Schedule workout | Запланувати тренування |
| Workout | Тренування |
| Start date | Дата початку |
| Repeat | Повторення |
| Once / Weekly | Один раз / Щотижня |
| Every week / Every {{count}} weeks | Щотижня / Кожні {{count}} тижні (plural) |
| Ends | Закінчення |
| Never / On date / After | Ніколи / До дати / Після |
| {{count}} times | {{count}} разів (plural) |
| Today | Сьогодні |
| Start | Почати |
| Done | Виконано |
| Edit schedule | Змінити розклад |
| Remove from calendar | Видалити з календаря |
| Remove "{{name}}" from the calendar? Past workouts stay in your history. | Видалити «{{name}}» з календаря? Минулі тренування залишаться в історії. |
| {{name}} is already planned on these days. | {{name}} уже заплановане на ці дні. |
| You can have up to 100 active schedules. | Можна мати до 100 активних розкладів. |
| Planned for today | Сьогодні за планом |
| All workouts | Усі тренування |
| Next workout | Наступне тренування |
| Nothing planned on this day. | На цей день нічого не заплановано. |
| It will also be removed from the calendar. | Його також буде прибрано з календаря. |
| Needs internet | Потрібен інтернет (existing) |
| Schedule (submit) / Save | Запланувати / Зберегти |
| Schedule on this day | Запланувати на цей день |
| Last: {{date}} | Останнє: {{date}} (`чт, 10 грудня`) |
| Changes apply from today. Past workouts stay as they were. | Зміни діють з сьогодні. Минулі тренування не зміняться. |
| times (after the number input) | разів |
| Once | Один раз |
| Every {{days}} | Що{{days}}: "Щопонеділка й щочетверга" (uk weekday forms щопонеділка, щовівторка, щосереди, щочетверга, щоп'ятниці, щосуботи, щонеділі, joined with ", " and " й ") |
| Every day | Щодня |
| Every {{count}} weeks: {{days}} | Кожні {{count}} тижні: {{days}} (plural; short days пн…нд) |
| View summary | Переглянути підсумок |
| Nothing planned for today | На сьогодні нічого не заплановано |
| Want to train now? Tap ▶ and choose a workout. | Хочеш потренуватися зараз? Натисни ▶ і вибери тренування. |
| Open calendar | Відкрити календар |
| Needs internet to change the schedule. | Потрібен інтернет, щоб змінити розклад. |
| Couldn't load the calendar. | Не вдалося завантажити календар. |
| Try again | Спробувати ще раз (existing) |
| Previous month / Next month | Попередній місяць / Наступний місяць |
| Mon … Sun (grid headers) | Пн Вт Ср Чт Пт Сб Нд |
| Day panel heading | "Сьогодні, неділя, 15 листопада" for today, "Четвер, 3 грудня" otherwise |
| Next workout date | "у середу, 18 листопада" / "on Wednesday, November 18" |

## Acceptance criteria

- [ ] AC1: Scheduling "Push Day every Monday and Thursday until 2027-03-01" shows exactly those dates from the start date on, and none after the end.
- [ ] AC2: A one-off rule shows on one date only. "After 5 times" saves the date of the 5th occurrence as the end.
- [ ] AC3: "Every 2 weeks on Monday" shows every other Monday counted from the start week. Occurrences keep their dates across a DST change in the profile time zone (unit tests of `expandOccurrences` with `Europe/Kyiv` and `America/New_York`).
- [ ] AC4: "Почати" exists only for today's occurrences. Starting there, from Today, the Start sheet, or anywhere else for a workout planned today without a session today, creates a session with `scheduledFor = today`. Starting an unplanned workout leaves it null.
- [ ] AC5: Editing a rule that started in the past ends it yesterday and creates a new rule from today, so occurrences before today do not change. Editing a future rule changes it in place. Deleting removes today and later, and keeps the past.
- [ ] AC6:
  - Today lists today's planned workouts with "Почати", and a done one with "Виконано";
  - with none today, it shows the next planned workout and its date;
  - the Start sheet shows "Сьогодні за планом" first.
- [ ] AC7: The server rejects (with the codes above):
  - a start before today;
  - an end later than 2 years after the start;
  - a weekly rule with no weekdays or an interval outside 1–4;
  - an overlap of the same workout;
  - a 101st active rule;
  - another user's or an empty workout.
  - The same `PUT` twice creates one rule; the same `PATCH` twice splits once.
- [ ] AC8: Deleting a workout ends its rules (past kept, future gone), and its delete dialog says so.
- [ ] AC9: Offline, the calendar shows cached rules, and scheduling, editing and deleting are disabled with "Потрібен інтернет".
- [ ] AC10: Mobile (390px) and desktop (1440px) work in en and uk, light and dark, with no horizontal scroll.

## Depends on

10, 29.

## Open questions
