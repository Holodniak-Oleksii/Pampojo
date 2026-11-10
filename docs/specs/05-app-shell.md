# 05. App shell and navigation

## Goal

The frame every in-app screen lives in: navigation, top bar and a first Today screen. Later specs fill the sections; this one makes them reachable.

## User stories

- As a user, I want one tap to any main section, so that I don't hunt through menus in the gym.
- As a user, I want a big Start button, so that starting a workout is always the obvious action.
- As a user, I want to see whether I'm online, so that I know if my changes reach the server.
- As a user, I want to change the app language after I signed in.

## Scope

### Layout and guards

- `(app)/layout.tsx` renders the shell inside the existing session gate (spec 03 auth guard, spec 04 onboarding guard). Every `(app)` route gets the shell.
- New protected routes: `/calendar`, `/library`, `/library/*`, `/progress`. Add them to `isProtected` in `src/proxy.ts`; the server gate covers them as part of `(app)`.
- `/session/[id]` lives outside `(app)` (see `code-organization.md`) and has no navigation. Spec 10 creates it.

### Mobile bottom bar (< 1024px)

- `BottomNav`: charcoal bar, five slots: Calendar, Library, central Start, Progress, Profile.
- Icons only (lucide), no visible labels. Each link has an accessible name from the Copy table.
- Start is an accent rounded square, larger than the other slots, with the accessible name "Start workout".
- Active item: accent icon color plus `aria-current="page"`. A section is active on its route and its sub-routes (`/library/*` → Library, `/profile/*` → Profile). On `/today` no item is active.
- Fixed to the bottom, padded with `env(safe-area-inset-bottom)` for the iPhone home indicator. Page content gets bottom padding so nothing hides under the bar.
- Touch targets at least 44px.
- The bar sits inside a `<nav>` landmark with the name "Main navigation".

### Desktop sidebar (≥ 1024px)

- `SidebarNav`: fixed left column on the cream background. From top: wordmark (link to `/today`), a full-width "Start workout" primary button, then links with icon and label: Today, Calendar, Library, Progress, Profile.
- Same active rule and `aria-current` as the bottom bar; here Today is an item and is active on `/today`.
- The bottom bar is not rendered. Content area: max width 960px, centered in the space right of the sidebar, 24px gutter. Pages may be narrower inside it (for example `/profile` keeps 600px).

### Top bar

- Small bar on every `(app)` screen, mobile and desktop: page title (small, semibold, not the `h1`) on the left, `StatusPill` on the right.
- Mobile only: the app icon (P) left of the title, a link to `/today` with the accessible name "Pampojo, Today". On desktop the sidebar wordmark plays this role.
- Pages keep their own large `h1` in the content (`PageHeader`). The top bar title repeats the section name by design.
- Sticky at the top with the page background, padded with `env(safe-area-inset-top)`.

### Status pill

- `online` / `offline` from `navigator.onLine` and the `online` / `offline` window events only. Pending count arrives in spec 17, tap-to-open sync sheet in spec 17.
- Server render and first client render assume online; the real value applies after hydration.

### Start button and the Choose workout sheet

- Start (bottom bar and sidebar) opens the "Choose workout" sheet: bottom sheet on mobile, right side sheet on desktop (same `Sheet` pattern as Edit profile in spec 04).
- In this spec the sheet always shows the empty state: title, text and a "Create workout" button that closes the sheet and navigates to `/library/workouts`.
- The resume-session and planned-today branches are added by specs 10 and 11; the workout list by spec 09.

### Today (`/today`, first version)

- Replaces the spec 03/04 placeholder (the "Signed in as" text and the Profile link go away; the Profile nav item replaces the link).
- `h1` greeting with the user's `EmojiAvatar` next to it: "Good morning / afternoon / evening, {name}". The name is `profile.displayName`.
- The part of day uses the device clock: 05:00–11:59 morning, 12:00–17:59 afternoon, 18:00–04:59 evening. It is computed on the client after hydration; until then the greeting line shows a skeleton of the same height (no layout shift).
- Below it the empty state "No workouts yet" with a "Create your first workout" button → `/library/workouts`.
- Avatar and name render on the server from the profile.

### Placeholder sections

Each shows a `PageHeader` with the section title and an empty state (icon on an accent-soft tile, title, one line of text). No buttons.

- `/calendar` — calendar empty state.
- `/library` — redirects to `/library/workouts`.
- `/library/workouts` and `/library/exercises` — the shared Library header with tabs Workouts / Exercises. Tabs are links (not a client tab state), the current one has `aria-current="page"`. Each tab has its own empty state. Specs 06 and 09 replace the empty states.
- `/progress` — progress empty state.

### Profile changes

- `/profile` gets a "Language" row with the existing `LanguageSwitcher` (spec 01). It writes the `lang` cookie and reloads; nothing is stored in the database.
- The Profile page keeps its layout from spec 04 inside the shell.

## Out of scope

- Today's real data: planned workout card, week strip, adherence, last session (spec 12).
- Start resuming a session (spec 10) and starting today's planned workout (spec 11); the workout list in the sheet (spec 09).
- Pending-changes count and the sync sheet on the status pill, connectivity ping (spec 17).
- The session screen and its route (spec 10).
- Other settings on `/profile` (specs 08, 14, 17).
- Collapsible sidebar, a tablet-specific layout, dark theme (later).

