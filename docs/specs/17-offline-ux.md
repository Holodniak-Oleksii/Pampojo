# 17. Offline UX

## Goal

In the gym with no network, the user starts their own workouts, finishes them, and sees their profile and history. Changes sync with no loss when the network comes back. The user always knows if they are online and what waits to sync. An action that needs the network is visibly blocked with an icon, not with a text label or a dialog.

## User stories

- As a user in a basement gym, I open the app with no network, start my workout, log every set and finish it.
- As a user offline, I open my workouts, my exercises, my profile, my measurements and my history.
- As a user, I see how many changes wait to sync, and I can sync them when I am online again.
- As a user offline, I see at once which buttons do not work now, and a tap tells me why.
- As a user who logs out, I do not lose workouts that did not sync.

## Scope

### Connectivity

- `useConnectivity()` hook and store: `navigator.onLine` plus a health ping. The reason is that `onLine` can report true with no real connection.
- A failed API request starts a ping of `/api/v1/health`. While the ping fails, the app is offline. The ping repeats every 15 seconds until it succeeds.
- Every online check in the UI uses this hook instead of `useIsOnline()`.

### Status pill and sync sheet

- The top bar pill shows `Online` or `Offline`. When the outbox is not empty, the pill also shows the count of changes that wait to sync.
- A tap on the pill opens the sync sheet:
  - the last sync time (from `lastSyncAt`);
  - the count of changes that wait to sync;
  - "Sync now", enabled online only;
  - the last error, if any. A mutation that the server rejected shows here (from `lastError`). This is the notice that spec 16 moved to this spec.
- Today has no separate offline strip. The pill and the blocked controls are enough.

### Blocked actions

- `OnlineOnly` wrapper and `useRequiresOnline()` for every action that needs the network.
- Offline, a blocked control:
  - stays visible and gets the muted style;
  - shows a small "no network" icon over its corner;
  - has no text label under it. The existing "Needs internet" labels on controls are removed;
  - on tap, shows a toast "Needs internet" for 2 seconds. It opens no dialog and no sheet;
  - on desktop, also shows the tooltip "Needs internet" on hover;
  - has an accessible name that includes "Needs internet".
- Online, the same control works as usual.
- The list of online-only actions:
  - create, edit, duplicate and delete a workout;
  - change the plan (schedule rules);
  - create and edit an own exercise, and duplicate a system exercise;
  - the gym profile ("Set up" on Profile and the gym editor);
  - profile and account changes (name, avatar, units, language);
  - log out;
  - share links, import and AI features, when their specs add them.
- Allowed offline, with no icon: start, continue and finish a session, log and edit sets, add and swap exercises in a session, the rest timer, and add, edit and delete measurements.
- Content that needs the network is not an action. The progress ranges other than `1M` and the all-time records keep their spec 16 state "Needs internet".

### Pages offline

- These pages open offline with no earlier visit, from local data:
  - the workout page `/library/workouts/[id]` of each live workout. Offline it is read-only, and "Save" is blocked as above;
  - the exercise details `/library/exercises/[id]` of each exercise on the device (exercises of workouts and local sessions, and own exercises). The details read Dexie, not the server;
  - the measurement page `/profile/measurements/[type]` of each measurement type.
- The app loads these pages into the page cache in the background, as spec 16 does for the main pages. It loads the page of a new workout or exercise after the next pull.
- The details of a system exercise that is not on the device keep the offline fallback.
- `/profile/gym` is online only, because the gym profile is an online-only action.

### Logout guard

- Offline, "Log out" is always blocked, as an online-only action.
- Online, with an empty outbox, logout works as now.
- Online, with a non-empty outbox, a dialog explains that workouts that did not sync will be lost. It has "Sync now" and "Cancel". There is no "Log out anyway".
- After "Sync now", if the outbox becomes empty, logout continues by itself. If the sync fails, the dialog stays and shows the error.
- This dialog replaces the spec 10 warning ("Вийти" / "Скасувати").

