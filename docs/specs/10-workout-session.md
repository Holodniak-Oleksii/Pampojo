# 10. Workout session

## Goal

The core gym experience: start a workout, log every set in one or two taps, rest between sets, finish with a summary. Sessions and sets live on the device first (Dexie + outbox), so a running session survives a reload and a lost signal.

## User stories

- As a lifter, I want to start "Push Day" and see my sets prefilled with what I did last time, so that logging is one tap per set.
- As a lifter, I want a rest timer that starts on its own and stays right after the phone sleeps, so that I rest the time I mean to.
- As a lifter, I want to change the order, add an exercise or a set during the session, so that the plan bends to a busy gym.
- As a lifter, I want a summary when I finish, so that I see what I did.
- As a lifter in a basement, I want my logged sets to stay saved without signal, so that I never lose a session.

## Scope

### Starting

- **Start points:**
  - the Start sheet (spec 05) lists the user's workouts, newest `updatedAt` first, with the name and "N вправ". Tapping a workout starts it at once. A workout with 0 exercises is shown disabled;
  - "Почати" is added to the "…" menu of each card in `/library/workouts`;
  - the editor of a saved workout gets a "Почати" button. It is disabled while the editor has unsaved changes.
  - The calendar start is spec 11.
- **Start** creates a session with a client UUID:
  - `workoutSnapshot`: the workout as it is now (name, exercises with targets and notes, the embedded exercise name, tracking type, laterality, thumbnail);
  - `exercises`: the session plan, a copy of the snapshot's exercise list. Each entry has its own `id`, the `exerciseId`, `plannedSets` and the targets;
  - `plannedSets` is `targetSets`, or 3 when the workout has no set target.
  - Then it opens `/session/[id]`.
- **One session in progress at a time.** While one exists, the Start sheet shows only "Тренування триває": a card with the workout name, elapsed minutes and logged / planned sets, a "Продовжити <name>" button and the hint "Щоб почати інше тренування, спершу заверши або видали це." Every Start button and "Почати" opens that session. The check uses the local database and, when online, `GET /api/v1/sessions?status=in_progress`, so a session started on another device is found too.
- **Offline start.** Starting works offline when the workout is in the TanStack Query cache. Otherwise the workout is disabled with "Потрібен інтернет". A started session works fully offline, including after a reload. Full offline start from local data is spec 16.
- **Forgotten session.** When a session in progress is older than 12 hours, opening the Start sheet or the session shows a dialog:
  - "Завершити" sets `finishedAt` to the last logged set's `completedAt`, or to `startedAt` when no set is logged;
  - "Видалити" abandons it.
  - Nothing happens automatically.

### Session screen (`/session/[id]`)

Full screen, no app navigation. It follows the system dark theme (decision 2026-11-13), with its own tokens.

- **Header:** "Згорнути", workout name, elapsed time (from `startedAt`, ticking), a "…" menu with "Нотатка", "Звук таймера" (on/off) and "Видалити тренування", and "Завершити".
- **Minimize.** "Згорнути" goes to `/today` and the session keeps running. While a session is in progress and its screen is not open, a dark session bar sits above the mobile bottom nav (at the top of the desktop sidebar): the workout name, the running rest or the elapsed time, and "Повернутися", which opens the session.
- **Current exercise card:**
  - name and thumbnail; the workout note for this exercise, if any;
  - "Минулого разу: 80 кг × 8" (the first set of the last time), or nothing for a first time;
  - "на кожну сторону" for unilateral exercises: reps and duration are per side, as in the builder.
- **Set rows**, one per planned set. Each row has the set number, the input fields for the tracking type, and a check button:

  | Tracking | Fields |
  | --- | --- |
  | `weight_reps` | weight (kg), reps |
  | `reps` | reps |
  | `time` | duration |
  | `distance` | distance (km or m, as in the builder) |

- **Prefill:**
  - each set takes its values from the same set number of the last completed session with this exercise;
  - when that set does not exist, from the targets: reps from `targetRepsMin`, weight from `targetWeightKg`, duration and distance from their targets;
  - otherwise the field is empty.
- **Logging a set:**
  - the check is enabled when the main metric is filled: reps, duration or distance. Weight is optional; an empty weight is stored as `null` and counts as no load in volume;
  - tapping the check writes the set log, plays the "set done" motion and starts the rest timer;
  - a logged set's fields stay editable, and every change is saved;
  - tapping the check of a logged set unlogs it: the log is soft deleted and the row keeps its values. If a rest timer started from that set is running, it stops. No confirmation.
