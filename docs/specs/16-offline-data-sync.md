# 16. Offline data and sync

## Goal

Everything needed in the gym lives on the device, sessions work with no network, and changes sync to the server without loss or duplicates. Design: `docs/tech/OFFLINE.md`, ADR 0005.

## Scope

- Dexie database in `src/services/local-db/` with tables mirroring the gym data and an `outbox` table; versioned schema with migrations.
- Repositories for catalog, workouts, schedule rules, sessions, set logs, measurements, profile and gym profile. Reads come from Dexie. The existing query hooks keep their names and result shape, and a Dexie live query refreshes them. Replace the online implementations from earlier specs behind the same interfaces.
- Sync engine in `src/services/sync/`: triggers (open, `online`, visible, session finish, manual), push in ordered batches, pull since cursor, backoff on failure, single-flight lock across tabs (Web Locks, as in spec 10).
- Server: `POST /api/v1/sync/push` and `GET /api/v1/sync/pull?since=` (see "Data and API").
- Initial download after login with a full-screen progress screen; incremental after that.
- Logging out clears the local database (guard in 17).

### What the device keeps

| Data | Local copy | Writes |
| --- | --- | --- |
| Workouts and their exercises | All live workouts | Online only: REST, then the client puts the response into Dexie |
| Schedule rules | All non-deleted rules | Online only: REST, then Dexie |
| Exercises | Exercises in live workouts, exercises in local sessions, and all own exercises. Both locales of each | Online only: REST, then Dexie |
| Sessions and set logs | Sessions that started in the last 30 days, plus every `in_progress` session | Local first, through the outbox |
| Body measurements | All live measurements | Local first, through the outbox |
| Profile, gym profile | The one row of each | Online only: REST, then Dexie |

- The rest of the system catalog stays online only. Offline, the exercise library and the exercise picker search only the local exercises.
- The 30-day window counts back from today in the profile time zone.
- After a sync, the client deletes from Dexie the completed and abandoned sessions that started before the window, with their set logs. It keeps a session that has an entry in the outbox.
- Measurements now work offline: add, edit and delete go through the outbox. This replaces the spec 14 rule "disabled offline before spec 16".

### Reads beyond the window

- History: the first page comes from Dexie. Older pages load on scroll from `GET /api/v1/sessions` and stay only in the TanStack Query cache, not in Dexie.
- Calendar and progress, online: the screens use `/calendar` and `/progress` as now, merged with the unsynced local sessions.
- Calendar and progress, offline: a view opened before comes from the query cache. Other views are computed from local data with the shared pure functions. The progress range `1m` works offline. Other ranges and all-time records show "Потрібен інтернет" ("Needs internet") when the cache has no copy.
- The session summary keeps the bests stored at session start (spec 13), so new records work offline.

### Sessions on two devices

- A session that starts on device A appears on device B after its next pull. B can continue it. Set logs merge per row.
- The rest timer, the current exercise and the unsaved row drafts stay on the device that made them. Pull never overwrites them.
- Each device keeps its own `in_progress` session as the active session. Another `in_progress` session from a pull shows in History as in progress. It becomes the active session on that device when the device has no active session of its own.

### Initial download

- The download starts after login when the local database is empty, and after a Dexie schema change that needs a fresh copy.
- A full-screen progress screen shows until the download ends. Then the app opens. On an error, the screen offers a retry.
- Offline with an empty local database, the screen tells the user that the first start needs internet.
- The copy and layout come from `/design 16`.

## Data and API

### Push — `POST /api/v1/sync/push`

- Body: `{ mutations: [{ id, type, entityId, payload, createdAt }] }`, at most 50 mutations, in outbox order.
- `type` is one of `session.put`, `session.patch`, `set.put`, `set.patch`, `set.delete`, `measurement.put`, `measurement.delete`.
- `payload` is the body of the matching REST request. The server calls the same service functions as the REST handlers, so the validation is the same.
- The server applies the batch in one transaction, with one savepoint per mutation. It records each applied id in `sync_mutation`.
- Response: `{ results: [{ id, status, error? }] }`, one item per mutation, in order. `status` is `applied`, `duplicate` (the id is already in `sync_mutation`) or `rejected`. `error` is the API error code of a rejected mutation.
- A rejected mutation (a 4xx case) does not stop the batch. The client deletes it from the outbox and records the last error for spec 17.
- A server error (5xx) rolls back the whole batch. The client keeps every entry and retries with backoff.
- The server applies mutations in arrival order and sets `updatedAt` itself. Last write wins on that server time. The client clock is not used for conflicts.

