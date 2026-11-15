# 29-dark-theme — technical plan

Spec: `docs/specs/29-dark-theme.md`

## 1. Summary

The whole product gets a dark theme, driven by one device setting: `system` (default), `light` or `dark`.

- **Setting:** stored in `localStorage` under `pampojo:theme`.
- **Applying it:** a class on `<html>` (`dark` or `light`). An inline script in `<head>` sets the class before the first paint, and a small client store keeps it in sync with:
  - the switch;
  - the system theme (`matchMedia`);
  - other tabs (the `storage` event).
- **Tokens:** every colour already comes from a CSS token. The work is:
  - a `.dark` token block in `globals.css`;
  - a few new tokens where the light theme used "charcoal" tokens as a surface: the nav, the landing band, text on the accent, the session bar;
  - dark variants of the brand SVGs.
- **Session:** the spec 10 `.session-theme` rule is removed. The session follows the app theme.
- **New UI:** a `ThemeSwitch` component, as a labelled segmented row in the Profile and as icon-only buttons in the landing footer.

No server, data or dependency changes.

## 2. Acceptance criteria

- **AC1:**
  - With no stored value, `prefers-color-scheme: dark` gives `<html class="dark">` and the dark tokens on the landing, `/login`, `/signup`, `/onboarding` and every app route, the session included.
  - `light` gives the light tokens.
  - Changing the system theme while a page is open switches the theme without a reload.
- **AC2:**
  - The Profile has a "Тема" row (after "Мова") with "Як у системі", "Світла" and "Темна".
  - Picking one stores it, applies it at once and overrides the system.
  - It survives a reload and a log out.
  - The landing footer switch then shows the same value as selected.
- **AC3:** The landing footer switch (icon-only, the same three values) writes the same stored value with the same effect.
- **AC4:** The theme class is on `<html>` before React hydrates. A page whose JS chunks are blocked still has `class="dark"` when the stored value is `dark`.
- **AC5:**
  - The session screen, its sheets, menus and dialogs, and the summary follow the app theme.
  - With `light` stored and the system dark, `/session/[id]` has a light background (`rgb(236, 233, 228)`).
- **AC6:** A unit test reads both token sets from `globals.css` and checks that every text/background pair in the table (section 6) has a contrast of at least 4.5:1.
- **AC7:** Changing the setting in one tab updates `<html>` in another open tab of the same browser.
- **AC8:**
  - `<meta name="theme-color">` content is `#1E1C1A` in dark and `#ECE9E4` in light.
  - `getComputedStyle(document.documentElement).colorScheme` is `dark` or `light`, matching the theme.
- **AC9:** At 390×844 and 1440×900, in both themes and in en and uk, these pages have no horizontal overflow:
  - landing, login, Today, workouts list, the editor, the catalog, exercise details, Profile, My gym, a session and its summary.
  - Review screenshots of each in dark are compared with the token table.

## 3. Data

No changes. Device storage only:

- key `pampojo:theme`, value `'system' | 'light' | 'dark'`; anything else reads as `system`;
- not cleared on log out.

## 4. API

No changes.

## 5. Server

No changes. The root layout renders the inline script (section 6) as static markup, so pages stay prerenderable.

## 6. Client

### Tokens — `src/app/globals.css`

- **Dark variant:** add `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` utilities follow the class.
- **New tokens in `:root` (light values), registered in `@theme inline` as `--color-*`:**

  | Token | Light | Dark | Replaces |
  | --- | --- | --- | --- |
  | `--nav` | `#24221f` | `#2a2724` | `bg-primary` / `text-primary` of the bottom nav panel and its skeleton |
  | `--nav-foreground` | `#f8f7f4` | `#f3f1ec` | `text-primary-foreground` of nav icons; `ring-offset-primary` → `ring-offset-nav` |
  | `--band` | `#24221f` | `#2a2724` | landing `OfflineBanner` `bg-foreground` |
  | `--band-foreground` | `#f8f7f4` | `#f3f1ec` | its `text-card` |
  | `--band-surface` | `#33302c` | `#353130` | (exists) |
  | `--accent-foreground` | `#24221f` | `#1e1c1a` | (exists) now also replaces `text-session-surface` / `fill-session-surface` used for marks on the accent |
  | `--session-border` | `#1e1c1a` | `#4a4541` | new 1px border of the session bar |

  Existing `--session-surface`, `--session-foreground`, `--session-muted` and `--session-track` get dark values `#353130`, `#f3f1ec`, `#b3aca3` and `#4a4541`.

