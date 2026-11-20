# 17-offline-ux — technical plan

Spec: `docs/specs/17-offline-ux.md`
Design canvas: <https://claude.ai/artifact/XbNEmCscmtWSGg64C6WMPR> (boards D17.1–D17.9)

## 1. Summary

Make the gym day work offline with no friction, and show the network state clearly.

- A connectivity store adds a health ping to `navigator.onLine`. Every online check reads it.
- The status pill shows the outbox count and opens a sync sheet (mobile) or popover (desktop).
- `OnlineOnly` blocks each online-only control with the `wifi-off` icon, a toast on tap and a desktop tooltip. The text labels "Needs internet" under controls go away.
- The page cache also holds the page of each workout, each exercise on the device and each measurement type. Exercise details read Dexie first.
- The service worker caches the images of the exercises on the device.
- Logout is blocked offline. Online with pending changes, a dialog offers "Sync now" and "Cancel".
- An unsynced finished session shows a muted line on its summary.

## 2. Acceptance criteria

- AC1: When the browser goes offline, the pill shows "Офлайн" within 2 seconds. When a set is logged offline, the pill counter shows 1.
- AC2: When `navigator.onLine` is true but a request fails with a network error, the pill shows "Офлайн". When the health ping then succeeds, it shows "Онлайн" again and a sync starts.
- AC3: A tap on the pill opens the sync view. It shows the state, the pending count, the last sync time and, if present, the last error with its reason. "Синхронізувати зараз" is blocked offline. Online, it runs a sync, and the outbox becomes empty.
- AC4: Offline, every control in the online-only list (section 6.4) has the `wifi-off` icon (corner badge or leading icon), no text label under it, and an accessible name that ends with "Потрібен інтернет". A tap shows the toast "Потрібен інтернет" and opens no dialog, sheet or page. Online, the same controls work as before.
- AC5: Offline, these controls show no icon and work: start, continue and finish a session; log and edit sets; add and swap exercises in a session; the rest timer; add, edit and delete a measurement.
- AC6: On a production build, after the first download and with no earlier visit, these pages open offline: `/library/workouts/<id>` for each live workout, `/library/exercises/<id>` for each exercise on the device, `/profile/measurements/<type>` for each measurement type.
- AC7: Offline, "Вийти з акаунта" is blocked as in AC4. Online with an empty outbox, logout works as now. Online with pending changes, a dialog "Спершу синхронізуй зміни" offers "Синхронізувати зараз" and "Скасувати". After a sync that empties the outbox, logout continues by itself. If the sync fails, the dialog stays open and shows an error line.
- AC8: The summary of a finished session that has outbox entries shows the line "Збережено на цьому пристрої. Синхронізується, коли зʼявиться інтернет." The line goes away when its entries are pushed. The line also shows when the session opens from history.
- AC9: On a production build, offline, the images of exercises in the user's workouts and local sessions show. Other images show the existing placeholder.
- AC10: Manual check on a real iPhone: installed PWA, airplane mode, a full session, reopen online, data synced. The review keeps the screenshots.

## 3. Data

- No server changes. No migration.
- Dexie: no schema change. `meta.sync.lastSyncAt` and `meta.sync.lastError` already exist (`src/services/local-db/db.ts`). The `outbox` table already has the `entityId` index.

## 4. API

- No new routes. The health ping uses `GET /api/v1/health` (`src/app/api/v1/health/route.ts`, `auth: 'none'`, `Cache-Control: no-store`). A 200 or a 503 both mean "the network works": only a thrown `fetch` means offline.

## 5. Server

No changes.

## 6. Client

### 6.1 Connectivity — `src/services/connectivity.ts`

- A module store: `{ online: boolean }` with `subscribe`, `getSnapshot`, `reportNetworkFailure()`.
- `online` is `navigator.onLine && !pingFailing`.
- `window` `online` and `offline` events update the store at once (AC1).
- `reportNetworkFailure()`: if the store is online, set `pingFailing = true` and start the ping loop. The loop fetches `/api/v1/health` with `cache: 'no-store'` every 15 seconds (`CONNECTIVITY_PING_MS = 15_000`). The first ping runs at once.
- A ping that resolves (any status) sets `pingFailing = false`, stops the loop and calls `requestSync()`.
- An `online` event also clears `pingFailing`.
- `src/api/http.ts`: before it throws `ApiError(NETWORK_ERROR)`, call `reportNetworkFailure()`. `src/services/sync/push.ts` and `pull.ts` use `http`, so sync failures also report.
- `src/hooks/useIsOnline.ts` keeps its name and now reads this store with `useSyncExternalStore` (server snapshot `true`). The 25 call sites do not change. `useConnectivity()` is not added, because the spec's purpose is "one source for online checks", and `useIsOnline` already is that source.