### Pull — `GET /api/v1/sync/pull?since=`

- Without `since`, the response is the full local copy (the initial download). With `since`, it has the rows changed after the cursor, including tombstones (`deletedAt`).
- The cursor is `(updatedAt, id)` as an opaque string. The server returns rows from 30 seconds before the cursor time, because a transaction can commit after its `updatedAt` time. Local upserts are idempotent, so the overlap is safe.
- A workout comes as one row with its whole exercise list. `workout_exercise` gets no `updatedAt` or `deletedAt`.
- The response is paged. Each page has `nextCursor`. The client saves the cursor only after it writes the page to Dexie.
- An exercise that a workout or a session starts to reference comes in the next pull, also when the exercise row did not change.

### Data model

- New table `sync_mutation` as in `docs/tech/DATA_MODEL.md`.
- New `(userId, updatedAt)` indexes on the synced tables that do not have one.
- No other column changes.

### Outbox migration

- Dexie schema version 2 converts each spec 10 outbox entry (`method` and `path`) into a mutation with the same `id` and the same order. For example, `PUT /sessions/{id}` becomes `session.put`.
- After the migration, only `/sync/push` sends the outbox.

## Out of scope

- UX around offline (status count, blocked actions, logout guard, images, the notice for a rejected mutation) — spec 17.
- Offline search over the full system catalog. Only the local exercises are searchable offline.
- Clean-up of old `sync_mutation` rows and of old tombstones.

## Acceptance criteria

- [ ] AC1: With the network off, a user can start a planned workout, log all sets, finish, and see it in history and in the progress range `1m` (from local data).
- [ ] AC2: Back online, the outbox empties and the server has exactly the same sessions and sets (E2E with `setOffline`).
- [ ] AC3: Replaying a push batch produces no duplicates, and each replayed mutation comes back as `duplicate` (server test).
- [ ] AC4: Killing the app mid-push and reopening completes the sync without duplicates or losses.
- [ ] AC5: Two devices: a workout edited on one appears on the other after its next pull; a deleted one disappears.
- [ ] AC6: Two tabs never push concurrently.
- [ ] AC7: Unit tests cover outbox ordering, batching, partial failure and retry.
- [ ] AC8: A batch with one invalid mutation applies the others. The invalid one comes back as `rejected` with its error code, and the client deletes it from the outbox.
- [ ] AC9: A server error rolls back the whole batch, and the client keeps every entry.
- [ ] AC10: After login on an empty device, the progress screen shows until the download ends. Offline with an empty database, the screen shows the "needs internet" state.
- [ ] AC11: Offline, the exercise library and the picker show and search only the local exercises.
- [ ] AC12: Offline, a user can add, edit and delete a body measurement. Back online, the server has the same rows.
- [ ] AC13: After a sync, Dexie has no synced session older than 30 days. History still loads older pages online.
- [ ] AC14: A session started on device A can be continued on device B. If B has its own active session, A's session shows in History as in progress.
- [ ] AC15: An outbox from spec 10 with pending entries syncs after the update with no loss and no duplicates.
- [ ] AC16: A pull that overlaps the last page writes no duplicate rows, and a row committed late is not missed (server test).

## Depends on

10–14, 15.

## Design

Canvas: <https://claude.ai/artifact/Xd2qfoyciXTTwuatHC6Rg7>. All boards are agreed.

| Board | Screen and state |
| --- | --- |
| D16.1 | Initial download, in progress (390) |
| D16.2 | Initial download, error (390) |
| D16.3 | Initial download, offline with an empty database (390) |
| D16.4 | Initial download, desktop (1440) |
| D16.5 | Exercise library, offline (390) |
| D16.6 | Exercise library, offline search with no result (390) |
| D16.7 | Session "Add exercise" picker, offline (390) |
| D16.8 | Exercise library, offline, desktop (1440) |

### Initial download (D16.1–D16.4)

- **Layout.** No app shell: the wordmark on top and one centred card, the same frame as the spec 15 `/offline` page. The card is full width on mobile and 480px wide on desktop.
- **Progress.** A 3px bar on the top edge of the card shows the total progress in `--accent`. Under the headline, a list shows the five steps in order:
  1. Profile and gym.
  2. Workouts and plan.
  3. Exercises.
  4. History for 30 days.
  5. Body measurements.
