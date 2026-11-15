# 15. PWA shell and install

## Goal

Pampojo installs to the home screen on Android and iPhone, and its pages open with no network after one online visit.

## User stories

- As a lifter, I want Pampojo on my home screen, so that it opens like an app.
- As a lifter, I want the app to open in a basement gym with no signal, so that I can start my workout.
- As a lifter on iPhone, I want to be told how to install, because Safari does not offer it by itself.

## Scope

### Manifest

- **Fields:**
  - `name` "Pampojo", `short_name` "Pampojo";
  - an English `description`;
  - `start_url` `/today`, `scope` `/`, `id` `/`, `display: standalone`, `orientation: portrait`.
- **Colors:** `background_color` and `theme_color` are the light `--background` (#ECE9E4). After load, the `<meta name="theme-color">` from spec 29 follows the active theme.
- **Icons:** made from `public/brand/pampojo-icon.svg`:
  - 192 and 512 PNG (`purpose: any`);
  - 192 and 512 maskable PNG, with the mark inside the safe zone on the brand background;
  - a 180 `apple-touch-icon` (exists: `src/app/apple-icon.png`).
- **iOS:** no custom startup images. The launch screen is the plain background. `apple-mobile-web-app-capable`, the status bar style and the title "Pampojo" are set through Next metadata.

### Service worker

- **Library:** Serwist. Record the choice and the Turbopack integration in ADR 0008, written in `/scratch` after the integration is checked against Next 16 with Turbopack. If Serwist cannot be integrated, ask the lead again before planning anything else.
- **Builds:** the service worker is registered in production builds only. It is off in `pnpm dev`.
- **Precache:** the static build assets (JS, CSS, fonts, brand images), the manifest icons, and the offline fallback page.
- **App pages** (`/today`, `/calendar`, `/library/**`, `/session/**`, `/progress`, `/profile/**`):
  - Navigations are network-first. Online, the page always comes from the network, and a copy is stored in a runtime cache.
  - Offline, or when the network fails, the stored copy is served. With no stored copy, the offline fallback page is served.
  - The data the page then needs comes from the existing caches and Dexie. A full offline data layer is spec 16.
- **Not cached:** `/api/**` responses, auth routes, the landing page and other marketing pages. They are network-only, so the browser shows its own error for them offline, which is out of the installed app's start path.
- **Logout:** deletes the runtime page cache with the local databases (`src/services/local-db/logout.ts`), so pages rendered for one user never open for the next one on the same device.
- **Updates are silent.**
  - A new service worker installs in the background and waits.
  - It takes over on the next launch, after all windows of the app are closed.
  - There is no prompt and no automatic reload, so a running workout is never interrupted.

### Offline fallback page (`/offline`)

- A static page, precached. It uses the app's visual language but not the app shell, because the shell needs the session.
- **Content:** the title "Немає з'єднання", the text, "Спробувати ще раз" (reloads), and the link "На «Сьогодні»" (`/today`).
- It is light and dark aware through the theme class from spec 29.

### Install prompts

- **Android and desktop Chrome or Edge:**
  - Capture `beforeinstallprompt` and keep the event.
  - "Встановити" calls `prompt()`. After `appinstalled` or an accepted choice, all install UI hides.
- **iPhone and iPad Safari, not standalone:** "Як встановити" opens a guide sheet with three illustrated steps.
  - The other iOS browsers that can add to the home screen get the same guide.
- **Today card:**
  - Shown on phones only (below `lg`), when the app is not installed and an install path exists: a captured prompt, or iOS.
  - The close button hides it for 7 days, stored per device in `localStorage`. On iOS this also limits the guide to once a week.
- **Profile row:** "Встановити застосунок", shown on all sizes while the app is not installed and an install path exists. It starts the same prompt or guide.
- **Installed:** `display-mode: standalone` or `navigator.standalone` hides all install UI.

### Persistent storage

- `navigator.storage.persist()` is called once:
  - on the first launch in standalone mode;
  - on the first session start in a browser tab.
- The result is not shown to the user.

## Out of scope

- Offline data for every screen, and the sync engine (16).
- The status pill, blocked actions and the exercise image cache (17).
- An update prompt: updates are silent by decision.
- Push notifications.
- iOS startup images.

## UX

- **Today card:** under the gym nudge card, above the plan, as one compact row: the app icon, the title, the action, and the close button ("Закрити").
- **iOS guide:** a bottom sheet with the intro text and three numbered steps, each with an icon matching the Safari control (share square, plus square, "Додати"), and "Зрозуміло" to close. On desktop sizes it is a dialog.
- **Profile row:** in the app section of the Profile, next to the theme switch, with a chevron.
- **Offline fallback:** centered card, mobile and desktop.
- **States:**
  - no install path (Firefox desktop, already installed): no card, no row;
  - install prompt dismissed by the system dialog: the card stays until closed.

## Design

Canvas: https://claude.ai/artifact/C7N6MDYMjwdBPnA1AuVsAx. Every board has a `theme` tweak; `Main` also has a `platform` tweak (android, ios).

| Board | Screen and state |
| --- | --- |
| `Main` | Today, install card, Android (light) |
| `TodayIos` | Today, install card, iPhone (dark) |
| `IosGuide` | iPhone guide, bottom sheet over Today |
| `Profile` | Profile, install row (mobile) |
| `Offline` / `OfflineDark` | Offline fallback, mobile, light and dark |
| `ProfileDesktop` | Profile, install row in the two-column grid |
| `GuideDesktop` | Guide as a centered dialog (iPad and wide windows) |
| `OfflineDesktop` | Offline fallback, 1440 |

### Today install card

- **Placement:** one compact row in a `card` (radius 6), between the greeting and gym card on one side and "Сьогодні за планом" on the other. Padding 10px 2px 10px 12px, gap 12px, center aligned.
- **Content, left to right:**
  - the app icon, 40px: rounded 10px, `--logo-square` with the accent "P" as in `BrandMark`, and a soft shadow, so it reads as the home-screen icon;
  - the title "Встанови Pampojo" (16px, 800), which may wrap to two lines;
  - the primary button "Встановити" (Android) or "Як встановити" (iOS), height 44, 14px;
  - the ghost close button (40×44, `X` icon, `aria-label` "Закрити").
- No description line.
- Phones only (below `lg`).

### iPhone guide

- **Mobile:** a bottom sheet in `--card` with a top radius of 12px, a grabber, and a close button at the top right.
- **`lg` and up:** a centered 440px dialog with the same content.
- **Content:**
  - the title "Встанови Pampojo" (20px, 800);
  - the muted intro "Відкривається з головного екрана й працює в залі без інтернету.";
  - an `ol` of three steps, 14px gap;
  - the full-width primary "Зрозуміло".
- **Each step:**
  - an outline diamond (22px, 1.5px `--foreground` border) with the step number upright inside;
  - a 44px `--background` tile with the Safari glyph: share (box with an up arrow), add (plus in a rounded square), or the word "Додати";
  - the step text (16px, 600).

### Profile install row

- A full-width button styled as a profile row (`card`, radius 8, padding 12px 14px 12px 16px), placed after the "Тема" fieldset.
- **Content:** a 32px app icon tile, the label "Встановити застосунок" (16px, 700), and a muted chevron.
- On desktop it takes one column of the two-column grid.

### Offline fallback

- **No app shell.** The header has only the brand mark ("P" tile and the "pampojo" wordmark).
- **Card:** a centered `card`, max-width 440px, padding 32px 24px 24px, centered text.
  - **Mark:** a 40px dashed `--planned` outline diamond, the "not here yet" mark.
  - **Text:** the title "Немає з'єднання" (24px, 800) and the muted text, max 32ch.
  - **Actions:** a full-width primary "Спробувати ще раз" and a ghost link "На «Сьогодні»".
- The same layout on desktop. Light and dark come from the theme class.

### Left out

- An update prompt (silent updates by decision).
- The status pill and offline states inside the app (17).

## Data and API

- No database or API changes.
- **Device storage keys in `localStorage`:**
  - `pampojo:install-card-hidden-until` (ISO date);
  - `pampojo:storage-persist-requested` (`1`).

## Copy

| Key (en) | uk |
| --- | --- |
| No connection | Немає з'єднання |
| This page is not saved on this device yet. Open it online at least once. | Ця сторінка ще не збережена на пристрої. Відкрий її з інтернетом хоча б раз. |
| Try again | Спробувати ще раз (existing) |
| Go to Today | На «Сьогодні» |
| Install Pampojo | Встанови Pampojo |
| Opens from your home screen and works in the gym without internet. | Відкривається з головного екрана й працює в залі без інтернету. (iPhone guide intro; not on the card) |
| Install | Встановити |
| How to install | Як встановити |
| Install app | Встановити застосунок |
| Tap "Share" | Натисни «Поділитися» |
| Choose "Add to Home Screen" | Обери «На початковий екран» |
| Tap "Add" | Натисни «Додати» |
| Got it | Зрозуміло |
| Add (step 3 tile) | Додати |
| Close | Закрити (existing) |

`/design 15` may adjust the copy; changes go back into this table.

## Acceptance criteria

- [ ] AC1: Production build (e2e on `next start`):
  - `/manifest.webmanifest` returns the fields above, and every icon URL in it loads as PNG at its declared size;
  - after the first load, a service worker controls the page (`navigator.serviceWorker.controller` is set).
  - The review adds a screenshot of DevTools → Application → Manifest with no installability errors.
- [ ] AC2: After one online visit to `/today`, going offline and opening `/today` again shows the app shell, and opening a never-visited app page shows the offline fallback. Neither is the browser's offline page (e2e with `setOffline` on `next start`).
- [ ] AC3: After a new build is deployed, an open app keeps the old version and shows no prompt. The next launch (all windows closed, then opened) runs the new version (e2e: new service worker in `waiting`, no reload; manual check on preview).
- [ ] AC4: Install UI:
  - with a captured `beforeinstallprompt`, the Today card (phone width) and the Profile row call `prompt()`;
  - on iOS Safari emulation, they open the guide;
  - closing the card hides it for 7 days, and it reappears after that;
  - in standalone mode no install UI shows.
  - Component tests with mocked `matchMedia`, user agent and event.
- [ ] AC5: Logging out deletes the runtime page cache. After logout and a new login on the same device, offline navigation never serves the previous user's page (e2e).
- [ ] AC6: `navigator.storage.persist()` is called once, on the first standalone launch or the first session start, and never again (unit test with a mocked `navigator.storage`).
- [ ] AC7: Manual check by the lead on real devices from a Vercel preview, screenshots attached to the review. The checklist is in the scratch plan.
  - Android Chrome: install from the card, the icon, standalone, theme color, offline open of Today.
  - iPhone Safari: the guide, Add to Home Screen, the icon, standalone, offline open of Today.

## Depends on

05, 29.

## Open questions