- **`.dark` block:** sets every token to the dark value from the spec Design table:
  - `--background #1e1c1a`, `--foreground #f3f1ec`, `--card` and `--popover #2a2724`, `--card-foreground` and `--popover-foreground #f3f1ec`;
  - `--primary #f3f1ec`, `--primary-foreground #1e1c1a`, `--secondary #2a2724`, `--secondary-foreground #f3f1ec`;
  - `--muted #3a3633`, `--muted-foreground #b3aca3`, `--border #3a3633`, `--border-strong #4a4541`, `--input #3a3633`, `--ring #f3f1ec`;
  - `--planned #8c857d`, `--success #6fbf7d`, `--destructive #e5534b`, `--destructive-foreground #1e1c1a`, `--destructive-text #f28a84`;
  - `--input-surface #353130`, `--disabled-outline #5a544f`, `--placeholder #6e6862`;
  - `--sidebar #2a2724`, `--sidebar-foreground #f3f1ec`, `--sidebar-primary #f3f1ec`, `--sidebar-primary-foreground #1e1c1a`, `--sidebar-border #3a3633`, `--sidebar-ring #f3f1ec`;
  - the chart tokens: `chart-1 #f3f1ec`, `chart-2 #ec8447`, `chart-3 #b3aca3`, `chart-4 #8c857d`, `chart-5 #6fbf7d`;
  - `--shadow-soft` becomes `0 12px 32px rgb(0 0 0 / 0.45)` through a `--shadow-color` token;
  - `color-scheme: dark`.
  - The muscle, avatar and accent tokens do not change.
- **Light:** `:root` gets `color-scheme: light`.
- **No-JS fallback:** `@media (prefers-color-scheme: dark) { :root:not(.light):not(.dark) { …same dark values… } }`. Share the values through one rule list, so the block is written once and the media query reuses it with a selector list.
- **Session:** delete the `.session-theme` media block. The dialog scrim in dark uses `bg-black/60` through a `dark:` class on the overlay in `ConfirmDialog` and the sheet overlay class, if the shadcn overlay colour is fixed. Check `components/ui/dialog.tsx` and `sheet.tsx`, and change only their overlay class to `bg-foreground/45 dark:bg-black/60`.

### Theme logic — `src/features/theme/`

- **`constants.ts`:**
  - `THEME = { SYSTEM: 'system', LIGHT: 'light', DARK: 'dark' } as const`;
  - `THEME_STORAGE_KEY = 'pampojo:theme'`;
  - `THEME_COLOR = { light: '#ECE9E4', dark: '#1E1C1A' }`.
- **`theme.ts`** (pure):
  - `parseTheme(value: unknown): Theme` (unknown → `system`);
  - `resolveTheme(theme, systemDark): 'light' | 'dark'`;
  - `applyTheme(resolved)`: toggles `dark` and `light` on `document.documentElement`, sets `style.colorScheme`, and sets the content of `meta[name="theme-color"]` (creating it if missing).
- **`ThemeScript.tsx`** (server component): `<script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />`. `THEME_SCRIPT` is a short IIFE string built in `theme-script.ts` from the constants. It does what `applyTheme` does with `localStorage` (try/catch, so private mode falls back to `system`) and `matchMedia('(prefers-color-scheme: dark)')`. Keep it under 1 KB and dependency-free; one comment says why it is inline (no flash before hydration).
- **`useTheme.ts`** (client):
  - a `useSyncExternalStore` over the stored value, subscribing to a module event, the window `storage` event (key match) and `matchMedia` `change`;
  - returns `{ theme, resolved, setTheme }`;
  - `setTheme` writes storage in try/catch and keeps an in-memory value when storage fails, so the switch works for the visit; it then emits the event and calls `applyTheme`.
- **`ThemeSync.tsx`** (client, renders null): calls `applyTheme(resolved)` in an effect whenever `resolved` changes. This covers live system changes and other tabs. It is mounted once in the root layout inside the providers.
- **`ThemeSwitch/ThemeSwitch.tsx`** (client): `variant: 'labels' | 'icons'`.
  - A `role="radiogroup"` with an accessible name `t('Theme')`. Three `role="radio"` buttons with `aria-checked` and roving tabindex: arrow keys move and select.
  - Icons: lucide `Monitor`, `Sun`, `Moon` at 16px.
  - **labels:** the container is `grid grid-cols-3 gap-1 rounded-md bg-background p-1`. Each button is `h-10 rounded-sm text-sm font-semibold text-muted-foreground` with icon and label. Selected: `bg-card text-foreground font-bold ring-1 ring-border-strong`.
  - **icons:** the container is `inline-flex gap-1 rounded-md bg-background p-1`. Buttons are 40×40, icon only, `aria-label` the option label.