### 6.2 Sync state hooks — `src/services/local-db/`

- `useOutboxCount(db)`: a Dexie live query of `db.outbox.count()`.
- `useSyncMeta(db)`: a live query of `readSyncMeta(db)`.
- `useUnsyncedEntities(db, ids)`: a live query of `db.outbox.where('entityId').anyOf(ids).count() > 0`.
- Export them from `src/services/local-db/index.ts`.

### 6.3 Status pill and sync view (D17.2, D17.3, D17.9)

- `src/components/StatusPill/StatusPill.tsx`: becomes a `button` (forward ref, `...props`). It shows the counter in both states when `pendingCount > 0`. Its `aria-label` is "Онлайн" or "Офлайн", plus ". {{count}} змін чекають синхронізації" when the count is above 0, plus ". Відкрити синхронізацію".
- New `src/features/sync/SyncStatus/SyncStatus.tsx`: reads `useIsOnline()`, `useOutboxCount(db)` and `useSyncMeta(db)`. It renders the pill as the trigger:
  - below `lg`: a bottom `Sheet` (`src/components/ui/sheet.tsx`);
  - from `lg`: a 360px `Popover` aligned to the end of the pill, 8px under it.
- `TopBar` renders `SyncStatus` in place of `StatusPill`. `TopBar` is inside the `LocalDbProvider`, so `useRequiredLocalDb()` works.
- Add `src/components/ui/popover.tsx` and `src/components/ui/tooltip.tsx` with the shadcn generator. Both import from the existing `radix-ui` package. No new dependency.
- Sync view content (`SyncPanel.tsx`, used by the sheet and the popover):
  - Title "Синхронізація" (sheet 20/800, popover 18/800).
  - A `dl` with three rows and `--border` dividers:
    - "Стан": the diamond and "Онлайн" / "Офлайн", as in the pill.
    - "Чекають синхронізації": "{{count}} змін" (plural), or "Усе синхронізовано" at 0.
    - "Остання синхронізація": `formatSyncTime(lastSyncAt, now, locale)`. Under 60 seconds it is "щойно". On the same day it is "сьогодні о 17:42". Otherwise it is "20 листопада о 17:42". With `null` it is "Ще не синхронізовано".
  - Offline only: the muted 14px sentence "Підходи й заміри збережено на телефоні. Вони синхронізуються, щойно зʼявиться мережа." From `lg`, it says "на цьому пристрої".
  - The last error, if `lastError` is set: a note with a 1px `--border` outline, 6px radius and 14px padding. It has a 9px `--destructive` outline diamond, "Одну зміну не збережено" (15/700), then the reason and the time in muted 14px: "{{reason}} {{time}}." The reason comes from `rejectionReason(code)`, see section 7.
  - "Синхронізувати зараз": online, the primary button. It calls `syncNow(db)` and shows the pending state until the result. `busy` means another tab runs the sync: keep the pending state for 1 second, then end it. Offline, it is a blocked label control (section 6.4).
- The last error stays until the next push that has no rejection. `push.ts` sets `lastError: null` after a batch with no rejected entry.

### 6.4 Blocked controls — `src/features/offline/` (D17.1, D17.4, D17.5, D17.8)

- `OnlineOnly` (`OnlineOnly/OnlineOnly.tsx`). Props: `label: string` (the visible label or the icon button name), `kind: 'icon' | 'label'`, `children` (one element).
  - Online: it renders the child as it is, with `aria-label={label}` for `kind: 'icon'`.
  - Offline: it renders the child through Radix `Slot` with:
    - `aria-disabled="true"`, not `disabled`, so the control keeps the focus and the tap;
    - `aria-label` = "{{label}}. Потрібен інтернет";
    - `data-blocked=""`. The child's classes then turn into the blocked style: `border-[1.5px] border-dashed border-planned bg-transparent text-muted-foreground shadow-none cursor-not-allowed`. Add a `data-[blocked]:` variant set to `buttonVariants` in `src/components/ui/button.tsx`;
    - `onClick` and `onKeyDown` (Enter, Space): `preventDefault()`, `stopPropagation()`, and `toast(t('Needs internet'), { icon: <WifiOff/>, duration: 2000, id: 'needs-internet' })`. The fixed id keeps one toast on repeated taps.
  - `kind: 'icon'`: wrap the child in a `relative inline-flex` span and add the badge. The badge is `absolute -top-[7px] -right-[7px] size-5 rounded-sm bg-foreground text-card ring-2 ring-background`, with `WifiOff` at `size-3` and stroke 2.4, `aria-hidden`.
  - `kind: 'label'`: no badge. The call site renders `WifiOff` in place of its leading icon while `useIsOnline()` is false. A control with no icon gets `WifiOff` as a new leading icon.
  - From `lg`, offline: wrap in `Tooltip` with the content "Потрібен інтернет". The tooltip has the `--foreground` fill, `--card` text, 14/600, a 4px radius and the floating shadow, under the control. It opens on hover and on keyboard focus.
