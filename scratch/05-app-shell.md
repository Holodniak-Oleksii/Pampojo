# 05-app-shell — technical plan

Spec: `docs/specs/05-app-shell.md`

## 1. Summary

Build the in-app frame: a mobile bottom bar, a desktop sidebar, a top bar with the status pill, the Start button with an empty "Choose workout" sheet, a first Today screen, and placeholder pages for Calendar, Library and Progress. `/profile` gets a Language row.

- **No data or API changes.** Today reads the profile through the existing `getProfile` service.
- **Shell inside the gate.** `(app)/layout.tsx` keeps the session gate (spec 03/04) and wraps the shell inside it. While the gate resolves, a static shell skeleton shows instead of `null` (lead's choice 2026-11-10, see `DECISIONS.md`).
- **Routes:** `/calendar`, `/library` (redirect), `/library/workouts`, `/library/exercises`, `/progress` are new and protected.
- **No new dependencies.** lucide icons, shadcn `Sheet`, `Skeleton`, `Button` and the existing `StatusPill`, `PageHeader`, `EmojiAvatar`, `LanguageSwitcher`, `useIsOnline` are reused.

Existing code this builds on:

- `src/app/[lang]/(app)/layout.tsx`: `<Suspense fallback={null}><SessionGate>{children}</SessionGate></Suspense>`.
- `src/app/[lang]/(app)/session-gate.tsx`: no session → `/login?next=…` (path from `ORIGINAL_PATH_HEADER`); no profile → `/onboarding`.
- `src/proxy.ts`: `isProtected()` lists `/today`, `/onboarding`, `/profile`, `/profile/*`, `/session/*`; cookie-only redirect to `/login?next=…`. Rewrites `/x` → `/<lang>/x`.
- `src/hooks/useIsOnline.ts`: `useSyncExternalStore` on `online`/`offline` events, server snapshot `true`.
- `src/components/StatusPill`: `status: 'online' | 'offline'`, `pendingCount`, `role="status"`.
- `src/features/profile/EditProfileSheet/EditProfileSheet.tsx`: a private `useIsDesktop()` (`(min-width: 1024px)`, server snapshot `false`) and the `Sheet` pattern (`side={desktop ? 'right' : 'bottom'}`, `closeLabel={t('Close')}`, cream background, rounded top on mobile, 480px on desktop).
- `src/features/profile/ProfileView/ProfileView.tsx`: renders `PageHeader title="Profile"`, avatar, rows, Edit + Log out.
- `src/app/[lang]/(app)/profile/page.tsx` and `today/page.tsx` each render their own `<main className="mx-auto … max-w-[600px] px-4 py-10">`.
- `src/server/profile/service.ts`: `getProfile(userId)` returns `Profile` (`displayName`, `avatarEmoji`, `avatarColor`, …).
- `src/features/i18n/LanguageSwitcher`: dropdown, writes the `lang` cookie, reloads.
- `public/brand/pampojo-icon.svg`, `public/brand/pampojo-wordmark.svg`.
- `next.config.ts`: `cacheComponents: true`.

## 2. Acceptance criteria

- AC1: At 390px wide, `/today`, `/calendar`, `/library/workouts`, `/library/exercises`, `/progress` and `/profile` each show the bottom bar and the top bar, and no sidebar. The bottom bar has five slots in this order: Calendar, Library, Start, Progress, Profile. The slots show icons only, with no visible text.
- AC2: At 1440px the same routes show the sidebar and the top bar, and no bottom bar. The sidebar contains, top to bottom: the wordmark, a "Start workout" button, then links Today, Calendar, Library, Progress, Profile. At 1023px the bottom bar is visible and the sidebar is not. At 1024px it is the other way round. The top bar and the page `h1` have the same height and font size at both widths, and neither width scrolls horizontally.
- AC3: Each navigation (bottom bar, sidebar) is a `<nav>` named "Main navigation". Every item is an `<a>` with an accessible name: Today, Calendar, Library, Progress, Profile. Start is a `<button>` named "Start workout". The active section's link has `aria-current="page"`. Sub-routes count: `/library/workouts` and `/library/exercises` → Library, `/profile/*` → Profile. On `/today` no bottom-bar link is active, and the sidebar's Today link is. Tab moves through the nav items and Start in visual order, each with a visible focus ring.
- AC4: The mobile top-bar app icon (accessible name "Pampojo, Today") and the desktop sidebar wordmark both link to `/today`.
- AC5: The top-bar status pill reads "Online". When the browser goes offline it reads "Offline", and when it reconnects it reads "Online" again.
- AC6: Start, in the bottom bar or the sidebar, opens a dialog titled "Choose workout". It is a bottom sheet below 1024px and a right side sheet from 1024px. The dialog shows "No workouts yet", "Create a workout to start a session." and a "Create workout" button. Escape closes it and returns focus to the Start button that opened it. "Create workout" closes it and navigates to `/library/workouts`.
- AC7: `/today` shows the user's `EmojiAvatar` and an `h1` greeting "Good morning, {displayName}", "Good afternoon, {displayName}" or "Good evening, {displayName}", picked by the device's local hour: 05:00–11:59 morning, 12:00–17:59 afternoon, 18:00–04:59 evening. A unit test covers 04:59, 05:00, 11:59, 12:00, 17:59 and 18:00. Until hydration the greeting shows a skeleton of the same height. Below it is the empty state "No workouts yet" / "Create your first workout to start training." with a "Create your first workout" link to `/library/workouts`. The old "You're signed in", "Signed in as …" text and the Profile link are gone.
- AC8: `/calendar`, `/library/workouts`, `/library/exercises` and `/progress` show a `PageHeader` `h1` and their empty state with the copy in section 7. `/library` redirects to `/library/workouts`. Both Library pages show the "Library" `h1` and tabs Workouts / Exercises. The tabs are links, and the current one has `aria-current="page"`.
- AC9: Without a session, `/calendar`, `/library`, `/library/workouts`, `/library/exercises` and `/progress` redirect to `/login?next=<path>`. A signed-in user without a profile is sent to `/onboarding` from each of them.
- AC10: `/profile` has a "Language" row with the `LanguageSwitcher`. Picking Українська reloads `/profile` in Ukrainian ("Профіль"). After logging out and in again in the same browser, the app is still Ukrainian.
- AC11: At 390px, after scrolling to the bottom of any shell page, the bottom of the last element in `<main>` is at or above the top of the bottom bar. The `(app)` pages emit a viewport meta with `viewport-fit=cover`, so the `env(safe-area-inset-*)` padding works on iPhone. No horizontal scroll at 390px or 1440px, in `en` or `uk`.

## 3. Data

No changes. No migration, no schema, no Zod change.

## 4. API

No changes. Today reads the profile on the server with `getProfile(session.user.id)`. It makes no client request.

## 5. Server

- No new modules.
- `src/proxy.ts` `isProtected()`: add `/calendar`, `/library`, `/library/*` and `/progress`.
  - Keep the existing entries.
  - Add a small helper: a path is protected if it equals a prefix or starts with `prefix + '/'`.
  - Prefixes: `/today`, `/onboarding`, `/profile`, `/calendar`, `/library`, `/progress`, `/session`.
- User scoping:
  - `/today` calls `getRequestSession()` and then `getProfile(session.user.id)`, the same as `/profile`. No other reads.
  - The gate still enforces the session and the onboarding redirect for every `(app)` route, so the new routes inherit it.

## 6. Client

### Routes (under `src/app/[lang]/(app)/`)

| File | What |
| --- | --- |
| `layout.tsx` | `export const viewport: Viewport = { viewportFit: 'cover' }`. `<Suspense fallback={<AppShellSkeleton />}><SessionGate><AppShell>{children}</AppShell></SessionGate></Suspense>`. |
| `today/page.tsx` | Metadata `Today · Pampojo` (absolute). Wrapper `div` (`mx-auto w-full max-w-[600px] flex flex-col gap-6`). Inside it, `<Suspense fallback={<TodaySkeleton />}><TodayContent /></Suspense>`. `TodayContent` (async, same file) gets the session, calls `getProfile`, and renders `<TodayView displayName avatarEmoji avatarColor />`. |
| `calendar/page.tsx` | Metadata `Calendar · Pampojo`. `PageHeader title="Calendar"` + `EmptyState` (CalendarDays icon). |
| `progress/page.tsx` | Metadata `Progress · Pampojo`. `PageHeader title="Progress"` + `EmptyState` (TrendingUp icon). |
| `library/page.tsx` | `redirect('/library/workouts')` from `next/navigation`. |
| `library/layout.tsx` | `PageHeader title="Library"` + `<LibraryTabs />` + `children`, in a `flex flex-col gap-6` wrapper. |
| `library/workouts/page.tsx` | Metadata `Library · Pampojo`. `EmptyState` (ListChecks icon) with title and text. |
| `library/exercises/page.tsx` | Metadata `Library · Pampojo`. `EmptyState` (Dumbbell icon) with the title only. |
| `profile/page.tsx` | Replace its `<main>` with a `div` that keeps `mx-auto w-full max-w-[600px] flex flex-col gap-6`. The shell owns `<main>` and the gutters. |

Pages never render `<main>`; `AppShell` does. Remove `py-10` from the page wrappers: the shell sets the vertical padding.

### Shared hook (promoted)

- `src/hooks/useIsDesktop.ts`: move `useIsDesktop` and `DESKTOP_QUERY` out of `EditProfileSheet.tsx` unchanged, and import it there. Now two unrelated features need it.

### Generic components

- `src/components/EmptyState/` (`EmptyState.tsx`, `index.ts`, `__tests__/EmptyState.test.tsx`).
  - Props: `icon: LucideIcon`, `title: string`, `description?: string`, `action?: ReactNode`, `className?`.
  - Markup: a centered column inside a `bg-card rounded-[32px] shadow-soft p-8` card.
  - The icon sits on a 56px `bg-accent-soft rounded-2xl` tile with `aria-hidden`. Then the title as `h2` (`text-xl font-extrabold`), the description (`text-muted-foreground`) and the action below.

### Feature `src/features/app-shell/`

```text
features/app-shell/
├── AppShell/            AppShell.tsx, index.ts, __tests__/AppShell.test.tsx
├── AppShellSkeleton/    AppShellSkeleton.tsx, index.ts
├── BottomNav/           BottomNav.tsx, index.ts
├── SidebarNav/          SidebarNav.tsx, index.ts
├── TopBar/              TopBar.tsx, index.ts
├── StartWorkoutSheet/   StartWorkoutSheet.tsx, index.ts
├── constants.ts         SECTION, NAV_ITEMS
├── useSectionLabels.ts
├── utils.ts             sectionFromPathname
└── __tests__/utils.test.ts
```

Only `AppShell` and `AppShellSkeleton` are exported from the feature (each folder's `index.ts`). The others are internal and tested through `AppShell`.

**`constants.ts`**

```ts
export const SECTION = {
  TODAY: 'today', CALENDAR: 'calendar', LIBRARY: 'library', PROGRESS: 'progress', PROFILE: 'profile',
} as const;
export type Section = (typeof SECTION)[keyof typeof SECTION];
// href and lucide icon per section: Today House, Calendar CalendarDays, Library LibraryBig,
// Progress TrendingUp, Profile CircleUser. Start uses Play.
export const NAV_ITEMS: readonly { section: Section; href: string; icon: LucideIcon }[];
```

The bottom bar uses `NAV_ITEMS` without Today, with Start inserted after Library. The sidebar uses all five.

**`utils.ts`**: `sectionFromPathname(pathname: string): Section | null`.

- Strip a leading locale segment (`/en`, `/uk`) first, because the hidden `[lang]` rewrite can leak into `usePathname` during server render.
- Then match the first segment against the section names. Unknown paths return `null`.

**`useSectionLabels.ts`**: returns `Record<Section, string>` built with literal `t()` calls (`t('Today')`, `t('Calendar')`, …), memoized on `t`. It is used for nav names and top bar titles.

**`AppShell`** (`'use client'`)

- State: `startOpen` (`useState`) and a ref to the Start button that opened the sheet (`openerRef`).
- `openStart(event)` stores `event.currentTarget` in `openerRef` and opens the sheet.
- `pathname` comes from `usePathname()`; `section = sectionFromPathname(pathname)`.
- Layout:

  ```tsx
  <div className="flex min-h-dvh">
    <SidebarNav section={section} onStart={openStart} />  {/* hidden below lg */}
    <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
      <TopBar section={section} />
      <main className="mx-auto w-full max-w-[960px] flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-6 lg:pt-6 lg:pb-12">
        {children}
      </main>
    </div>
    <BottomNav section={section} onStart={openStart} />  {/* hidden from lg */}
    <StartWorkoutSheet open={startOpen} onOpenChange={setStartOpen} returnFocusRef={openerRef} />
  </div>
  ```

- Both navs are always rendered, and CSS shows one (`lg:hidden` / `hidden lg:flex`). This avoids a hydration mismatch and a jump. `display: none` removes the hidden one from the accessibility tree.

**`BottomNav`**

- `<nav aria-label={t('Main navigation')}>`, `fixed inset-x-0 bottom-0 z-40 lg:hidden`, `bg-primary text-primary-foreground`, `pb-[env(safe-area-inset-bottom)]`, rounded top corners `rounded-t-[28px]`.
- Inner row: `h-16`, five equal slots, items centered.
- A link slot is a `next/link` with a 48×48 hit area, a 24px icon and `aria-label={labels[section]}`. `aria-current="page"` and `text-accent` when active, `text-primary-foreground/70` otherwise. There is no visible text.
- The Start slot is a `<button type="button" aria-label={t('Start workout')}>`, a 56×56 `bg-accent text-foreground rounded-2xl` with the Play icon and `onClick={onStart}`.
- Focus ring: `focus-visible:ring-2 ring-accent ring-offset-2 ring-offset-primary`.
- Today is not in the bar, so nothing is active on `/today`.

**`SidebarNav`**

- `<aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 px-4 py-6 lg:flex">` on `bg-background`.
- Top: a `next/link` to `/today` wrapping the wordmark image (`/brand/pampojo-wordmark.svg`, `alt=""`, `h-8 w-auto`), with `aria-label={t('Pampojo, Today')}`.
- `Button size="lg" className="w-full"` with the Play icon and `t('Start workout')`, `onClick={onStart}`.
- `<nav aria-label={t('Main navigation')}>` with a list of all five `NAV_ITEMS`.
  - Each item is a pill link: icon + visible label, at least 44px tall.
  - Active: `aria-current="page"`, `bg-accent-soft font-semibold`.

**`TopBar`**

- `<header className="sticky top-0 z-20 bg-background pt-[env(safe-area-inset-top)]">`, inner row `h-14 px-4 lg:px-6` (same height at every width, see AC2), `max-w-[960px] mx-auto`, `flex items-center gap-3`.
- Mobile only (`lg:hidden`): a `next/link` to `/today` with `aria-label={t('Pampojo, Today')}`, holding `/brand/pampojo-icon.svg` at 32px in a 44px hit area.
- Title: `<p className="text-base font-semibold">` with `labels[section]`, or empty when `section` is `null`. It is not a heading, because the page owns the `h1`.
- Right: `<StatusPill status={useIsOnline() ? 'online' : 'offline'} className="ml-auto" />`.

**`StartWorkoutSheet`**

- Props: `open`, `onOpenChange`, `returnFocusRef: RefObject<HTMLElement | null>`.
- `Sheet` / `SheetContent` with `side={useIsDesktop() ? 'right' : 'bottom'}`, `closeLabel={t('Close')}` and `aria-describedby={undefined}`. Use the same classes as `EditProfileSheet` (cream background, `rounded-t-[32px]` on mobile, full height and 480px max width on desktop, bottom padding `max(1rem, env(safe-area-inset-bottom))`).
- `onCloseAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus(); }}`, because the sheet opens without a `SheetTrigger`.
- Header: `SheetTitle` with `t('Choose workout')` (`text-2xl font-extrabold`).
- Body: `EmptyState` (ListChecks icon) with title `t('No workouts yet')`, description `t('Create a workout to start a session.')`, and as the action a `Button asChild` wrapping `<Link href="/library/workouts" onClick={() => onOpenChange(false)}>` with `t('Create workout')`.
- Offline: no special case; the link only navigates.
- Specs 09–11 later replace the body with the list and add the resume and planned-today branches.

**`AppShellSkeleton`** (server-safe, no hooks)

- The same outer structure and sizes as `AppShell`, with `aria-hidden` and no links.
  - A charcoal bottom bar (`lg:hidden`) with five `Skeleton` circles.
  - A sidebar column (`hidden lg:flex`) with a wordmark-size skeleton, a pill skeleton and five line skeletons.
  - A top bar row with a title skeleton and a pill-shaped skeleton.
  - In `<main>` (the same classes), an `h-10 w-40` heading skeleton and two `h-32 rounded-[32px]` card skeletons.
- The skeleton keeps the same geometry, so swapping it for the shell causes no layout jump.

### Feature `src/features/today/`

```text
features/today/
├── TodayView/       TodayView.tsx, index.ts, __tests__/TodayView.test.tsx
├── TodaySkeleton/   TodaySkeleton.tsx, index.ts
├── usePartOfDay.ts
├── utils.ts         partOfDay(date: Date): PartOfDay
└── __tests__/utils.test.ts
```

- `utils.ts`: `PART_OF_DAY = { MORNING, AFTERNOON, EVENING }`. `partOfDay(date)` reads `date.getHours()`: 5–11 → morning, 12–17 → afternoon, otherwise evening.
- `usePartOfDay()`: `useSyncExternalStore(noopSubscribe, () => partOfDay(new Date()), () => null)`. The snapshot is a string constant, so it is stable between calls. It returns `null` on the server and during hydration.
- `TodayView` (`'use client'`). Props: `displayName`, `avatarEmoji`, `avatarColor`.
  - A row: `EmojiAvatar size="lg"` + `<h1 className="text-3xl font-extrabold md:text-4xl break-words">`.
  - Inside the `h1`: a greeting picked by a map with literal `t()` calls (`t('Good morning, {{name}}', { name })`, …). While `usePartOfDay()` is `null`, it holds a `Skeleton` with `h-9 md:h-10 w-56`, `aria-hidden`, so the line keeps its height.
  - Then `EmptyState` (ListChecks icon) with title `t('No workouts yet')`, description `t('Create your first workout to start training.')`, and as the action `Button asChild` → `<Link href="/library/workouts">` with `t('Create your first workout')`.
- `TodaySkeleton`: an avatar circle + a heading-line skeleton, and an `h-48 rounded-[32px]` card skeleton.

### Feature `src/features/library/`

- `LibraryTabs/` (`LibraryTabs.tsx`, `index.ts`, `__tests__/LibraryTabs.test.tsx`), `'use client'`.
- `<nav aria-label={t('Library')}>` with two pill links in a `bg-card rounded-full p-1 shadow-soft` track: Workouts → `/library/workouts`, Exercises → `/library/exercises`.
- Active tab: the last segment of `usePathname()` (`workouts` or `exercises`), which is the same with or without a locale prefix. Active: `aria-current="page"` and `bg-primary text-primary-foreground`. Each tab is at least 44px tall.

### Profile change

- `ProfileView`: after the `dl` rows, add one more row card (same classes as the rows).
  - It holds `<span className="text-muted-foreground">{t('Language')}</span>` and `<LanguageSwitcher />` on the right.
  - It is a `div`, not a `dt/dd` pair, because it is a control, not a value.
- Nothing else changes in `/profile`.

### Old placeholder

- `today/page.tsx` is rewritten. Remove `SignedInSummary`, the "You're signed in" header and the Profile link.
- Run `pnpm i18n:extract` so the unused keys `You're signed in` and `Signed in as {{email}}` drop out of both catalogs. Check that no other code uses them first.

### States

- **Loading:** `AppShellSkeleton` while the gate resolves. Inside the shell, `TodaySkeleton` and the existing `ProfileSkeleton` cover page data. Calendar, Library and Progress are static and need no skeleton.
- **Offline:** the pill switches. All shell pages render from what is loaded; no request is blocked, because none is made.
- **Reduced motion:** `Sheet` already uses `tw-animate-css` classes. Add `motion-reduce:transition-none` on nav item color transitions. Check that the sheet's `data-[state]` animations are disabled under `motion-reduce` in `sheet.tsx`. If they are not, pass `motion-reduce:animate-none` through `className` on `SheetContent` (do not edit the generated file).

### Layout checks

- 390px: 16px gutter, bar `h-16` + safe area. `main` bottom padding `5rem + safe area` (64px bar + 16px).
- 1440px: 256px sidebar + content centered in the rest, max 960px. `/profile` and `/today` stay 600px inside it.
- 1023 → 1024px: only the nav and the content's left offset change. The top bar is `h-14` at every width, and the `PageHeader` `h1` switches size at `md:`, not `lg:`, so both stay the same across the breakpoint.

## 7. Copy

New keys (key = English source). Existing keys reused: `Profile`, `Close`, `Language`.

| Key (en) | uk |
| --- | --- |
| Main navigation | Головна навігація |
| Today | Сьогодні |
| Calendar | Календар |
| Library | Бібліотека |
| Progress | Прогрес |
| Start workout | Почати тренування |
| Pampojo, Today | Pampojo, сьогодні |
| Today · Pampojo | Сьогодні · Pampojo |
| Calendar · Pampojo | Календар · Pampojo |
| Library · Pampojo | Бібліотека · Pampojo |
| Progress · Pampojo | Прогрес · Pampojo |
| Good morning, {{name}} | Доброго ранку, {{name}} |
| Good afternoon, {{name}} | Доброго дня, {{name}} |
| Good evening, {{name}} | Доброго вечора, {{name}} |
| No workouts yet | Тренувань ще немає |
| Create your first workout to start training. | Створи перше тренування, щоб почати. |
| Create your first workout | Створити перше тренування |
| Choose workout | Обери тренування |
| Create a workout to start a session. | Створи тренування, щоб почати сесію. |
| Create workout | Створити тренування |
| Nothing scheduled yet | Поки нічого не заплановано |
| Your planned and past workouts will show up here. | Тут з'являться заплановані та минулі тренування. |
| Workouts | Тренування |
| Exercises | Вправи |
| Workout builder is coming soon. | Конструктор тренувань скоро з'явиться. |
| Exercise catalog is coming soon. | Каталог вправ скоро з'явиться. |
| No progress yet | Прогресу ще немає |
| Finish a workout to see your strength charts. | Заверши тренування, щоб побачити графіки сили. |

Where they appear:

- Library workouts empty state: "No workouts yet" + "Workout builder is coming soon."
- Library exercises: "Exercise catalog is coming soon." only.
- Calendar: "Nothing scheduled yet" + "Your planned and past workouts will show up here."
- Progress: "No progress yet" + "Finish a workout to see your strength charts."
- `Workouts` and `Тренування` collide with nothing existing. If the extractor reports `Workouts` as already present, reuse it.

Removed keys: `You're signed in`, `Signed in as {{email}}`.

## 8. Steps

1. **Hook promotion.** Create `src/hooks/useIsDesktop.ts` and import it in `EditProfileSheet.tsx`, deleting the private copy. Typecheck.
2. **EmptyState.** `src/components/EmptyState/*` + test.
3. **App-shell utilities.** `src/features/app-shell/constants.ts`, `utils.ts`, `useSectionLabels.ts`, `__tests__/utils.test.ts`.
4. **Nav pieces.** `BottomNav`, `SidebarNav`, `TopBar`, `StartWorkoutSheet` in `src/features/app-shell/`.
5. **AppShell + skeleton.** `AppShell/*`, `AppShellSkeleton/*`, `AppShell/__tests__/AppShell.test.tsx`.
6. **Layout.** Update `src/app/[lang]/(app)/layout.tsx` (viewport export, skeleton fallback, `AppShell`). Change `profile/page.tsx` `<main>` → `div`.
7. **Today.** `src/features/today/*` + tests. Rewrite `src/app/[lang]/(app)/today/page.tsx`.
8. **Placeholders.** `calendar/page.tsx`, `progress/page.tsx`, `library/page.tsx`, `library/layout.tsx`, `library/workouts/page.tsx`, `library/exercises/page.tsx`. Add `src/features/library/LibraryTabs/*` + test.
9. **Profile language row.** `ProfileView.tsx` + a test case in `ProfileView.test.tsx`.
10. **Proxy.** Extend `isProtected()` in `src/proxy.ts`.
11. **Catalogs.** `pnpm i18n:extract`, fill `uk.json` from section 7, `pnpm i18n:check`.
12. **Old e2e.**
    - `e2e/03-auth.spec.ts`:
      - "sign up lands on /today and / redirects there": its `signUp` helper finishes onboarding through the API and opens `/today`. Replace `getByText(`Signed in as ${email}`)` with `getByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), John Smith$/ })`.
      - The copy test: `today` becomes a regex, `en` `/^Good (morning|afternoon|evening), /` and `uk` `/^Доброго (ранку|дня|вечора), /`, passed as the heading `name`.
    - `e2e/04-onboarding-profile.spec.ts`:
      - Replace "the /today placeholder links to the profile and has no log out" with "Profile is reachable from the navigation and /today has no log out" (`getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile' })`).
      - Check that `smallTargets` (scoped to `main`) still passes with the new content.
13. **New e2e.** `e2e/05-app-shell.spec.ts` (section 9). Use its own prefix `e2eRunPrefix('shell')` and IP range `198.18.0.x`, following the 04 pattern.
14. **Checks.** `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check`, the touched unit tests, then `pnpm test:e2e e2e/03-auth.spec.ts e2e/04-onboarding-profile.spec.ts e2e/05-app-shell.spec.ts`.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | e2e `e2e/05-app-shell.spec.ts` "mobile shows the bottom bar on every shell route" (mobile project): for each route, the "Main navigation" nav is visible, holds 4 links + the Start button in order, the links have no visible text (`innerText` empty), and the sidebar `aside` is hidden. |
| AC2 | e2e "desktop shows the sidebar" (desktop project): the sidebar order of items, no visible bottom bar. "the breakpoint switches only the navigation": `page.setViewportSize` 1023 then 1024 on `/calendar`. Bar vs sidebar visibility flips. The top bar `header` height and the `h1` bounding-box height are equal at both widths. No overflow. |
| AC3 | `AppShell.test.tsx` (mock `next/navigation` `usePathname`): `/library/exercises` → the Library link has `aria-current="page"` in both navs and no other link does. `/today` → the sidebar Today link is current and no bottom-bar link is. `/profile` → Profile. The links' accessible names come from `useSectionLabels`. e2e "keyboard reaches the navigation": Tab order in the sidebar (wordmark, Start workout, Today … Profile) checked with `toBeFocused()`. |
| AC4 | e2e: the mobile `getByRole('link', { name: 'Pampojo, Today' })` goes from `/calendar` to `/today`; the desktop wordmark link does the same. |
| AC5 | `AppShell.test.tsx`: dispatch `offline` / `online` window events with `navigator.onLine` stubbed (`vi.spyOn(navigator, 'onLine', 'get')`), and the `status` role reads Offline / Online. e2e: `context.setOffline(true/false)` on `/today` toggles the pill text. |
| AC6 | `AppShell.test.tsx`: clicking Start opens the dialog "Choose workout" with the empty copy. Escape closes it and Start `toBeFocused()`. "Create workout" is a link to `/library/workouts`, and clicking it closes the dialog. e2e (both projects): click Start, check the dialog's side (its bounding box touches the bottom edge on mobile and the right edge on desktop), click "Create workout", URL `/library/workouts`. |
| AC7 | `src/features/today/__tests__/utils.test.ts`: `partOfDay` at 04:59 → evening, 05:00 → morning, 11:59 → morning, 12:00 → afternoon, 17:59 → afternoon, 18:00 → evening (local `new Date(2026, 0, 1, h, m)`). `TodayView.test.tsx`: renders the avatar and `h1` "Good morning, John Smith" with `vi.setSystemTime` at 09:00 (fake timers `toFake: ['Date']`). Also the empty state link `/library/workouts`, and `uk` "Доброго вечора, John Smith" at 20:00. e2e: `/today` has the greeting `h1` and no "Signed in as" text. |
| AC8 | `EmptyState.test.tsx`: renders the title as `h2`, the optional description and the action. `LibraryTabs.test.tsx`: `aria-current` on the matching tab for each path. e2e "placeholder sections": each route's `h1` and empty-state copy; `/library` ends on `/library/workouts`; clicking Exercises sets `aria-current` on it. |
| AC9 | e2e "new routes are protected": a fresh context without a cookie, each route → URL `/login?next=<encoded path>`. A signed-up user without onboarding → `/onboarding` for each. |
| AC10 | `ProfileView.test.tsx`: "shows a Language row with the switcher" (a button named `Language: English`). e2e "language switch on /profile persists": open the switcher, pick Українська, `h1` "Профіль". Log out, log in, `/profile` `h1` "Профіль". |
| AC11 | e2e (mobile): on `/profile` (the longest page), scroll to the bottom; the last child of `main`'s bounding-box bottom ≤ the bottom nav's top. `meta[name="viewport"]` content contains `viewport-fit=cover`. Overflow check on all shell routes in `en-US` and `uk-UA`. iPhone home-indicator clearance is checked by eye in `/review` (Chromium reports `env()` insets as 0). |

## 10. Risks and open questions

- **`usePathname` and the hidden `[lang]` rewrite.** On the server, `usePathname` may return `/en/today` instead of `/today`. `sectionFromPathname` strips a locale prefix, which is unit tested. `LibraryTabs` compares only the last segment. If hydration warnings still appear, render the active state from `useSelectedLayoutSegment` instead and note it.
- **`viewport` export in a route group layout.** Next merges `viewport` from nested layouts. If `viewportFit` does not reach the output under `(app)`, move it to the root layout and confirm with the lead (it would affect landing and auth). Check the emitted meta in the e2e test.
- **Cache Components.** `AppShell` is a client component under the gate's `Suspense`, so the gate stays dynamic and the skeleton is the static part. `library/page.tsx` calls only `redirect()`, which is allowed in a static page. If the build complains about `usePathname` without `Suspense`, the shell is already inside one.
- **Two `nav` landmarks with one name.** Only one is displayed at a time (`display: none` on the other), so assistive tech sees one "Main navigation".
- **Focus return.** Radix returns focus to the trigger by default, but there is none here. `onCloseAutoFocus` + `returnFocusRef` handles it. When "Create workout" navigates, the focus moves with the new page.
- **Later specs:**
  - 09 replaces the Library workouts empty state and the sheet body.
  - 10 adds resume in Start and the `/session/[id]` route outside `(app)`.
  - 11 adds start-planned-today.
  - 12 fills Today.
  - 13 fills Progress.
  - 06 fills Exercises.
  - 17 adds the pending count, the sync sheet on the pill and the connectivity ping.
- No open questions block implementation.

## 11. Implementation notes
- **Component tests and CSS.** Vitest browser mode loads no CSS, so `lg:hidden` / `hidden lg:flex` have no effect there, and both navigations are in the DOM. `AppShell.test.tsx` finds the sidebar through the `complementary` landmark and the bottom bar as the last "Main navigation". Which nav is visible at which width is checked only in e2e.
- **Lint rule `testing-library/prefer-screen-queries`.** It rejects queries on stored locators (`nav.getByRole`), so the tests chain from `screen` inline (`screen.getByRole('navigation', MAIN_NAV).last().getByRole(…)`). `EmptyState.test.tsx` uses `next/link` instead of `<a>` (`no-html-link-for-pages`).
- **Proxy.** `isProtected()` is now a prefix list. `/session` itself (without a sub-path) is protected too; before, only `/session/*` was.
- **e2e adjustments.**
  - The keyboard test starts by focusing the sidebar wordmark: in `pnpm dev` the Next.js dev indicator takes the first Tab stop.
  - The sheet-side check polls the dialog's edge until the slide-in animation settles (the first read was 1488px wide and 882px tall).
  - `e2e/04` "a new user completes onboarding…": `getByText('John Smith')` also matched the Today greeting and the route announcer after the client navigation to `/profile`; now `getByRole('main').getByText('John Smith', { exact: true })`.
  - `e2e/04` placeholder test renamed to "Profile is reachable from the navigation and /today has no log out".
  - `e2e/03` greeting assertions use regexes, because the part of day depends on the clock.
- **Checks:**
  - lint, typecheck, format:check, i18n:check: pass.
  - `pnpm test`: 40 files, 240 tests passed.
  - `pnpm build`: pass; the new routes prerender as partial (◐) per locale.
  - e2e on the lead's running dev server: `03`, `04`, `05` — 61 passed, 5 skipped (viewport-specific tests in 05). `00`–`02`: 41 passed, 2 skipped, 1 failed once (`02` "renders the legal placeholders", mobile); it passed 3 of 3 reruns and touches no code from this spec.
  - Not run against the production server (`pnpm start`), because the lead's dev server holds port 3000.
- **Not checked automatically:** the iPhone home-indicator clearance (Chromium reports `env()` insets as 0) and the look of `AppShellSkeleton`. Both are for `/review`.
- **Review fixes.**
  - `AppShellSkeleton` has a 44px top-bar icon slot on mobile, so the title no longer shifts when the shell replaces it (finding 1).
  - `/today` and `/profile` keep 600px but are left-aligned in the 960px column instead of centered, so on desktop the top-bar title lines up with the page `h1` (finding 2).

## 12. Review — 2026-11-10

**Verdict:** Pass with notes. Every AC works at 390px and 1440px in `en` and `uk`. Two small visual notes (findings 1–2) and one process note (3).

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | e2e "mobile shows the bottom bar on every shell route"; `AppShell.test.tsx` "bottom bar: four icon-only section links…"; `AC8-mobile-*.png`, `AC7-mobile-today.png` |
| AC2 | Pass | e2e "desktop shows the sidebar…", "the breakpoint switches only the navigation"; `AC2-1023-calendar.png` (bottom bar), `AC2-1024-calendar.png` (sidebar); `AC*-desktop-*.png` |
| AC3 | Pass | `AppShell.test.tsx` (`aria-current` on sub-routes, none on `/today` in the bar, Today in the sidebar); e2e "keyboard reaches the sidebar in visual order with a focus ring"; `AC3-mobile-focus-ring.png`, `AC3-desktop-focus-ring.png`; walk: current items per route matched (`/library/*` → Library + the tab) |
| AC4 | Pass | e2e "the app icon or wordmark leads to Today"; `AppShell.test.tsx` (both links → `/today`) |
| AC5 | Pass | e2e "the status pill follows the connection"; `AppShell.test.tsx` online/offline events; `AC5-mobile-offline.png`, `AC5-desktop-offline.png` |
| AC6 | Pass | e2e "Start opens the Choose workout sheet" (side, Escape → focus on Start, Create workout → `/library/workouts`); `AC6-mobile-sheet.png` (bottom), `AC6-desktop-sheet.png` (right), `AC6-*-uk-sheet.png`; walk: focus after Escape = "Start workout" at both widths |
| AC7 | Pass | `src/features/today/__tests__/utils.test.ts` (04:59 … 18:00); `TodayView.test.tsx` (morning, afternoon, uk evening, link); e2e "Today greets the user…"; `AC7-*-today.png`, `AC11-*-uk-today.png` ("Доброго дня, John Smith") |
| AC8 | Pass | e2e "placeholder sections show their empty states" (incl. `/library` → `/library/workouts`, tabs); `LibraryTabs.test.tsx`; `EmptyState.test.tsx`; `AC8-*-calendar.png`, `AC8-*-library-workouts.png`, `AC8-*-library-exercises.png`, `AC8-*-progress.png`; walk: meta titles `Calendar · Pampojo`, `Library · Pampojo`, `Progress · Pampojo` |
| AC9 | Pass | e2e "new routes are protected" (no session → `/login?next=<route>`; no onboarding → `/onboarding`); `src/proxy.ts:9-23` |
| AC10 | Pass | `ProfileView.test.tsx` "shows a Language row with the switcher"; e2e "the language switch on /profile persists after a new sign-in"; `AC10-*-profile.png`, `AC11-mobile-uk-profile.png` |
| AC11 | Pass with note | e2e "content clears the bottom bar…" (gap ≥ 0, `viewport-fit=cover`), "no horizontal scroll" in `en-US` and `uk-UA`; walk: overflow 0 on every route, `/profile` last element 100px above the bar (`AC11-mobile-profile-bottom.png`). The iPhone home indicator itself is not testable in Chromium (`env()` insets are 0); the padding is in place (`BottomNav.tsx`, `AppShell.tsx` `main`). |

Screenshots: `scratch/review/05-app-shell/` (git-ignored). `Loading-*-skeleton.png` shows the gate fallback.

### Findings

1. [minor] The mobile shell skeleton has no slot for the top-bar app icon: `src/features/app-shell/AppShellSkeleton/AppShellSkeleton.tsx:21`.
   - The real top bar starts with a 44px icon link, so the title moves about 50px to the right when the shell replaces the skeleton (`Loading-mobile-skeleton.png` vs `AC7-mobile-today.png`).
   - The plan asks for the same geometry and no layout jump. Fix: a `size-8 rounded-xl lg:hidden` skeleton in a 44px box before the title.
2. [minor] On desktop the top-bar title does not line up with narrow pages: `src/features/app-shell/TopBar/TopBar.tsx:22`.
   - The top bar spans the 960px column, while `/today` and `/profile` are 600px and centered inside it, so "Profile" sits about 150px left of the page `h1` (`AC10-desktop-profile.png`, `AC7-desktop-today.png`). Calendar, Library and Progress use the full 960px and line up.
   - Not an AC failure. Options: let 600px pages fill 960px, or accept the offset. The lead's call.
3. [minor, process] Spec 05 is uncommitted on `feat/04-onboarding-profile`, together with the drill changes to `DECISIONS.md`, `SCREENS.md` and the spec. Put it on its own branch (`feat/05-app-shell`) before committing, so spec 04's PR stays clean.

Code checks:

- No data, API or migration changes. `/today` reads the profile with `getProfile(session.user.id)` only (`src/app/[lang]/(app)/today/page.tsx:14-25`), so it is scoped to the session user. No writes, so nothing is affected by `request-safety.md`.
- Code organization matches the guide: `features/app-shell`, `features/today`, `features/library`, a generic `components/EmptyState`, and `useIsDesktop` promoted to `src/hooks/` because two features use it. Route files stay thin. No `as` casts; `isSection` is a type guard.
- Comments are short and explain why (CSS-less tests, the hidden `[lang]` segment, focus return, `viewport-fit`).
- Every deviation from the plan is listed in Implementation notes.
- The diff has no secrets, `.env*` files or build output.

### Checks

- lint: pass.
- typecheck: pass.
- tests: `pnpm test` 40 files, 240 tests passed.
- e2e: `e2e/03-auth.spec.ts`, `e2e/04-onboarding-profile.spec.ts`, `e2e/05-app-shell.spec.ts` on the lead's dev server: 61 passed, 5 skipped (viewport-specific tests). Earlier during implementation, `00`–`02` passed except one flaky run of `02` "renders the legal placeholders", which passed 3 of 3 reruns.
- build: `pnpm build` passed during implementation (new routes are partial prerender).
- UI walk:
  - A Playwright script at 390×844 and 1440×900, `en` and `uk`.
  - States: loading skeleton, Today, all placeholders, the sheet open and closed with Escape, focus rings, offline pill, the 1023/1024 breakpoint, `/profile` scrolled to the bottom.
  - It ran against the lead's running dev server (port 3000) instead of a new `pnpm dev`.
  - Test users `e2e-review05-*` and the `203.0.113.*` rate-limit rows were deleted afterwards.

### Out of scope

- In `pnpm dev`, the Next.js dev indicator (bottom-left "N") covers the first bottom-bar slot (Calendar) on phones. Production builds do not show it.
- The Start sheet's "Create workout" leads to a page that says the builder is coming soon. That is expected until spec 09.