- **Step markers.** The markers reuse the set-done diamonds:
  - a done step has an accent diamond with a check and its count ("12 тренувань");
  - the current step has a `--foreground` outline and "31 з 48";
  - a pending step has a `--planned` outline and muted text.
- **Error (D16.2).**
  - The failed step has a `--destructive` outline diamond and the label "Не завантажено".
  - The bar turns `--planned`.
  - The card adds the primary button "Спробувати ще раз" and a quiet link "Вийти з акаунта".
  - The retry continues from the failed step.
- **Offline with an empty database (D16.3).**
  - The header shows the offline pill.
  - The card has a dashed `--planned` diamond (as on `/offline`), a headline, one sentence and "Спробувати ще раз".
  - A note says that the download starts by itself when the network comes back.
  - D16.3 has no logout link, because logout needs the network.
- **Logout.** On D16.2, "Вийти з акаунта" logs out without the spec 17 guard. The reason is that a new device has an empty outbox.
- **Accessibility.**
  - The bar is a `progressbar` with a value, and the list is an ordered list with `aria-current="step"`.
  - The error text is an alert.
  - Under reduced motion, the bar changes with no animation.

### Offline catalog (D16.5–D16.8)

- **Exercise library.** The search placeholder becomes "Пошук серед збережених".
- **Hint.** A quiet line under the search shows a small outline diamond and the hint with the local count. It is muted text with no fill and no card.
- **List.** It shows only the local exercises, in the same groups and rows as online. The filters work on the local list.
- **Disabled create.** The "+" button (desktop: "Нова вправа") has a dashed `--planned` outline and is disabled. It has the label "Потрібен інтернет", as spec 07 says.
- **No result (D16.6).** A card shows a headline, one sentence with the count, and the secondary button "Очистити пошук".
- **Picker (D16.7).** The session "Add exercise" sheet gets the same placeholder and hint line over the list. The rows and the pick diamonds are as in spec 09.
- **Desktop (D16.8).** The library keeps the sidebar layout, and the groups are in two columns. The hint line sits under the toolbar.
- Spec 17 owns the offline status pill, the offline strip on Today, and the hint on other disabled controls.

### Copy

| Key (en) | uk |
| --- | --- |
| Preparing your data for the gym | Готуємо дані для залу |
| We save your workouts on this device so they work without a network. This happens only once. | Зберігаємо твої тренування на телефоні, щоб вони працювали без мережі. Це потрібно лише один раз. (desktop: «на цьому пристрої») |
| Profile and gym / Workouts and plan / Exercises / History for 30 days / Body measurements | Профіль і зал / Тренування і план / Вправи / Історія за 30 днів / Заміри тіла |
| Done / {{done}} of {{total}} / {{count}} workouts / {{count}} exercises | Готово / {{done}} з {{total}} / {{count}} тренувань / {{count}} вправ (plural forms) |
| If the connection drops, we continue from the same place. | Якщо зʼєднання перерветься, продовжимо з того самого місця. |
| Could not load {{step}} | Не вдалося завантажити {{step}} (for example, «історію») |
| The connection dropped. What is loaded is saved on this device. Try again when you have a network. | Зʼєднання перервалося. Те, що вже завантажено, збережено на телефоні. Спробуй ще раз, коли буде мережа. |
| Not loaded | Не завантажено |
| Try again | Спробувати ще раз |
| Log out | Вийти з акаунта |
| The first start needs internet | Перший запуск потребує інтернету |
| This device has none of your data yet. Connect to a network once, and after that Pampojo works without it. | На цьому пристрої ще немає твоїх даних. Підʼєднайся до мережі один раз, і далі Pampojo працюватиме без неї. |
| The download starts by itself when the network is back. | Завантаження почнеться саме, щойно зʼявиться мережа. |
| Search saved exercises | Пошук серед збережених |
| Offline, there are {{count}} exercises from your workouts and history. The rest of the catalog appears when you are online. | Без мережі тут {{count}} вправ з твоїх тренувань та історії. Решта каталогу зʼявиться з інтернетом. |
| No saved exercise matches | Серед збережених вправ цього немає |
| Offline, search covers only the {{count}} exercises from your workouts and history. The full catalog appears when you are online. | Без мережі пошук іде лише по {{count}} вправах з твоїх тренувань та історії. Повний каталог зʼявиться, щойно буде інтернет. |
| Clear search | Очистити пошук |