- **Sets:** "Додати підхід" appends a row prefilled like the previous row. "Прибрати підхід" removes the last unlogged row. Up to 20 rows per exercise.
- **Rest timer:**
  - starts on every logged set. Its length is the exercise's remembered rest, or 90 s;
  - −15 s and +15 s change the running rest (minimum 15 s, maximum 10 min). The new length is remembered for this exercise on this device (`localStorage`) and used next time. "Пропустити" stops it;
  - it is computed from `restEndsAt` (stored locally with the session), never from a counter, so it stays right after sleep or a background tab;
  - at zero, while the screen is visible: a short vibration where `navigator.vibrate` exists, and a quiet sound unless "Звук таймера" is off (stored on the device, default on). Then it counts up "+0:12" until the next set or "Пропустити";
  - one timer at a time: a new logged set replaces it.
- **Exercise list:**
  - shows every session exercise with logged / planned sets ("2/3"). Tapping one makes it current;
  - reorder by drag (the `@dnd-kit` pattern from 09), for this session only;
  - "Додати вправу" opens the catalog picker from 09 (multi-select) and appends the picks with the default targets per tracking type from 09 and no weight;
  - "Прибрати" removes an exercise that has no logged sets;
  - up to 30 exercises.
- **After the last planned set of an exercise is logged**, the next exercise with unlogged sets becomes current when the rest ends or is skipped.
- **Session note:** up to 1000 characters, edited from the "…" menu, saved on close.
- **Wake Lock** while the session screen is visible, where supported; re-requested on `visibilitychange`.
- **Touch and input:** targets at least 48px, inputs 28/800, `inputmode="decimal"` for weight and distance, `numeric` for reps and duration.
- **Units:** kg only, as in the builder. Imperial display is not in this spec.

### Finishing

- "Завершити":
  - with unlogged rows, a dialog: "Залишилось N непозначених підходів. Завершити тренування?" with "Завершити" and "Продовжити". Unlogged rows are not saved;
  - with no logged set at all, the dialog offers "Видалити тренування" and "Продовжити" instead.
- Finish sets `status = completed` and `finishedAt = now`, triggers a sync and shows the summary on the same route:
  - duration (`finishedAt − startedAt`), volume (Σ weight × reps of logged `weight_reps` sets with a weight), logged sets, exercises with at least one set;
  - a row per exercise with logged sets: "N × <heaviest weight>", or the longest duration, longest distance, or most reps when there is no weight;
  - the new records row is added by spec 13;
  - "Готово" goes to `/today`.
- Opening `/session/[id]` of a completed session shows its summary. Editing a completed session is spec 12.

### Abandoning

- "Видалити тренування" asks: "Видалити це тренування? Залоговані підходи буде втрачено." with a destructive "Видалити" and "Скасувати".
- It sets `status = abandoned` and soft deletes its set logs, then goes to `/today`. An abandoned session is excluded from every list, "last time", history and progress.

### Local data and sync

- Dexie database per user (`pampojo-<userId>`) in `src/services/local-db/`: `sessions`, `setLogs`, `lastPerformance`, `outbox`.
- `SessionRepository` (see `state-and-data.md`) reads with `useLiveQuery`. Every write updates the local table and appends an outbox entry in one Dexie transaction.
- The outbox sends its entries in order, one at a time, through the idempotent REST endpoints below. It runs after each write, on app open, on the `online` event and on `visibilitychange` to visible. A Web Lock keeps two tabs from sending at once. Network errors and 5xx keep the entry and retry with backoff. A 4xx drops the entry and shows a toast.
- "Last time" values are fetched for every session exercise at start (and when one is added) and stored in `lastPerformance`, so they survive offline reloads. Without network, they come from local completed sessions.
- Opening `/session/[id]` that is not local (another device) loads it with `GET /api/v1/sessions/{id}` into Dexie.
- **Log out:** first sends the outbox. If entries remain, a dialog says "Незбережені на сервері дані тренувань буде втрачено." with "Вийти" and "Скасувати". After logging out, the local database is deleted. Spec 17 replaces this dialog with the full guard.
- Spec 16 moves the outbox to `/sync/push`, adds pull and the other entities.

### Own exercise deletion (spec 07 decision)

- The spec 07 delete dialog also lists the completed sessions that logged the exercise, by workout name and date (links come with history in 12).
- Confirming soft deletes those set logs and removes the exercise from `exercises` of sessions in progress. `workoutSnapshot` is not changed.