### Root layout — `src/app/[lang]/layout.tsx`

- `<html … suppressHydrationWarning>`, because the inline script changes its class before hydration.
- `<head><ThemeScript /></head>`.
- `<ThemeSync />` inside the providers.
- Export `viewport: Viewport = { themeColor: '#ECE9E4' }`, the initial meta the script updates. The `(app)` and session layouts already export `viewport`; Next merges segment viewports, so keep `viewportFit` there.

### Brand

- Add `public/brand/pampojo-wordmark-dark.svg` (the wordmark with the square `#2A2724` and the "ampojo" path `#F3F1EC`) and `public/brand/pampojo-icon-dark.svg` (square `#2A2724`).
- New `src/components/BrandMark/BrandMark.tsx` with `variant: 'wordmark' | 'icon'`. It renders the light image `dark:hidden` and the dark image `hidden dark:block`, with the same props as the current `next/image` usage (src, width, height, className, alt, priority).
- Replace the seven usages:
  - `(auth)/layout.tsx`, `onboarding/layout.tsx`;
  - `MarketingHeader`, `MarketingFooter`, `AuthBrandPanel`, `SidebarNav` (wordmark);
  - `TopBar` (icon).
- The OG image keeps `pampojo-icon.svg`.

### Components that used charcoal as a surface

- **`BottomNav`:** the panel and corners use `bg-nav` / `text-nav`, the icons `text-nav-foreground`, and the focus ring offset `ring-offset-nav`.
- **`AppShellSkeleton`:** the bar is `bg-nav`; skeleton chips are `bg-nav-foreground/15`.
- **`OfflineBanner` (landing):** `bg-band text-band-foreground`, plus `dark:border-y dark:border-border-strong`.
- **Marks on the accent** (`SetRow` check, `RestRing` centre, `SessionSummary` check, `RestTimer` over text): `text-accent-foreground` / `fill-accent-foreground` instead of `session-surface`.
- **`SessionBar`:** add `border border-session-border`. The inner button keeps `bg-session-foreground text-session-surface`.
- **Inverse surfaces stay as they are** and become light on dark, which the design accepts: `bg-foreground text-card` in `StatusPill` (offline), `StepList`, `HowItWorks`, `HeroWorkoutCard`; `bg-primary text-primary-foreground` in `LibraryTabs`, `MuscleChips`, `SegmentedControl`, the picker numbers and the "Додай вправи" tag.
- **Toaster:** `components/ui/sonner.tsx` takes `theme` from `useTheme().resolved` instead of the fixed `"light"`. Colours already come from tokens.

### Session (remove `.session-theme`)

Remove the `session-theme` class from:

- `ActiveSession.tsx` (root);
- the `session/layout.tsx` and `session/[id]/page.tsx` fallbacks;
- `SessionHeader` (menu content), `SessionView` (sheet, `ConfirmDialog` `className`, `ExercisePicker` `className`), `SessionNote`, `ForgottenSessionDialog`.

Keep `bg-card text-foreground` where it set the surface. `ExercisePicker` keeps its `className` prop.

### Profile — `src/features/profile/ProfileView/ProfileView.tsx`

After the Language row, add a row as a `fieldset`:

- `className="flex flex-col gap-2.5 rounded-lg bg-card px-2 pt-3.5 pb-2 lg:col-span-2"`;
- a `legend`-styled label "Тема" (`px-3 text-muted-foreground`);
- `<ThemeSwitch variant="labels" />` under it.

Board: "Профіль з темою, моб, темна".

### Landing footer — `src/features/landing/MarketingFooter/MarketingFooter.tsx`

`<ThemeSwitch variant="icons" />` next to `<LanguageSwitcher />` in the same flex group, with gap 3.

### Layout checks

At 390px the labels row has three columns of about 110px each; "Як у системі" at 14/600 with the icon fits. Below 360px the grid may wrap the text to two lines (`leading-tight`). There is no horizontal scroll.

## 7. Copy

| en (key) | uk |
| --- | --- |
| Theme | Тема |
| System | Як у системі |
| Light | Світла |
| Dark | Темна |

## 8. Steps