- The toast style: the app `Toaster` (`src/features/theme/ThemedToaster.tsx`) gets a `needs-internet` class for this toast. The class sets the `--foreground` fill, `--card` text, the `--accent` icon, a 6px radius and the floating shadow. On mobile the toaster offset keeps the toast above the bottom nav (`bottom: calc(96px + env(safe-area-inset-bottom))`).
- `useRequiresOnline()` (`hooks/useRequiresOnline.ts`): returns `{ blocked: boolean }` for call sites that swap the leading icon.

Online-only controls (each is offline-blocked through `OnlineOnly`; the old "Needs internet" text and the `disabled={!online}` go away):

| Control | File | Kind |
| --- | --- | --- |
| Library "+" / "Нова вправа" / "Нове тренування" | `features/library/LibraryTabs/LibraryTabs.tsx`, `features/workouts/WorkoutList/WorkoutListEmpty.tsx`, `features/exercises/ExerciseCatalog/ExerciseCatalog.tsx` | icon on mobile, label on desktop |
| Workout row actions "…" | `features/workouts/WorkoutList/WorkoutList.tsx` | icon |
| Workout editor "Зберегти", "Додати вправи" | `features/workouts/WorkoutEditor/WorkoutEditorForm.tsx` (the `save-hint` text "Needs internet" goes away; the "Add a name…" hint stays) | label |
| Plan changes in the day panel | `features/calendar/DayPanel/DayPanel.tsx` (the line "Needs internet to change the schedule." goes away) | label |
| Own exercise "Редагувати", "Видалити", "Дублювати як свою" | `features/exercises/OnlineLinkButton/OnlineLinkButton.tsx`, `features/exercises/DeleteExerciseDialog` trigger | label |
| Exercise form "Зберегти" | `features/exercises/ExerciseForm/ExerciseForm.tsx` | label |
| Gym "Налаштувати" and the gym editor save | `features/gym/GymNudgeCard/GymNudgeCard.tsx`, `features/gym/GymEditor/GymEditor.tsx` | label |
| Profile edit button and its save | `features/profile/ProfileView/ProfileView.tsx`, `features/profile/EditProfileSheet/EditProfileSheet.tsx` | icon / label |
| "Вийти з акаунта" | `features/auth/LogOutButton/LogOutButton.tsx` | label |

Not blocked (AC5), keep as they are: `StartWorkoutSheet`, `SessionExerciseList` "Add exercise", swap, set rows, rest timer, `MeasurementsSection`, `AddMeasurementSheet`, `EditMeasurementSheet`. These already work with a local database. Their remaining "Needs internet" text shows only without a local database (a signed-out device), so it stays.

Content states are not controls and stay: `ProgressStates` "Needs internet", `MeasurementHistory` and `MeasurementsSection` `OfflineNotice` without a local database.

The theme switch is a device setting and stays enabled.

### 6.5 Pages offline (AC6)

- `src/features/pwa/warm-pages.ts`: `warmMissingPages(extraPaths: readonly string[] = [])` checks `WARM_PAGE_PATHS` plus `extraPaths`.
- New `src/features/pwa/useWarmAppPages.ts` signature: `useWarmAppPages(db: PampojoDb)`. It builds the extra paths from Dexie:
  - `/library/workouts/<id>` for each workout with `deletedAt === null`;
  - `/library/exercises/<id>` for each exercise with `deletedAt === null`;
  - `/profile/measurements/<type>` for each `MEASUREMENT_TYPES` entry.