## Out of scope

- Swap exercise (18).
- Full offline data, pull sync and starting from local workouts (16); the status pill count and the full logout guard (17).
- Plan linking with `scheduledFor` (11, 12).
- History list and editing completed sessions (12).
- Records in the summary (13).
- RPE input; the column exists but has no UI.
- A built-in stopwatch or countdown for `time` sets; they are entered by hand.
- Imperial units.
- Empty sessions without a workout: `workoutId` is always set.
- Notifications or sound while the screen is locked (not reliable for a PWA on iOS, `OFFLINE.md`).

## UX

- **States:**
  - loading: skeleton of the header and the current exercise card, until the local session is read;
  - not found: an unknown, another user's or abandoned id shows "Тренування не знайдено" with a link to `/today`;
  - offline: no change to the session screen; the session works the same;
  - sync failure (4xx): a toast "Не вдалося зберегти зміну на сервері.";
  - forgotten session dialog, finish dialogs, abandon dialog as above.
- **Mobile (390px):** one column, usable with one hand. The current exercise and its sets on top, the rest timer as a bar fixed above the bottom edge while running, the exercise list in a bottom sheet opened from the header area.
- **Desktop (1440px):** three columns side by side: exercise list, current exercise, rest timer and session note.

## Design

Canvas: <https://claude.ai/artifact/Mz5pBtc95Bq5uMFr6BtoWc> (private), inside `docs/tech/VISUAL_LANGUAGE.md`. Every board uses real catalog photos and uk copy. The session boards use the dark session tokens; the light screens use the app palette.

| Board | Screen and state |
| --- | --- |
| Сесія, моб, відпочинок іде | Session: two sets logged, the next set current, rest running |
| Список вправ, моб | Exercise list sheet: drag, progress, remove, add |
| Відпочинок минув, моб | Timer past zero, counting up |
| Перший раз, без ваги, моб | No history, empty weight, a set that cannot be checked |
| Вправа на час, моб | `time` exercise, last exercise of the session |
| Меню сесії, моб | "…" menu |
| Нотатка, моб | Session note sheet |
| Помилка збереження, моб | 4xx sync toast |
| Завершити з непозначеними, моб | Finish dialog with unchecked sets |
| Завершити без підходів, моб | Finish dialog with no logged set |
| Підсумок, моб | Summary |
| Видалити тренування, моб | Abandon dialog |
| Забута сесія, моб | Session older than 12 hours |
| Завантаження, моб | Loading skeleton |
| Не знайдено, моб | Unknown, another user's or abandoned id |
| Start sheet, список, моб | Start sheet with workouts, one with 0 exercises |
| Start sheet, продовжити, моб | Start sheet while a session is in progress |
| Згорнута сесія, моб | Today with the session bar |
| Меню картки з «Почати», моб | Workout card menu |
| Редактор з «Почати», моб | Saved editor with "Почати" |
| Вихід з незбереженим, моб | Log out with an unsent outbox |
| Сесія, десктоп 1440 | Three columns |
| Підсумок, десктоп 1440 | Summary |

### Session screen (mobile)

- **Header (64px):** "Згорнути" (chevron down, 44px), the name (17/800) over the elapsed time (14, secondary, tabular), the "…" button (48px) and "Завершити" as the light primary button (`#F3F1EC` on `#1E1C1A`).
- **Exercise strip:** one 48px outlined button, full width. It shows one 10px diamond per exercise and "Вправа N з M", and opens the exercise list sheet.
  - The current exercise is a light outline diamond, half filled with the accent once a set is logged.
  - Done exercises are accent filled. The rest are a `#8C857D` outline.
- **Exercise header:** a 64px thumbnail, the name (24/800), then "Минулого разу: 80 кг × 8" (15/600, secondary) or the workout note when there is no history.
- **Set table:** the columns are "Підхід", the fields per tracking type ("Вага, кг", "Повтори", "Тривалість, с", "Дистанція") and the check. Rows are 64px tall and the inputs are 56px, 28/800, centered, tabular.
  - **Unlogged rows** have a filled `#353130` field.
  - **Logged rows** have a transparent field with a 1px `#3A3633` border and stay editable.
  - **Current row** (the first unlogged): its number is bold, and the check is a light outline diamond. Other unlogged checks are a `#8C857D` outline.
  - **Logged check:** an accent-filled 30px diamond with a dark check. Tapping it plays the "set done" motion.
  - **Disabled check:** a dashed `#5A544F` outline. The empty main field gets a `#8C857D` border, and the hint "Вага необовʼязкова. Щоб позначити підхід, впиши повтори." appears under the table.
  - Empty fields show "—" as the placeholder.