### Session finish offline

- When a session finishes and is not synced yet, the summary screen shows a muted line under the title with the "no network" icon: "Saved on this device. Will sync when online."
- The line goes away when the session syncs. It also shows when the user opens an unsynced session from history.

### Exercise images offline

- The service worker caches the images of every exercise in the user's workouts and in the sessions on the device.
- The cache is cache-first and has a size cap. The app loads missing images in the background after a pull, when online.
- Own-exercise images have signed URLs that expire after 1 hour. The cache key is the image path without the signature.
- An image that is not in the cache shows the existing placeholder.

## Out of scope

- Images of system exercises that are not on the device.
- A background sync while the app is closed. iOS has no Background Sync.
- Clean-up of old `sync_mutation` rows and tombstones (spec 16 "Out of scope").

## UX

- The "no network" icon is the same icon everywhere: on blocked controls, in the sync sheet and on the session summary line. `/design 17` picks the icon.
- A blocked control keeps its size and place. The icon must not change the layout.
- Copy (en / uk):

| Key (en) | uk |
| --- | --- |
| Needs internet | Потрібен інтернет |
| {{count}} change waiting to sync | {{count}} зміна чекає синхронізації (plural forms) |
| Last synced {{time}} | Остання синхронізація {{time}} |
| Not synced yet | Ще не синхронізовано |
| Sync now | Синхронізувати зараз |
| Saved on this device. Will sync when online. | Збережено на цьому пристрої. Синхронізується, коли зʼявиться інтернет. |
| Workouts that did not sync will be lost if you log out. | Тренування, які не синхронізувались, зникнуть після виходу. |
| Cancel | Скасувати |
| Sync | Синхронізація |
| Status | Стан |
| Waiting to sync | Чекають синхронізації |
| Everything is synced | Усе синхронізовано |
| just now | щойно |
| Sets and measurements are saved on this device. They sync as soon as the network is back. | Підходи й заміри збережено на телефоні. Вони синхронізуються, щойно зʼявиться мережа. (desktop: «на цьому пристрої») |
| One change was not saved | Одну зміну не збережено |
| Sync your changes first | Спершу синхронізуй зміни |
| {{count}} changes are not on the server yet. | {{count}} змін ще не на сервері. (plural forms) |

## Design

Canvas: <https://claude.ai/artifact/XbNEmCscmtWSGg64C6WMPR>

| Board | Screen and state |
| --- | --- |
| D17.1 | Library offline, a blocked icon button after a tap, with the toast (390) |
| D17.2 | Sync sheet, offline with pending changes (390) |
| D17.3 | Sync sheet, online with the last error (390) |
| D17.4 | Workout page offline, read-only, with a blocked wide button (390) |
| D17.5 | Profile offline (390) |
| D17.6 | Logout dialog, online with pending changes (390) |
| D17.7 | Session summary, finished and not synced (390) |
| D17.8 | Library offline with the tooltip (1440) |
| D17.9 | Sync popover, offline (1440) |

### Blocked control (D17.1, D17.4, D17.5, D17.8)

- The icon is lucide `wifi-off`. It is the same icon on controls, in the toast and on the summary line.
- A blocked control has a 1.5px dashed `--planned` outline, a transparent fill and `--muted-foreground` content, as the spec 16 "+" button.
- **Icon-only control.** A 20px `--foreground` badge with a 4px radius sits over the top-right corner, 7px outside it. The badge holds the 12px icon in `--card`. A 2px `--background` ring cuts it out of the control.
- **Control with a label.** The icon goes inside the control, before the label, in place of any other leading icon. There is no corner badge.
- **Toast.** A `--foreground` toast with a 6px radius and the floating shadow. It holds the icon in `--accent` and "Потрібен інтернет". On mobile it sits above the bottom nav.
- **Tooltip (desktop).** A `--foreground` tooltip with "Потрібен інтернет", under the control, on hover and on keyboard focus.
- The control keeps `aria-disabled="true"`, not `disabled`, so it still takes the tap and the focus.