- It runs on mount, on `online`, on `controllerchange`, and after each sync that ends `done`. Add `notifySyncDone()` and `onSyncDone(listener)` to `src/services/sync/request-sync.ts`. `useSyncRunner` and `useInitialDownload` call `notifySyncDone()` after a `done` result.
- `CurrentUserProvider` passes the db to `PageWarmer`.
- A page that is gone (a deleted workout) stays in the cache until the next worker version. This is harmless: the page reads Dexie and shows its not-found state.

Exercise details from Dexie:

- `src/api/exercises.ts`: add `fetchExercise(id)` (`GET /api/v1/exercises/:id`, `exerciseSchema`) and `useExerciseQuery(id)`. The query key is `[...exerciseKeys.detail(id), lang]`. With a db, `queryFn` reads `getLocalExercise(db, id, lang)`. If that is `null` and `navigator.onLine`, it calls `fetchExercise(id)`. Use `useLocalQuery` with a `read` that does this fallback.
- New `src/features/exercises/ExerciseDetails/ExerciseDetailsScreen.tsx` (client): it uses `useExerciseQuery(id)`.
  - Loading: `ExerciseDetailsSkeleton`.
  - Found: `ExerciseDetails`.
  - `null`, online: the existing not-found UI of the route (`notFound()` is server-only, so render the `not-found` content component).
  - `null`, offline: `OfflineNotice` with "Потрібен інтернет".
- `src/app/[lang]/(app)/library/exercises/[id]/page.tsx`: the body renders `<ExerciseDetailsScreen id={id} />` after the uuid check. `generateMetadata` keeps the server lookup for the title.
- `ExerciseDetails` keeps its `exercise` prop. `useProgressExercisesQuery({ enabled: online })` stays.

### 6.6 Exercise images offline (AC9)

- `src/features/pwa/constants.ts`: `IMAGES_CACHE = 'pampojo-images'`, `IMAGES_CACHE_MAX_ENTRIES = 600`.
- `src/app/sw.ts`: a rule before the catch-all `NetworkOnly`:
  - matcher: `request.method === 'GET'` and `url.pathname` contains `/storage/v1/object/` (public and signed Supabase URLs; cross-origin);
  - handler: `CacheFirst({ cacheName: IMAGES_CACHE, plugins: [...] })` with:
    - a `cacheKeyWillBeUsed` plugin that returns the URL without its query, so an own image keeps one key after its signature expires;
    - `CacheableResponsePlugin({ statuses: [200] })`;
    - `ExpirationPlugin({ maxEntries: IMAGES_CACHE_MAX_ENTRIES, purgeOnQuotaError: true })`.
- The `activate` handler still deletes only `PAGES_CACHE`. The image URLs do not change between versions.
- `src/features/pwa/caches.ts`: `deletePageCaches()` also deletes `IMAGES_CACHE`, because own images are private.
- New `warmExerciseImages(urls)` in `src/features/pwa/warm-images.ts`: online and with a controller, for each URL that `caches.match(urlWithoutQuery, { cacheName: IMAGES_CACHE, ignoreSearch: true })` misses, run `fetch(url, { mode: 'cors' })`. The worker stores the response. Errors are ignored. At most 4 requests run at a time.
- `useWarmAppPages` also collects the frame URLs (`thumbUrl` and `fullUrl`) of:
  - the exercises in live workouts;
  - the exercises in local sessions (`session.exercises[].exerciseId`).
  It calls `warmExerciseImages` after the pages.
- `ExerciseImage` does not change. A cache miss offline fails the image, and the existing placeholder shows.

### 6.7 Logout (AC7, D17.6)

- `LogOutButton`:
  - Offline: blocked through `OnlineOnly` (`kind: 'label'`, `WifiOff` leading icon).
  - Online: as now, `flushAllLocalDbs()` first. With 0 left, `signOutAndClear()`.
  - With entries left: open the new dialog in place of the spec 10 `ConfirmDialog`:
    - an alert dialog, title "Спершу синхронізуй зміни";
    - text "{{count}} змін ще не на сервері. Тренування, які не синхронізувались, зникнуть після виходу.";
    - the primary "Синхронізувати зараз" and the secondary "Скасувати", stacked on mobile;
    - "Синхронізувати зараз" runs `flushAllLocalDbs()` again with the pending state. At 0, it closes the dialog and runs `signOutAndClear()`. Above 0, the dialog shows a `--destructive` line: "Не вдалося синхронізувати. Спробуй ще раз." The count updates.
  - There is no "Log out anyway".
- Remove the strings "Log out?" and "Unsynced workout data will be lost. Connect to the internet so it can sync." if nothing else uses them.

### 6.8 Session summary (AC8, D17.7)