- **Under the table:** "Додати підхід" (outlined, fills the row) and "Прибрати підхід" (ghost, secondary text).
- **"Далі" row:** a divider, then a 40px thumbnail, "Далі" over the next exercise name, and its target on the right. Tapping it makes that exercise current. On the last exercise this row becomes the line "Остання вправа. Коли закінчиш, натисни «Завершити»."
- **Rest bar:** fixed to the bottom, `#2A2724`, with an 8px top radius and the floating shadow.
  - A 56px ring drains linearly in the accent, with a small accent diamond inside.
  - "1:12" (28/800) sits over "Відпочинок 1:30".
  - Then −15 and +15 (outlined, 52×48) and "Пропустити" as a light 48px icon button (skip-forward).
  - **Past zero:** the ring fills with the accent and the diamond turns dark. "+0:12" is in the accent over "Час на підхід N", and "Пропустити" becomes a text button.
  - The bar is hidden when no rest is running.

### Exercise list sheet

- A bottom sheet on `#2A2724`, titled "Вправи".
- Rows are 68px: a drag handle, a 44px thumbnail, the name, and the progress "2/4" on the right.
- The current row is `#353130`, with "Зараз" under the name.
- Rows without logged sets have an "×" button, "Прибрати <name>".
- "Додати вправу" (outlined) is at the end. It opens the 09 picker in the dark session theme.

### Menu, note, dialogs

- **"…" menu:** a dropdown on `#2A2724` with:
  - "Нотатка";
  - "Звук таймера" with a square 4px switch (accent when on);
  - a divider, then "Видалити тренування" in `#F28A84`.
- **Note:** a bottom sheet with a 5-row field on `#353130`, the counter "56 / 1000", and "Готово".
- **Dialogs:** centered on `#2A2724` with a 6px radius. They have a title (20/800), one line of secondary text, and stacked full-width buttons: the primary on top, the secondary outlined.
  - Destructive primaries are `#E5534B` with dark text.
  - In the forgotten-session dialog, "Видалити" is the outlined secondary with `#F28A84` text.
- **Sync toast:** a light toast (`#F3F1EC`) above the rest bar, with a destructive outline diamond and a close button.

### Summary

- **Header:** a 34px accent diamond with a dark check (the "set done" icon), "Тренування завершено" (30/800), and "<workout>, <weekday>, <date>".
- **Numbers:** four plain numbers in a 2×2 grid (4 in a row on desktop) between two dividers: Тривалість, Обʼєм, Підходи, Вправи (24/800, the label under it). There are no stat cards.
- **Exercises:** a divided list, one row per exercise with logged sets, with the "N × value" result on the right.
- **"Готово":** light primary, at the bottom on mobile; on desktop it sits under the list, sized to its label.
- Spec 13 adds the records row between the numbers and the list.

### Loading and not found

- **Loading:** `#2A2724` blocks in the session geometry: header, strip, exercise header and three rows.
- **Not found:** a `#8C857D` outline diamond, "Тренування не знайдено", the 09 line, and "На головну" (light primary) to `/today`.

### Start and exit (light app screens)

- **Start sheet:** the spec 05 sheet, titled "Обери тренування".
  - Rows are 72px: the first exercise's thumbnail, the name, "N вправ", and a 26px accent Play diamond on the right.
  - A 0-exercise workout is disabled, with a dashed thumbnail and "0 вправ. Додай вправи, щоб почати."
- **Start sheet in progress:** "Тренування триває", then a card with the thumbnail, the name and "Іде 24 хв. 2 підходи з 16". Below it, the dark "Продовжити Push Day" and the hint.
- **Session bar:** `#1E1C1A`, 6px radius, the floating shadow. It is 12px from the screen edges and sits above the bottom nav.
  - It holds a 36px rest ring (or the Play diamond when no rest runs), the name over "Відпочинок 0:48" or the elapsed time, and "Повернутися" (light).
  - The whole bar is one link.
  - Desktop places it at the top of the sidebar, under "Почати тренування".
- **Card menu:** "Почати" comes first, with a small accent diamond, then "Дублювати" and "Видалити".
- **Editor:** a dark "Почати" with a small accent diamond, opposite the back link. It is disabled while the editor has unsaved changes.
- **Log out:** an alert dialog, "Вийти з акаунта?". It has the warning line plus "Підʼєднайся до мережі, щоб вони синхронізувались.", a destructive "Вийти" and "Скасувати".