### Status pill (all boards)

- Offline: `--foreground` fill, an accent outline diamond and "Офлайн".
- Online: `--card` fill, a `--success` diamond and "Онлайн".
- With pending changes, both states add a 20px `--accent` counter with dark text. The counter can show online too (D17.6).
- The pill is a button. Its accessible name says the state and the pending count.

### Sync sheet (D17.2, D17.3) and popover (D17.9)

- Mobile: a bottom sheet. Desktop: a 360px popover under the pill.
- Title "Синхронізація", then a list of three rows with dividers: "Стан", "Чекають синхронізації" and "Остання синхронізація".
- The pending row says "N змін" or "Усе синхронізовано". The time row says "щойно", "сьогодні о 17:42", or a date.
- Offline, a muted sentence explains that the changes sync later. "Синхронізувати зараз" is blocked as a wide control.
- Online, "Синхронізувати зараз" is the primary button.
- **Last error (D17.3).** A bordered note with a `--destructive` outline diamond, "Одну зміну не збережено", the reason and the time. Each error code has its own reason. An unknown code has a general reason. `/scratch 17` maps the codes.

### Workout page offline (D17.4)

- The page opens read-only with the exercise list. "Зберегти" is a blocked wide control.
- The board also shows "Почати тренування". The page does not get this button: the user starts a workout with Play or the sidebar button, as now.

### Profile offline (D17.5)

- The edit button is a blocked icon button. "Налаштувати" of the gym card and "Вийти з акаунта" are blocked wide controls.
- "Додати замір" and the measurement rows stay enabled.

### Logout dialog (D17.6)

- An alert dialog: "Спершу синхронізуй зміни", one sentence with the count, then the primary "Синхронізувати зараз" and the secondary "Скасувати".

### Session summary (D17.7)

- Under the title and the date, a muted 14px line with the icon: "Збережено на цьому пристрої. Синхронізується, коли зʼявиться інтернет."

### Left out

- Exercise photos on the boards are grey tiles. The code shows the cached photos.
- The dark theme uses the spec 29 tokens, with no new boards.

## Data and API

- No change to the data model or the API. `lastSyncAt` and `lastError` are in Dexie `meta.sync` from spec 16.
- The health ping uses the existing `GET /api/v1/health`.

## Acceptance criteria

- [ ] AC1: Going offline switches the pill to `Offline` within 2 seconds. Logging a set offline shows a count of 1 on the pill.
- [ ] AC2: With `onLine` true and a failing network, the pill shows `Offline` after a failed request, and `Online` after the ping succeeds.
- [ ] AC3: The sync sheet shows the last sync time, the pending count and the last error. "Sync now" is disabled offline. Online, it empties the outbox.
- [ ] AC4: Offline, every action in the online-only list shows the "no network" icon, has no text label, and a tap shows the "Needs internet" toast with no dialog. Online, the same actions work.
- [ ] AC5: Offline, the allowed actions (session, sets, swap, add exercise, rest timer, measurements) show no icon and work.
- [ ] AC6: On a production build, after the first download and with no earlier visit, these pages open offline: the page of each workout, the details of each exercise on the device, and each measurement page (e2e).
- [ ] AC7: Offline, "Log out" is blocked. Online with pending changes, the dialog offers "Sync now" and "Cancel". After a successful sync, logout continues.
- [ ] AC8: An unsynced finished session shows the "Saved on this device" line on its summary. The line goes away after the sync.
- [ ] AC9: On a production build, the images of exercises in the user's workouts show offline. Other images show the placeholder.
- [ ] AC10: Real iPhone check: installed PWA, airplane mode, a full session, reopen online, data synced (review screenshots).

## Depends on

16.