## UX

- **Breakpoint**: below 1024px bottom bar, from 1024px sidebar. Only the navigation changes at the switch; top bar and content stay.
- **Loading**: the shell renders once the session gate resolves. Page content streams with its own skeletons (Today: avatar and greeting skeleton).
- **Offline**: navigation and all placeholder pages work offline once loaded. The Choose workout sheet works offline; its button only navigates.
- **Keyboard**: all nav items and Start are reachable with Tab in visual order, with a visible focus ring. The sheet traps focus, closes with Escape and returns focus to the Start button.
- **Reduced motion**: sheet and active-state transitions respect `prefers-reduced-motion`.

## Data and API

No schema or API changes. Today reads the profile with the existing server service (`getProfile`) like `/profile` does.

## Copy

| Where | en | uk |
| --- | --- | --- |
| Nav landmark | Main navigation | Головна навігація |
| Nav items | Today / Calendar / Library / Progress / Profile | Сьогодні / Календар / Бібліотека / Прогрес / Профіль |
| Start | Start workout | Почати тренування |
| Mobile icon link (accessible name) | Pampojo, Today | Pampojo, сьогодні |
| Top bar and page titles | Today / Calendar / Library / Progress / Profile | Сьогодні / Календар / Бібліотека / Прогрес / Профіль |
| Meta titles | Today · Pampojo / Calendar · Pampojo / Library · Pampojo / Progress · Pampojo | Сьогодні · Pampojo / Календар · Pampojo / Бібліотека · Pampojo / Прогрес · Pampojo |
| Greeting | Good morning, {{name}} / Good afternoon, {{name}} / Good evening, {{name}} | Доброго ранку, {{name}} / Доброго дня, {{name}} / Доброго вечора, {{name}} |
| Today empty | No workouts yet / Create your first workout to start training. / Create your first workout | Тренувань ще немає / Створи перше тренування, щоб почати. / Створити перше тренування |
| Sheet title | Choose workout | Обери тренування |
| Sheet empty | No workouts yet / Create a workout to start a session. / Create workout | Тренувань ще немає / Створи тренування, щоб почати сесію. / Створити тренування |
| Calendar empty | Nothing scheduled yet / Your planned and past workouts will show up here. | Поки нічого не заплановано / Тут з'являться заплановані та минулі тренування. |
| Library tabs | Workouts / Exercises | Тренування / Вправи |
| Library workouts empty | No workouts yet / Workout builder is coming soon. | Тренувань ще немає / Конструктор тренувань скоро з'явиться. |
| Library exercises empty | Exercise catalog is coming soon. | Каталог вправ скоро з'явиться. |
| Progress empty | No progress yet / Finish a workout to see your strength charts. | Прогресу ще немає / Заверши тренування, щоб побачити графіки сили. |
| Profile language row | Language | Мова |

The Library exercises empty state has only the title line.

## Acceptance criteria

- [ ] AC1: At 390px every `(app)` route (`/today`, `/calendar`, `/library/workouts`, `/library/exercises`, `/progress`, `/profile`) shows the bottom bar with five icon-only slots and the top bar; no sidebar.
- [ ] AC2: At 1440px the same routes show the sidebar (wordmark, Start workout, Today, Calendar, Library, Progress, Profile) and the top bar; no bottom bar. At 1023px the bottom bar shows, at 1024px the sidebar; nothing else in the layout changes between the two widths.
- [ ] AC3: Every nav item is a link with an accessible name from the Copy table inside a "Main navigation" landmark. The active section has `aria-current="page"`, including sub-routes (`/library/exercises` → Library). On mobile no item is active on `/today`; on desktop Today is. All items and Start are reachable by Tab with a visible focus ring.
- [ ] AC4: The mobile app icon and the desktop wordmark link to `/today`.
- [ ] AC5: The status pill shows Online, switches to Offline when the browser goes offline and back to Online when it reconnects.
- [ ] AC6: Start (bottom bar and sidebar) opens the Choose workout sheet (bottom on mobile, right side on desktop) with the empty state. Escape closes it and focus returns to Start. Create workout closes it and lands on `/library/workouts`.
- [ ] AC7: Today shows the user's emoji avatar and the greeting with their display name; the phrase follows the device clock (unit tested at 04:59, 05:00, 11:59, 12:00, 17:59, 18:00). The old "Signed in as" text and Profile link are gone. "Create your first workout" lands on `/library/workouts`.
- [ ] AC8: `/calendar`, `/library/workouts`, `/library/exercises` and `/progress` show their empty states with the Copy above. `/library` redirects to `/library/workouts`; the Library tabs are links with `aria-current` on the current one.
- [ ] AC9: Without a session, `/calendar`, `/library`, `/library/*` and `/progress` redirect to `/login?next=…`; a user who has not finished onboarding is sent to `/onboarding` from all of them.
- [ ] AC10: `/profile` has a Language row; switching the language reloads the page in the chosen language and keeps it after a new sign-in on the same browser.
- [ ] AC11: On an iPhone-sized viewport the bottom bar clears the home indicator (safe-area padding) and the last content on a page is not hidden behind the bar. No horizontal scroll at 390px and 1440px in `en` and `uk`.

## Depends on

04.

## Open questions