### Desktop (1440)

- **Header:** a 76px bar with a divider, holding "Згорнути", the name (22/800), the elapsed time, "…" and "Завершити".
- **Columns:** 340px exercise list, the current exercise (max 680px), and 360px on the right.
  - The left column is the exercise list sheet's content inline, with "Додати вправу".
  - The center has an 80px thumbnail, the name at 36/800, and the same set table.
  - The right column holds the rest panel and the session note.
- **Rest panel:** a `#2A2724` panel with a 168px ring and the time inside, −15 с and +15 с in two columns, and "Пропустити" across both.
- **Session note:** an inline field. On desktop it autosaves on blur instead of opening a sheet.

### Light system theme

The session screen uses the same layout with the app palette when the system theme is light. There is no separate board for it.

### New dark session values

`#8C857D` is the planned outline, `#4A4541` the strong divider and sheet handle, `#5A544F` the disabled outline, `#6E6862` the placeholder, and `#F28A84` destructive text. They are added to the dark session table in `VISUAL_LANGUAGE.md`.

## Data and API

- `docs/tech/DATA_MODEL.md`:
  - `workout_session`: `workoutId` is not null in this spec (column stays nullable for later); new `exercises jsonb` — the session plan `[{ id, exerciseId, plannedSets, targetRepsMin, targetRepsMax, targetWeightKg, targetDurationSec, targetDistanceM, notes }]` in session order; `workoutSnapshot` never changes after start; `notes` up to 1000; one `in_progress` session per user is enforced by the client, not the server (offline writes).
  - `set_log`: new `sessionExerciseId uuid` (the `exercises[].id` entry); `exercisePosition` is dropped (order comes from `exercises`); `setIndex` is the 0-based row number; values by tracking type: weight 0–500 step 0.25, reps 1–100, duration 1 s–60 min, distance 1 m–100 km; `rpe` unused.