1. **Tokens:** `globals.css` (custom variant, new tokens, `.dark` block, the no-JS media fallback, `color-scheme`, `.session-theme` removed); `dialog.tsx` and `sheet.tsx` overlay classes if needed.
2. **Theme logic:** `src/features/theme/{constants,theme,theme-script,useTheme}.ts`, `ThemeScript.tsx`, `ThemeSync.tsx`, with unit tests.
3. **Root layout:** `src/app/[lang]/layout.tsx` (script, `suppressHydrationWarning`, `ThemeSync`, viewport `themeColor`).
4. **Brand:** the dark SVGs, `BrandMark` and the seven usages.
5. **Surfaces:** `BottomNav`, `AppShellSkeleton`, `OfflineBanner`, the accent marks, `SessionBar`, `Toaster`.
6. **Session:** remove `session-theme` everywhere it is listed.
7. **Switch:** `ThemeSwitch` with tests; the Profile row; the landing footer.
8. **i18n:** `en.json`, `uk.json`, `pnpm i18n:check`.
9. **Contrast test:** `src/app/__tests__/theme-contrast.test.ts`.
10. **e2e:** `e2e/29-dark-theme.spec.ts`. Run `pnpm lint`, `pnpm typecheck`, the touched tests, and the e2e of specs 05, 10 and 29.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/29-dark-theme.spec.ts` "follows the system": `emulateMedia({ colorScheme: 'dark' })` on `/`, `/login` and `/today` gives `html.dark` and a `rgb(30, 28, 26)` body; switching to light live removes it |
| AC2 | `src/features/theme/ThemeSwitch/__tests__/ThemeSwitch.test.tsx` (select stores and applies, arrow keys); e2e "Profile switch persists across reload and log out and shows in the footer" |
| AC3 | e2e "landing footer switch sets the theme" |
| AC4 | e2e "no flash": `page.route('**/_next/static/chunks/**', abort)`, `localStorage` `dark` through `addInitScript`, `goto('/login')`, `html` has `dark` |
| AC5 | e2e "session follows the app theme": `light` stored, system dark, start a session, the background is `rgb(236, 233, 228)`; the existing spec 10 e2e still passes in dark |
| AC6 | `src/app/__tests__/theme-contrast.test.ts` (node): parse `:root` and `.dark` from `globals.css`, check foreground/background, muted/background, muted/card, foreground/card, foreground/input-surface, primary-foreground/primary, accent-foreground/accent, destructive-text/card, nav-foreground/nav, band-foreground/band, session-foreground/session-surface, card/foreground (inverse pill) ≥ 4.5 |
| AC7 | e2e "two tabs": two pages in one context, set dark in one, the other gets `html.dark` |
| AC8 | `src/features/theme/__tests__/theme.test.tsx` (browser) for `applyTheme` (meta and color-scheme); e2e reads the meta content |
| AC9 | e2e "fits in both themes": the listed pages at the project viewport in dark and light, `scrollWidth ≤ innerWidth`; review screenshots |

Unit tests for `parseTheme` and `resolveTheme` go in `src/features/theme/__tests__/theme.test.ts` (node).

## 10. Risks and open questions

- **The inline script needs CSP `script-src 'unsafe-inline'` or a nonce.** There is no CSP today. If one is added later, the script needs a hash.
- **`suppressHydrationWarning`** only covers the `<html>` attributes. Any component that renders theme-dependent markup must read `useTheme` on the client only (`Toaster` does it inside the client tree).
- **Inverse elements** (`LibraryTabs`, `MuscleChips` active, `SegmentedControl` selected, offline pill) become light on dark. That is accepted by the design ("components keep their light structure"). Flag it in `/review 29` if anything reads too bright.
- **Charts:** spec 13 adds the charts and must use the chart tokens.
- **Exercise photos** have light backgrounds in places. That is accepted, and nothing changes.

## 11. Implementation notes

- **No no-JS fallback.** The `@media (prefers-color-scheme: dark)` copy of the dark tokens was left out. It would duplicate the whole `.dark` block, and the app does not work without JS anyway. The inline script always sets `dark` or `light`.
- **No `viewport.themeColor`.** Next renders that meta after the inline script, which led to two `theme-color` tags with the light one last. The script now creates the single tag, and `applyTheme` updates it.
- **Hex colours.** The lint rule forbids hex in source. `THEME_COLOR` in `features/theme/constants.ts` keeps the two background colours with an explained `eslint-disable` line, and tests import it.
- **Light `--destructive-foreground`** is `#1e1c1a`, not `#24221f`: the contrast test found 4.28:1 on `#E5534B`, and the darker charcoal passes AA. This also fixes the spec 10 destructive buttons.
- **Scrims.** `dialog.tsx` and `sheet.tsx` overlays used `bg-foreground/45`, which would turn light in dark. They now use a new `--scrim` token (`rgb(36 34 31 / .45)` light, `rgb(0 0 0 / .6)` dark).
- **Toaster.** It gets its theme through a new `features/theme/ThemedToaster.tsx`, so `components/ui/sonner.tsx` does not import a feature.
- **`ThemeSwitch` keys.** Arrow keys are handled on each radio button rather than on the group (jsx-a11y: a radiogroup with a key handler must be focusable).
- **`--shadow-soft`** reads a new `--shadow-color` token, so floating shadows are deeper in dark.
- **Spec 10 e2e** checks the session background on `body`, because `.session-theme` is gone.
- **Dark primary buttons.** At the lead's request they are raised `#4A4541` with light text, instead of the near-white of the design table. The session bar button got `--session-button` tokens so it follows (DECISIONS 2026-11-15 "Dark theme buttons").