- `SessionSummary`: compute `ids = [session.id, ...setLogs.map((s) => s.id)]` and `unsynced = useUnsyncedEntities(db, ids)`.
- When `unsynced` is true, render under the date line a `p` with `flex items-center gap-2 text-sm text-muted-foreground mt-1`, `WifiOff` at `size-4` (`aria-hidden`), and the text "Збережено на цьому пристрої. Синхронізується, коли зʼявиться інтернет."
- The live query removes the line when the push deletes the entries.

### 6.9 Layout notes

- Mobile 390: the pill is in the top bar. The sheet uses the existing `Sheet` with an 8px top radius and the drag handle.
- Desktop 1440: the pill is at the right of the top bar. The popover is 360px wide, padding 20px, 6px radius, the floating shadow.
- Dark theme: every new class uses tokens, so spec 29 needs no extra work. The badge ring uses `ring-background`.
- Reduced motion: the sheet and the popover use the existing animation classes, which already respect `prefers-reduced-motion`.

## 7. Copy

Add to `src/i18n/locales/en.json` and `uk.json`. Plural keys use the existing i18next suffixes (`_one`, `_few`, `_many`, `_other` for uk).

| Key (en) | uk |
| --- | --- |
| Needs internet | Потрібен інтернет (exists) |
| {{label}}. Needs internet | {{label}}. Потрібен інтернет |
| Online | Онлайн (exists) |
| Offline | Офлайн (exists) |
| {{count}} change waiting to sync | {{count}} зміна чекає синхронізації / {{count}} зміни чекають синхронізації / {{count}} змін чекають синхронізації (exists, check the forms) |
| Open sync | Відкрити синхронізацію |
| Sync | Синхронізація |
| Status | Стан |
| Waiting to sync | Чекають синхронізації |
| {{count}} changes | {{count}} зміна / {{count}} зміни / {{count}} змін |
| Everything is synced | Усе синхронізовано |
| Last synced | Остання синхронізація |
| just now | щойно |
| today at {{time}} | сьогодні о {{time}} |
| {{date}} at {{time}} | {{date}} о {{time}} |
| Not synced yet | Ще не синхронізовано |
| Sets and measurements are saved on this phone. They sync as soon as the network is back. | Підходи й заміри збережено на телефоні. Вони синхронізуються, щойно зʼявиться мережа. |
| Sets and measurements are saved on this device. They sync as soon as the network is back. | Підходи й заміри збережено на цьому пристрої. Вони синхронізуються, щойно зʼявиться мережа. |
| Sync now | Синхронізувати зараз |
| One change was not saved | Одну зміну не збережено |
| The workout was deleted on another device, so the server did not accept the change. | Тренування видалили на іншому пристрої, тому сервер не прийняв зміну. |
| The workout was already finished on another device. | Тренування вже завершили на іншому пристрої. |
| The measurement was deleted on another device. | Замір видалили на іншому пристрої. |
| The server did not accept the data of the change. | Сервер не прийняв дані зміни. |
| The server did not accept the change. | Сервер не прийняв зміну. |
| Sync your changes first | Спершу синхронізуй зміни |
| {{count}} changes are not on the server yet. Workouts that did not sync will be lost if you log out. | {{count}} зміна ще не на сервері… / {{count}} зміни ще не на сервері… / {{count}} змін ще не на сервері. Тренування, які не синхронізувались, зникнуть після виходу. |
| Couldn't sync. Try again. | Не вдалося синхронізувати. Спробуй ще раз. |
| Cancel | Скасувати (exists) |
| Saved on this device. Will sync when online. | Збережено на цьому пристрої. Синхронізується, коли зʼявиться інтернет. |

`rejectionReason(code)` in `src/features/sync/utils.ts`:

| Code | Reason key |
| --- | --- |
| `SESSION_NOT_FOUND` | The workout was deleted on another device, so the server did not accept the change. |
| `SESSION_NOT_IN_PROGRESS` | The workout was already finished on another device. |
| `MEASUREMENT_NOT_FOUND` | The measurement was deleted on another device. |
| `VALIDATION_FAILED` | The server did not accept the data of the change. |
| any other | The server did not accept the change. |

## 8. Steps