- `docs/tech/API.md`:
  - `PUT /api/v1/sessions/{id}` creates the session (client id, idempotent): `{ workoutId, workoutSnapshot, exercises, startedAt }`. Exercises must be system or the user's own non-deleted ones (400). A repeat returns the existing row.
  - `PATCH /api/v1/sessions/{id}`: `exercises`, `notes`, `status` (`completed` with `finishedAt`, or `abandoned`). Abandon soft deletes the set logs in the same transaction. Repeating the same status change returns 200.
  - `GET /api/v1/sessions?status=in_progress` and `GET /api/v1/sessions/{id}` (with its non-deleted set logs).
  - `PUT /api/v1/sets/{id}` (create or replace, idempotent), `PATCH /api/v1/sets/{id}`, `DELETE /api/v1/sets/{id}` (soft, 204 on repeat).
  - `GET /api/v1/exercises/{id}/last-performance` returns `{ item: null | { sessionId, finishedAt, sets: [{ setIndex, weightKg, reps, durationSec, distanceM }] } }` from the latest completed session with a non-deleted set of this exercise.
  - Errors: `SESSION_NOT_FOUND` (404, also for another user's id), `SESSION_NOT_IN_PROGRESS` (409 for set or plan writes to a completed or abandoned session), validation 400.
- Every query is scoped to the current user.

## Copy

| Key (en) | uk |
| --- | --- |
| Start | Почати |
| Continue {{name}} | Продовжити {{name}} |
| Finish | Завершити |
| Last time: {{value}} | Минулого разу: {{value}} |
| Set | Підхід |
| Add set / Remove set | Додати підхід / Прибрати підхід |
| Rest | Відпочинок |
| Skip | Пропустити |
| Exercises | Вправи |
| Add exercise / Remove | Додати вправу / Прибрати |
| Note | Нотатка |
| Timer sound | Звук таймера |
| Discard workout | Видалити тренування |
| Discard this workout? Logged sets will be lost. | Видалити це тренування? Залоговані підходи буде втрачено. |
| {{count}} sets are not checked. Finish the workout? | Залишилось {{count}} непозначених підходів. Завершити тренування? |
| Keep going | Продовжити |
| Unfinished workout from {{date}} | Незавершене тренування від {{date}} |
| Workout finished | Тренування завершено |
| Duration / Volume / Sets / Exercises | Тривалість / Обʼєм / Підходи / Вправи |
| Done | Готово |
| Workout not found | Тренування не знайдено |
| Couldn't save a change to the server. | Не вдалося зберегти зміну на сервері. |
| Unsynced workout data will be lost. | Незбережені на сервері дані тренувань буде втрачено. |
| Log out | Вийти |
| Minimize | Згорнути |
| Back to workout | Повернутися |
| Exercise {{n}} of {{total}} | Вправа {{n}} з {{total}} |
| Next | Далі |
| Now | Зараз |
| Time for set {{n}} | Час на підхід {{n}} |
| Weight is optional. To check a set, enter the reps. | Вага необовʼязкова. Щоб позначити підхід, впиши повтори. |
| Last exercise. When you are done, press "Finish". | Остання вправа. Коли закінчиш, натисни «Завершити». |
| No sets checked | Жодного підходу не позначено |
| Nothing to finish. You can discard this workout or keep going. | Завершувати нічого. Можеш видалити це тренування або продовжити. |
| Finish the workout? | Завершити тренування? |
| Workout in progress | Тренування триває |
| {{min}} min in. {{done}} of {{total}} sets | Іде {{min}} хв. {{done}} підходи з {{total}} |
| To start another workout, finish or discard this one first. | Щоб почати інше тренування, спершу заверши або видали це. |
| Log out? / Connect to the internet so they can sync. | Вийти з акаунта? / Підʼєднайся до мережі, щоб вони синхронізувались. |
| Go to Today | На головну |
| Rest {{time}} | Відпочинок {{time}} |

Plurals follow the existing `{{count}}` keys. Copy confirmed in `/design 10`.

## Acceptance criteria

- [ ] AC1: Starting a workout creates a session with a snapshot and opens `/session/[id]`. Editing the workout afterwards changes neither the snapshot nor the session plan.
- [ ] AC2: With prefilled values, logging a set is one tap on the check. The set is saved locally and on the server, and the rest timer starts at 90 s, or at the length last set with −15/+15 for that exercise on this device.
- [ ] AC3: The rest timer shows the right remaining time after the tab is hidden for longer than the rest (computed from `restEndsAt`), and then counts up past zero.
- [ ] AC4: Set rows prefill from the same set of the last completed session with this exercise, then from targets (reps from the range minimum). "Минулого разу" shows the first set, or nothing for a first time. Abandoned sessions are ignored.
- [ ] AC5: Reloading during a session restores it with all logged sets, the plan order, added exercises and the running rest timer, both online and with the network off.
- [ ] AC6: The same `PUT` of a set or a session sent twice gives one row. `DELETE` of a set twice gives one soft-deleted row and no error.
- [ ] AC7: Sets logged offline reach the server in order once the network returns (e2e with `setOffline`), and the outbox is empty.
- [ ] AC8: Finish with unchecked sets asks first. After finishing, the summary shows duration, volume, sets and exercises; the session is `completed`; Start no longer resumes it and opening its URL shows the summary.
- [ ] AC9: Discard asks first, sets the session `abandoned`, soft deletes its sets and removes it from "last time".
- [ ] AC10: While a session is in progress, the Start sheet shows only "Тренування триває" with "Продовжити", and "Почати" in the list and the editor opens that session. A session older than 12 hours shows the forgotten-session dialog, and "Завершити" uses the last set's time.
- [ ] AC11: The check is disabled until reps, duration or distance is filled; weight can be empty. Tapping the check of a logged set unlogs it and keeps the values.
- [ ] AC12: Exercises can be reordered, added from the picker and removed when they have no logged sets; the reload keeps the result. Limits: 30 exercises, 20 sets, value ranges from Data and API (client and server, 400).
- [ ] AC13: Another user's session id returns 404 `SESSION_NOT_FOUND` on every endpoint. Set writes to a completed or abandoned session return 409 `SESSION_NOT_IN_PROGRESS`.
- [ ] AC14: Log out with an unsent outbox shows the warning, and after logging out the local database is gone.
- [ ] AC15: Deleting an own exercise lists the completed sessions that logged it; after confirming, its set logs are gone from those sessions.
- [ ] AC16: The session screen follows the system dark theme. Mobile (390px) works one-handed with 48px targets; desktop (1440px) shows the exercise list, current exercise and timer side by side. No horizontal scroll in en and uk.
- [ ] AC17: "Згорнути" goes to `/today` while the session keeps running; the session bar shows the rest or elapsed time and "Повернутися" opens the session.

## Depends on

09.

## Open questions