## 12. Review — 2026-11-15

**Verdict:** Pass with notes. Nothing blocks.

Screenshots: `scratch/review/29-dark-theme/`, uk, dark system theme, 390×844 and 1440×900:

- landing and footer, login, onboarding;
- Today (empty, with workouts, offline);
- workouts list, editor, catalog, exercise details, Profile, My gym;
- the Start sheet, session, finish dialog, summary;
- the Profile forced to light on a dark system.

The walk logged no page errors and no horizontal overflow.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | e2e "follows the system theme, live…"; `AC1-*-dark.png` |
| AC2 | Pass | `ThemeSwitch.test.tsx`; e2e "the Profile switch…"; `AC2-profile-*-dark.png`, `AC2-profile-desktop-light-forced.png` |
| AC3 | Pass | e2e "the landing footer switch…"; `AC3-landing-footer-*-dark.png` |
| AC4 | Pass | e2e "sets the theme before hydration" (JS chunks blocked) |
| AC5 | Pass | e2e "the session follows the app theme"; `AC5-*-dark.png` |
| AC6 | Pass | `src/app/__tests__/theme-contrast.test.ts`: 30 pairs, both themes |
| AC7 | Pass | e2e "…and other tabs follow" |
| AC8 | Pass | `applyTheme.test.tsx`; e2e checks a single `theme-color` meta and `color-scheme` |
| AC9 | Pass | e2e "pages fit the screen in both themes"; the walk found no overflow on 17 screens per viewport |

### Findings

1. [minor] **Switching the theme animates colours for a moment.** Elements with `transition-colors` (sidebar rows, secondary buttons, the language switcher) fade between the two palettes for about 150 ms, so a screenshot taken right after the click shows faint sidebar text and dark buttons on the light page. `src/features/theme/theme.ts:22` (`applyTheme`). Common fix: add a class that sets `transition: none` for one frame while the class changes.
2. [minor] **Inverse diamonds and chips stay near-white in dark.** Examples: the numbered step "3" on Today (`src/components/StepList/StepList.tsx:35`), the landing "How it works" numbers (`src/features/landing/HowItWorks/HowItWorks.tsx:36`) and the hero "Рекорд" badge. Primary surfaces became raised dark after "Dark theme buttons", so these white marks now read brighter than the buttons. Consider `bg-primary text-primary-foreground` for them.
3. [minor] **My gym chips are hard to tell apart in dark.** Selected chips are `#4A4541`, close to the unselected surface, so the check icon carries most of the difference (`AC9-gym-mobile-dark.png`). It is accessible because of the icon, but weaker than in light.
4. [minor] **The design canvas still shows light primary buttons.** `DECISIONS.md`, `VISUAL_LANGUAGE.md` and the spec token table have the `#4A4541` value; the canvas boards were not updated.

### Checks

- lint: pass.
- typecheck: pass.
- tests: full `pnpm test`, 92 files and 591 tests pass.
- e2e:
  - `e2e/29-dark-theme.spec.ts` 12/12;
  - `e2e/10-workout-session.spec.ts` passes;
  - `e2e/05-app-shell.spec.ts`: "placeholder sections show their empty states" failed once in the combined run and on the second of `--repeat-each=2`. The dev server log shows a server-side `SyntaxError: Unexpected end of JSON input` while rendering `/en/calendar` and `/en/library/workouts` (500, then 200 on retry), with the "Next.js (stale)" dev overlay. It passed in the earlier 100-test run and on the first repeat. It looks like a dev-server (Turbopack) cache race, not this spec's code, but it is not proven. Worth watching in CI, which runs `pnpm start`.
- Diff: no secrets, `.env*` or build output. No server or data changes.

### Out of scope

- Charts (spec 13) must use the chart tokens to get the dark values.
- A CSP added later must allow the inline theme script (a hash).