1. Connectivity: create `src/services/connectivity.ts` with the store, the ping loop and `reportNetworkFailure()`. Rewrite `src/hooks/useIsOnline.ts` on top of it. Call `reportNetworkFailure()` in `src/api/http.ts`. Add `CONNECTIVITY_PING_MS` to `src/constants/sync.ts`.
2. Sync state hooks: add `useOutboxCount`, `useSyncMeta` and `useUnsyncedEntities` in `src/services/local-db/sync-state.ts` and export them. Clear `lastError` after a clean push in `src/services/sync/push.ts`. Add `notifySyncDone` and `onSyncDone` in `src/services/sync/request-sync.ts`, and call it from `useSyncRunner.ts` and `download.ts`.
3. UI primitives: generate `src/components/ui/popover.tsx` and `src/components/ui/tooltip.tsx`. Add the `data-[blocked]` styles to `src/components/ui/button.tsx`. Add the `needs-internet` toast style and the mobile offset in `src/features/theme/ThemedToaster.tsx`.
4. Status pill and sync view: change `src/components/StatusPill/StatusPill.tsx`. Create `src/features/sync/SyncStatus/` (`SyncStatus.tsx`, `SyncPanel.tsx`, `index.ts`) and `src/features/sync/utils.ts` (`formatSyncTime`, `rejectionReason`). Use `SyncStatus` in `src/features/app-shell/TopBar/TopBar.tsx`.
5. Blocked controls: create `src/features/offline/OnlineOnly/` and `src/features/offline/hooks/useRequiresOnline.ts`. Apply them to every file in the table of section 6.4. Rewrite `OnlineLinkButton` on top of `OnlineOnly`.
6. Logout: change `src/features/auth/LogOutButton/LogOutButton.tsx` (section 6.7).
7. Session summary: change `src/features/session/ActiveSession/SessionSummary.tsx` (section 6.8).
8. Exercise details: add `fetchExercise` and `useExerciseQuery` to `src/api/exercises.ts`. Create `ExerciseDetailsScreen.tsx`. Change the route `src/app/[lang]/(app)/library/exercises/[id]/page.tsx`.
9. Pages and images: change `src/features/pwa/warm-pages.ts`, `useWarmAppPages.ts`, `constants.ts` and `caches.ts`. Create `src/features/pwa/warm-images.ts`. Change `src/features/auth/CurrentUser/CurrentUser.tsx` to pass the db. Add the image rule in `src/app/sw.ts`.
10. Copy: add every key of section 7 to both catalogs. Run `pnpm i18n:check`.
11. Docs: update `docs/tech/OFFLINE.md` "Offline rules" and "Status indicator" to match the spec: the icon and toast in place of the label, the logout rule, the sync sheet and popover, the image cache.
12. Tests (section 9), then `pnpm lint`, `pnpm typecheck`, `pnpm test` for the touched files, and the e2e files on a production build (`pnpm build && CI=1 pnpm exec playwright test e2e/17-offline-ux.spec.ts`).

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/services/__tests__/connectivity.test.ts`: `offline` event sets offline at once. `src/features/sync/SyncStatus/__tests__/SyncStatus.test.tsx`: the counter shows 1 after an outbox entry. `e2e/17-offline-ux.spec.ts` "the pill shows offline and the pending count" |
| AC2 | `connectivity.test.ts`: `reportNetworkFailure` sets offline with `onLine` true; a resolved ping sets online and calls `requestSync`; a rejected ping retries after 15 s (fake timers). `src/api/__tests__/http.test.ts`: a thrown fetch reports the failure |
| AC3 | `SyncStatus.test.tsx`: the sheet rows, "Усе синхронізовано", the time formats, the error note with each reason, "Sync now" blocked offline, online calls `syncNow`. `src/features/sync/__tests__/utils.test.ts`: `formatSyncTime`, `rejectionReason`. `src/services/sync/__tests__/push.test.tsx`: a clean push clears `lastError` |
| AC4 | `src/features/offline/OnlineOnly/__tests__/OnlineOnly.test.tsx`: offline icon kind has the badge, the label kind has no badge, the name ends with "Потрібен інтернет", a click shows the toast and does not call the child's handler, Enter does the same, online passes through. Updated component tests for `LibraryTabs`, `WorkoutList`, `WorkoutEditor`, `DayPanel`, `ExerciseDetails`, `ExerciseForm`, `GymNudgeCard`, `GymEditor`, `ProfileView`, `EditProfileSheet`: no "Needs internet" text, the blocked name. e2e "blocked controls show the icon and a toast" |
| AC5 | Existing tests of `StartWorkoutSheet`, `ActiveSession`, `SessionExerciseList`, `MeasurementsSection` stay green. e2e AC1 test of spec 16 "a workout started offline…" stays green |
| AC6 | `src/features/pwa/__tests__/warm-pages.test.tsx`: the extra paths for workouts, exercises and measurement types. `src/features/exercises/ExerciseDetails/__tests__/ExerciseDetailsScreen.test.tsx`: local row, remote fallback online, offline notice. e2e (production build): "workout, exercise and measurement pages open offline with no visit" |
| AC7 | `src/features/auth/LogOutButton/__tests__/LogOutButton.test.tsx`: blocked offline; empty outbox logs out; pending opens the dialog; a sync to 0 logs out; a failed sync shows the error line and keeps the dialog |
| AC8 | `src/features/session/ActiveSession/__tests__/SessionSummary.test.tsx`: the line with an outbox entry for the session or a set; no line without entries; the line goes away when the entries are deleted |
| AC9 | `warm-images.test.tsx`: fetches only missing URLs, at most 4 at a time, nothing offline. e2e (production build): "exercise images show offline" with a stub image route |
| AC10 | Manual check in `/review 17`. Screenshots go to `scratch/review/17-offline-ux/` |

## 10. Risks and open questions

- **Image CORS.** The warm-up uses `mode: 'cors'`. If a Supabase bucket does not send `Access-Control-Allow-Origin`, the fetch fails and the image is not cached. Check the public and the private bucket in `/implement`. If one fails, use `mode: 'no-cors'` and add status 0 to the `CacheableResponsePlugin`. Record the result in the implementation notes.
- **Page warm-up load.** A user with 30 workouts and 120 exercises warms about 160 pages once per worker version. The fetches run one at a time in the background, so the server sees one request at a time per device.
- **`aria-disabled` controls.** Code that checks `disabled` on a blocked control (tests, CSS) must move to `aria-disabled` or `data-blocked`.
- **Toast position.** The offset of section 6.4 must not cover the session bar. The session page has no bottom nav, so the toaster uses the default offset there.
- **The D17.4 board** shows "Почати тренування" on the workout page. The lead decided not to add it. The spec notes this.
- Out of scope: images of system exercises that are not on the device; Background Sync; clean-up of `sync_mutation` rows (spec 16).

## 11. Implementation notes
- The sync state hooks (`useOutboxCount`, `useSyncMeta`, `useHasUnsynced`) live in `src/services/sync/hooks.ts`, not in `local-db`. They read `readSyncMeta`, and `local-db` must not import `services/sync`. `useUnsyncedEntities` is named `useHasUnsynced`.
- `StatusPill` stays a presentational `role="status"` span, because the landing hero and the download screen also use it. `SyncStatus` wraps it in the trigger button with the full accessible name.
- The workout row menu "…" stays enabled offline, so "Start" still works. Only its "Duplicate" and "Delete" items are blocked: they show `WifiOff`, have the blocked name, and show the toast. An `OnlineOnly` badge wrapper also broke the absolute desktop position of the trigger.
- `GymProfileRow` (the "Gym equipment" row on Profile) is also blocked, because `/profile/gym` is online only. It shows `WifiOff` in place of the chevron.
- The logout dialog uses the existing `ConfirmDialog`, which has the `dialog` role, not `alertdialog`.
- The "Status" row uses the key `Status_sync` ("Стан"), because the existing "Status" key is "Статус" in other screens.
- `reportNetworkFailure()` also binds the window `online` listener, so the store recovers with no subscriber.
- A browser setup file (`vitest.setup.browser.ts`) resets the connectivity store after each test. Without it, a test with a failing `fetch` leaves the next test offline.
- Playwright treats `aria-disabled` as disabled, so tests click a blocked control with `force: true`. A real tap reaches it.
- The language switch stays enabled offline. It only sets a cookie on the device.

## 12. Review — 2026-11-21

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `src/services/__tests__/connectivity.test.tsx`, `SyncStatus.test.tsx`, `e2e/17-offline-ux.spec.ts` (pill, count); `AC1-{mobile,desktop}-offline.png` |
| AC2 | Pass | `connectivity.test.tsx` (a failed request sets offline, the ping restores online and requests a sync, 15 s retry) |
| AC3 | Pass | `SyncStatus.test.tsx`, `src/features/sync/__tests__/utils.test.ts`, `push.test.tsx` "clears the last error"; `AC3-{mobile,desktop}-sync-{offline,online}.png` match D17.2 and D17.9 |
| AC4 | Pass | `OnlineOnly.test.tsx` and the updated component tests; e2e "blocked controls answer with a toast"; `AC4-{mobile,desktop}-blocked-toast.png` match D17.1 and D17.8, findings 1 and 2 |
| AC5 | Pass | e2e 16 "a workout started offline…", e2e 17 "a measurement added offline…"; `AC8-mobile-summary-unsynced.png` (session started and finished offline) |
| AC6 | Pass | `warm-pages.test.tsx` (extra paths, `offlineTargets`), `ExerciseDetailsScreen.test.tsx`; e2e 17 on `next build`; `AC6-{mobile,desktop}-{workout,exercise,measurement}-offline.png` |
| AC7 | Pass | `LogOutButton.test.tsx` (blocked offline, dialog, sync then logout, failed sync); `AC7-{mobile,desktop}-{profile-offline,logout-dialog,logout-sync-failed}.png` match D17.5 and D17.6 |
| AC8 | Pass | `ActiveSession.test.tsx` "marks a finished session that waits to sync"; `AC8-{mobile,desktop}-summary-unsynced.png` match D17.7 |
| AC9 | Pass | `warm-pages.test.tsx` (`warmExerciseImages`); the walk on `next build` cached 4 images and showed 4–5 images offline on the exercise page (`AC6-mobile-exercise-offline.png`). Supabase answers CORS, so the plan's fallback is not needed. Finding 3 |
| AC10 | Not testable | Manual iPhone check, open |

### Findings

1. [minor] The desktop tooltip opens above the control, but D17.8 places it under — `src/features/offline/OnlineOnly/OnlineOnly.tsx:86` (`TooltipContent` has no `side="bottom"`). `AC4-desktop-blocked-toast.png`.
2. [minor] When the desktop sync popover opens offline, focus lands on the blocked "Синхронізувати зараз", and its tooltip opens at once over the sentence — `src/features/sync/SyncStatus/SyncStatus.tsx:55`. `AC3-desktop-sync-offline.png`. Focus the popover title or the content instead (`onOpenAutoFocus`).
3. [minor] The e2e image check runs only when the image cache is not empty, so a broken image cache passes the test — `e2e/17-offline-ux.spec.ts` (`if (images > 0)`). The catalog test data always has frames, so the check can be unconditional.
4. [minor] "щойно" in the sync view does not update while the view stays open, because `new Date()` is read only on render — `src/features/sync/SyncStatus/SyncPanel.tsx:72`.
5. [minor] For an exercise the device lacks, `useExerciseQuery` runs the server fetch inside the Dexie live query. Each change to the `exercises` table, for example a pull, fetches the exercise again — `src/api/exercises.ts` (`useExerciseQuery`).

### Checks

- lint: pass (`pnpm lint`).
- typecheck: pass (`pnpm typecheck`).
- format, i18n: pass (`pnpm format:check`, `pnpm i18n:check`).
- tests: pass, 151 files, 929 tests (`pnpm test`). One earlier combined run showed an unhandled `DatabaseClosedError` that did not repeat in three reruns.
- e2e (dev server): specs 05, 07, 08, 09, 11, 16, 17: 68 passed, 3 failed, 11 skipped (production only). Two failures were the new measurement test (fixed: it now waits for the measurements block). The third was a sign-up timeout in `09` desktop, which passed on rerun.
- e2e (`next build`, `CI=1`): specs 15, 16, 17: 24 of 24 passed.
- Scope: no server or data changes, no secrets, no build output. The `public/sw.js` file is generated and gitignored.

### Out of scope

- The language switch stays enabled offline. It sets a cookie and reloads, and the reload offline serves the cached page in the old language until the next online visit.
- The "Choose workout" sheet and the session "Add exercise" still show the "Needs internet" text without a local database (a signed-out device). No signed-in screen reaches this case.

## 13. Review fixes — 2026-11-21

The lead asked to fix every finding of section 12.

1. Fixed. The desktop tooltip opens under the control (`side="bottom"`), as in D17.8.
2. Fixed. The desktop sync popover moves focus to its title, so the tooltip of the blocked "Синхронізувати зараз" does not open at once.
3. Fixed. The e2e test waits until the image cache is not empty, then checks the image offline with no condition.
4. Fixed. The sync view re-reads the clock every 15 seconds, so "щойно" turns into a time.
5. Fixed. `useExerciseQuery` reads Dexie in the live query and uses a separate TanStack query for the server, only for an exercise the device lacks and only online.

Checks after the fixes: lint, typecheck and format pass. `pnpm test` passes 151 files and 929 tests. `CI=1` e2e for specs 15, 16 and 17 on `next build` passes 24 of 24.
