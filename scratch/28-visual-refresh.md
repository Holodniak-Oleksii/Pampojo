# 28-visual-refresh — technical plan

Spec: `docs/specs/28-visual-refresh.md`

## 1. Summary

The existing UI moves to the "Warm stone" visual language:

- new colour tokens and a 3/4/6/8px radius scale;
- no pills, and shadows only on floating layers;
- a hexagonal bottom nav with a cut-out Play diamond, and a restyled sidebar and status pill;
- Today with a one-line greeting and a ghost empty state;
- muscle family diamonds in the catalog;
- one line per requirement in the details "Gym equipment" row;
- five custom icons;
- a re-laid landing;
- recoloured brand assets and the OG image;
- copy rules: no "·" or "•", «підходи», and document titles as "Page | Pampojo".

There are no data, API or route changes. Screens without a mockup keep their layout and only take the tokens and shape rules.

Canvas (lead only): <https://claude.ai/artifact/WSZjiH55W9GfncqbK4WNQe>. Board names are cited below. Everything needed to build is written out here.

## 2. Acceptance criteria

- **AC1 — Tokens.** `src/app/globals.css` `:root` holds the values in §3. A contrast unit test reads them and asserts at least 4.5:1 for:
  - `--foreground` on `--background` and on `--card`;
  - `--muted-foreground` on `--background` and on `--card`;
  - `--foreground` on `--accent`.
- **AC2 — No pills, no card shadows.** e2e at 390 and 1440 checks the computed `border-radius`:
  - 4px: the Today primary link-button, the catalog search input, a muscle chip and the status pill;
  - 6px: a catalog section card;
  - 8px on the top corners of the start workout sheet.
  - The computed `box-shadow` is `none` on the Today empty-state card, a catalog section card and the Profile row cards.
- **AC3 — Bottom nav.** On mobile:
  - The nav renders the hexagonal panel, with `aria-hidden` decoration, and five slots in the current order.
  - The centre is a `<button>` named "Start workout". It is rotated 45°, with a visible size of at least 44×44px. A tap opens the start workout sheet.
  - The active section link has `aria-current="page"` and the accent icon colour.
  - On a scrolled page the last content element stays fully above the top of the Play diamond (e2e: its bounding box bottom is at most the diamond's top).
- **AC4 — Sidebar.** On desktop:
  - The Start button shows a small accent diamond icon.
  - The active link has `aria-current="page"`, a `--card` background and an accent diamond marker (`aria-hidden`).
  - Inactive links have no background.
- **AC5 — Status pill.**
  - `status="online"`: light background, a green diamond, "Online".
  - `status="offline"` with `pendingCount={3}`: dark background, an accent outline diamond, "Offline", and a badge showing "3". No "·" character is rendered.
  - The screen-reader text "3 changes waiting to sync" stays.
- **AC6 — Today.**
  - One line "Good morning, John Smith. Thursday, 13 November" in the active locale. It is a `<p>`, not a heading, and no avatar is shown.
  - The empty state:
    - an `<h1>` "No workouts yet" and its line;
    - three ghost rows marked `aria-hidden`;
    - the hint "Pick exercises from the catalog, set sets, reps and weight.";
    - one link-button "Create your first workout" to `/library/workouts`.
  - The gym nudge card renders the my-gym icon without a tinted background.
- **AC7 — Muscle families.**
  - A unit test asserts every `MUSCLE_GROUPS` value maps to exactly one of the 6 families, and that each family has at least one group.
  - Muscle chips in the catalog and the catalog section headings render a family diamond (`data-family` attribute) before the label.
  - `ExerciseListItem` renders no diamond, and joins its muscles with ", ".
- **AC8 — Details gym row.**
  - `[["barbell"],["flat_bench"],["squat_rack"]]` renders a list of three items: "Barbell", "Flat bench", "Squat rack".
  - `[["dumbbells","kettlebells"]]` renders one item, "Dumbbells or Kettlebells".
  - `[]` renders "Nothing special".
  - No "·" is rendered.
- **AC9 — Icons.**
  - `src/components/BrandIcons/` exports `WorkoutIcon`, `SetDoneIcon`, `RecordIcon`, `RestIcon` and `MyGymIcon`. Each is an SVG with `stroke="currentColor"`, `aria-hidden` by default and a `className` prop.
  - `MyGymIcon` is used in `GymNudgeCard`, `GymProfileRow` and the `/profile/gym` header; `WorkoutIcon` in the Today empty state; `RecordIcon` in the landing hero.
  - `EmptyState` no longer wraps its icon in a tinted box.
- **AC10 — Landing.**
  - The hero has the workout card (`data-testid="hero-workout"`) and no phone frame.
  - Features is a `<ul>` with dividers.
  - "How it works" is an `<ol>` with three diamond markers.
  - Progress shows "82%", 12 diamond markers, the line chart and BMI "24.8".
  - The offline band is full width and dark.
  - The FAQ accordion opens one item at a time and toggles.
  - The CTA text is "Log your next workout here".
  - The footer tagline is "A workout log that works without a signal".
  - No visible text contains "•" or "·".
  - `<img>` sources stay SVG only (the existing e2e).
- **AC11 — Brand.**
  - `docs/brand/*.svg` and `public/brand/*.svg` contain `#EC8447` and `#24221F`, and neither `#EC8447` nor `#262626`.
  - `src/app/favicon.ico`, `apple-icon.png` and `icon.svg` are regenerated.
  - The OG image renders with the new colours and the tagline. The e2e for the OG image still gets a 200 PNG.
- **AC12 — Catalogs.** A unit test asserts:
  - no en or uk value contains "·" or "•";
  - no uk value contains the stem «сет» (case-insensitive).

  `pnpm i18n:check` passes.
- **AC13 — No horizontal scroll** at 390 and 1440, in en-US and uk-UA, on: `/`, `/login`, `/signup`, `/onboarding`, `/today`, `/library/exercises`, an exercise details page, `/library/exercises/new`, `/profile` and `/profile/gym`.
- **AC14 — Motion.**
  - The primary button has a computed `transition-duration` of `0.12s`.
  - With `reducedMotion: 'reduce'` emulated, the start sheet's computed `animation-duration` is at most 0.01s. The global rule already in `globals.css` does this.
  - Without it, the sheet animation is 0.24s and the overlay 0.2s.
- **AC15 — Focus.** After the user tabs to the first muscle chip on `/library/exercises`, the chip has a visible focus ring: computed `box-shadow` or `outline` not `none`, in `--foreground`.

## 3. Data

No database, API or schema changes.

### Constants — `src/constants/exercise.ts` (add, no value imports)

```ts
export const MUSCLE_FAMILY = {
  CHEST: 'chest', SHOULDERS: 'shoulders', BACK: 'back', ARMS: 'arms', LEGS: 'legs', CORE: 'core',
} as const;
export type MuscleFamily = ValueOf<typeof MUSCLE_FAMILY>;
export const MUSCLE_FAMILY_OF: Record<MuscleGroup, MuscleFamily> = {
  chest: 'chest',
  shoulders: 'shoulders', traps: 'shoulders', neck: 'shoulders',
  lats: 'back', middle_back: 'back', lower_back: 'back',
  biceps: 'arms', triceps: 'arms', forearms: 'arms',
  quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs',
  abdominals: 'core',
};
```

### Tokens — `src/app/globals.css` `:root`

| Token | Value |
| --- | --- |
| `--background` | `#ece9e4` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`, `--primary`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent-foreground` | `#24221f` |
| `--card`, `--popover`, `--secondary`, `--primary-foreground`, `--sidebar`, `--sidebar-primary-foreground` | `#f8f7f4` |
| `--muted-foreground` | `#5c5751` |
| `--muted` (skeletons) | `#e0dbd4` |
| `--border`, `--input`, `--sidebar-border` | `#e0dbd4` |
| `--border-strong` (new) | `#d9d3cb` |
| `--accent`, `--sidebar-accent` | `#ec8447` |
| `--accent-soft` | `#fbd9c3` (kept only for `--avatar-1`; remove every other use) |
| `--planned` (new) | `#aea79f` |
| `--success` | `#5baa6a` |
| `--destructive` | `#e5534b` |
| `--ring`, `--sidebar-ring` | `#24221f` |
| `--chart-1` | `#24221f` |
| `--chart-2` | `#ec8447` |
| `--chart-3` | `#5c5751` |
| `--chart-4` | `#aea79f` |
| `--chart-5` | `#5baa6a` |
| `--muscle-chest` | `#c9786b` |
| `--muscle-shoulders` | `#c9a24e` |
| `--muscle-back` | `#6f8fa8` |
| `--muscle-arms` | `#9a7aa0` |
| `--muscle-legs` | `#7f9a72` |
| `--muscle-core` | `#5e9a96` |
| `--radius` | `6px` |

In `@theme inline`:

- add `--color-border-strong`, `--color-planned` and the six `--color-muscle-*`;
- replace the radius scale with `--radius-sm: 3px; --radius-md: 4px; --radius-lg: 6px; --radius-xl: 8px;`, and delete `--radius-2xl` … `--radius-4xl` (no class may use them after this spec);
- `--shadow-soft` stays for floating layers only: sheets, dialogs, dropdowns, toasts, and the landing hero card.

Radius classes after the change:

- `rounded-sm` (3px): thumbnails, the ghost bars;
- `rounded-md` (4px): buttons, inputs, chips, pills, avatars, tags, the logo square, focus targets;
- `rounded-lg` (6px): cards and panels;
- `rounded-t-xl` (8px): bottom sheets;
- `rounded-xl` (8px): dialogs.

`rounded-full` stays only on spinners. Diamonds are `rounded-[2px] rotate-45`, and Play is `rounded-lg`.

## 4. API

No changes.

## 5. Server

- `src/app/[lang]/(app)/today/page.tsx`: stop passing `avatarEmoji` and `avatarColor` to `TodayView`.
- Document titles in every route file: `t('X · Pampojo')` becomes `t('X | Pampojo')`. This covers calendar, progress, today, library workouts and exercises, new, `[id]`, `[id]/edit`, profile, profile/gym, signup, login, onboarding and dev/ui. The template titles in privacy and terms become `` `${t('…')} | Pampojo` ``.
- `src/app/[lang]/(marketing)/og-colors.ts`: background `#ECE9E4`, foreground `#24221F`, accent `#EC8447`.
- `opengraph-image.tsx`:
  - replace the accent bar with a 28px accent diamond (a rotated `div`, 4px radius) followed by the tagline in 40px Manrope 800, `#5C5751`;
  - read the tagline from the catalogs with the key "A workout log that works without a signal".

## 6. Client

### Base components (`src/components/ui`, generated shadcn files — change classes, not structure)

- **`button.tsx`**:
  - base: `rounded-md`, `transition-[transform,background-color,color] duration-120 ease-out active:scale-[0.98]` instead of `transition-all … active:not-aria-[haspopup]:translate-y-px`;
  - focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`;
  - `secondary`: `bg-card text-foreground ring-1 ring-inset ring-border hover:bg-background`, without the shadow;
  - `ghost`: hover `bg-card`;
  - `icon` size: `rounded-md`.
- **`input.tsx`, `checkbox.tsx`, `dropdown-menu.tsx` content and items, `progress.tsx`, `tabs.tsx`**: `rounded-md`; dropdowns keep `shadow-soft`.
- **`card.tsx`**: `rounded-lg`, no shadow, `bg-card`.
- **`sheet.tsx`**: the bottom side gets `rounded-t-xl shadow-soft`. The open and close animation is `duration-240` with `ease-[cubic-bezier(.2,.8,.2,1)]`, and the overlay `duration-200` with `bg-foreground/45`.
- **`dialog.tsx`**: `rounded-xl shadow-soft`, the overlay as above, the content `duration-200`.
- **`skeleton.tsx`**: `rounded-md bg-muted`; `bg-muted` is now `#e0dbd4`.
- **`sonner.tsx`**: the toast class gets `rounded-md`. Set the mobile `offset` to `calc(8rem + env(safe-area-inset-bottom))` so toasts clear the Play diamond. The current mobile offset must be checked in the file and raised accordingly.

### Shared components (`src/components`)

- **`BrandIcons/`** (new): `BrandIcons.tsx` exports five components with `{ className?: string; title?: string }`. With `title` they get `role="img"` and an `aria-label`; otherwise `aria-hidden`.
  - All use `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={2}` and round caps and joins.
  - `SetDoneIcon` also takes `done?: boolean`, which fills the diamond with `var(--accent)`.

  | Icon | SVG paths |
  | --- | --- |
  | `WorkoutIcon` | `M5.5 7 8.5 12 5.5 17 2.5 12Z`, `M18.5 7 21.5 12 18.5 17 15.5 12Z`, `M8.5 12h7` |
  | `SetDoneIcon` | `M12 3 21 12 12 21 3 12Z`, `m8.5 12 2.5 2.5 4.5-5` |
  | `RecordIcon` | `M12 3 21 12 12 21 3 12Z`, `M12 16V8.5`, `m8.8 11.5 3.2-3.2 3.2 3.2` |
  | `RestIcon` | a circle at `cx=12 cy=13.5 r=7.5`, `M12 13.5V10`, `m12 13.5 2.5 1.5`, `M12 2.5 13.5 4 12 5.5 10.5 4Z` |
  | `MyGymIcon` | a circle at `cx=12 cy=12 r=9`, `M12 8.5 15.5 12 12 15.5 8.5 12Z` |

  `index.ts` re-exports them.
- **`Diamond/`** (new): `<Diamond tone="accent|foreground|planned|success|destructive|muscle" family? variant="fill|outline" size="sm|md" />`.
  - It renders a `span` with `aria-hidden`, `rotate-45`, `rounded-[2px]`, 7px (`sm`) or 10px (`md`), and a 2px border for `outline`.
  - With `tone="muscle"`, `family` picks the colour from a static map `{ chest: 'bg-muscle-chest', … }`, so Tailwind sees each class.
  - It sets `data-family` when `family` is given.
- **`StatusPill`**: `rounded-md`, `h-8`, no shadow.
  - Online: `bg-card` + `<Diamond tone="success" size="sm" />` + "Online".
  - Offline: `bg-foreground text-card` + `<Diamond tone="accent" variant="outline" size="sm" />` + "Offline". If `pendingCount > 0`, add a badge `span` (`aria-hidden`, `rounded-[3px] bg-accent text-foreground px-1.5 text-xs font-extrabold`) with the number, plus the existing `sr-only` text. The "·" goes away.
- **`EmptyState`**: `rounded-lg bg-card p-8`, no shadow. The icon is a plain `<Icon className="size-7 text-muted-foreground" aria-hidden />` above the title, with no tinted box. The `icon` prop type widens to `ComponentType<{ className?: string }>` so the brand icons fit.
- **`EmojiAvatar`**: `rounded-md` instead of `rounded-full`.
- **`OfflineNotice`**: `rounded-md bg-card ring-1 ring-inset ring-border`, without `bg-accent-soft`.
- **`SegmentedControl`, `Select`, `PasswordInput`, `ConfirmDialog`, `StatCard`**: radius classes per §3, no shadows on non-floating parts. `StatCard` and `SegmentedGauge` stay for `/dev/ui` only.

### App shell (`src/features/app-shell`) — boards "Ж. Гострий", "Ж. Десктоп 1440"

- **`BottomNav`**:
  - `nav` stays `fixed inset-x-0 bottom-0 z-40 lg:hidden`, with no background or radius of its own, and `pb-[env(safe-area-inset-bottom)]` painted by the panel.
  - The panel is built from three `aria-hidden` absolute pieces, so the chamfers keep their shape at any width:
    - a left corner SVG, 24×24, `viewBox="0 0 24 24"`, path `M0 24 L0 21 Q0 20 0.8 19.2 L19.2 0.8 Q20 0 21 0 L24 0 L24 24 Z`, `fill="currentColor"`, `text-primary`;
    - a middle `div` (`flex-1 bg-primary`, 24px tall);
    - a right corner SVG, mirrored with `scale-x-[-1]`.
    - Below these, a `bg-primary` block fills the rest of the 76px plus the safe area.
  - The `ul` grid stays: 5 columns, `h-[76px]`, `max-w-[600px]`.
  - **Play:** a `button` with `aria-label={t('Start workout')}`, `size-[60px] -mt-11 rotate-45 rounded-lg bg-accent border-[5px] border-background text-foreground transition-transform duration-120 active:scale-[0.92]`, and `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`. The icon inside is lucide `Play` in `size-[26px] -rotate-45 fill-current`.
  - Links keep their behaviour: `rounded-md`, the inactive icon `text-primary-foreground/80`, the active one `text-accent`.
- **`AppShell` and `AppShellSkeleton`**: main `pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-12`, raised from 6.5rem to clear the diamond.
- **`GymEditor` sticky save**: `bottom-[calc(8rem+env(safe-area-inset-bottom))]`.
- **`SidebarNav`**:
  - `aside` `bg-background border-r border-border`;
  - the logo link is `rounded-md`;
  - the Start `Button` (size lg, `rounded-md`) gets a leading `span` (`size-[18px] rotate-45 rounded-[3px] bg-accent`) holding the `Play` icon (`size-2.5 -rotate-45 fill-foreground text-foreground`).
  - Links: `min-h-11 rounded-md px-3 gap-3`; inactive `text-foreground/80 hover:bg-card`; active `bg-card font-bold`, with a trailing `<Diamond tone="accent" size="sm" className="ml-auto" />`.
- **`TopBar`**: the icon link is `rounded-md`. Everything else stays.
- **`AppShellSkeleton`, `StartWorkoutSheet`**: radius and shadow rules. The sheet uses the updated `EmptyState`.

### Today (`src/features/today`) — board "Ж. Тренувань ще немає"

- **`TodayView`**:
  - The props become `{ displayName: string; initialGym: Gym | null }`.
  - Render a `<p className="text-[15px] text-muted-foreground">` with `t('{{greeting}}. {{date}}', { greeting, date })`.
    - `greeting` is the existing localized "Good morning, {{name}}" string for the part of day.
    - `date` is `new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)`, with the first letter upper-cased.
    - Until `usePartOfDay()` resolves, render a `Skeleton` line `h-5 w-72`.
  - Then `GymNudgeCard`, then `TodayEmpty`.
- **`TodayEmpty`** (new private file `TodayView/TodayEmpty.tsx`): a `section` with `rounded-lg bg-card p-4`.
  - `<h1 className="text-3xl font-extrabold leading-tight">` "No workouts yet", and under it `<p className="mt-1.5 text-[15px] text-muted-foreground">` with its line.
  - `<GhostList rows={3} className="mt-3.5" />`.
  - The hint `<p className="mt-3 text-sm text-muted-foreground">`.
  - `<Button asChild className="mt-3 w-full h-[50px]"><Link href="/library/workouts">Create your first workout</Link></Button>`.
  - `WorkoutIcon` is not drawn here. AC9 maps it to the empty state, so place it `size-6` inline before the h1 text in a flex row with a 10px gap.
- **`GhostList`** (new, `src/components/GhostList/`): `rows` and `className` props, `aria-hidden`. Each row:
  - `flex items-center gap-3 min-h-16 border-t border-border`, the last one also with `border-b`;
  - a 48px dashed thumbnail `rounded-sm border-[1.5px] border-dashed border-planned`;
  - two bars `h-2.5 rounded-sm bg-border` and `h-2 rounded-sm bg-background` of varied widths: row widths `[132,92,64]`, `[168,80,56]`, `[110,100,60]` px, the third bar right-aligned.
- **`TodaySkeleton`**: one line, plus one `rounded-lg h-80` block.

### Gym feature

- **`GymNudgeCard`**: `rounded-lg`, no shadow. Remove the circle `span`, and put `<MyGymIcon className="size-6 shrink-0" />` inline before the `h2` in a flex row.
- **`GymProfileRow`**: `rounded-lg`, no shadow; `MyGymIcon` `size-5` before the label.
- **`GymEditor` header**: `MyGymIcon size-7` before the "My gym" title (inside the `PageHeader` title slot via a wrapping flex).
- **`GymEquipmentPicker`**: group sections `rounded-lg` without shadow. Chips use `chipClass`.
- **`features/gym/utils.ts`**:
  - replace `formatRequirements` with `formatRequirementGroup(group, labels, or: string): string`, which joins items with `` ` ${or} ` ``;
  - `ExerciseDetails` and `GymRequirementsField` use it.

### Exercises and library — board "D3. Кольори мʼязів у каталозі"

- **`chipClass(active)`**: `min-h-11 shrink-0 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-120 outline-none focus-visible:ring-2 focus-visible:ring-ring`.
  - Active: `bg-primary text-primary-foreground`.
  - Inactive: `bg-card text-foreground ring-1 ring-inset ring-border hover:bg-background`.
- **`MuscleChips`**: each muscle chip renders `<Diamond tone="muscle" family={MUSCLE_FAMILY_OF[muscle]} size="sm" />` + the label, in an `inline-flex items-center gap-2`. "Mine" and "Available in my gym" get no diamond.
- **`ExerciseCatalog`**:
  - Section `h2`: `flex items-center gap-2.5` + `<Diamond tone="muscle" family={…} size="md" />`.
  - The section `ul`: `rounded-lg bg-card` without shadow on mobile, and on `lg` cards `rounded-lg bg-card`, no shadow, `ring-1 ring-inset ring-border`.
  - The error card is `rounded-lg`, no shadow.
- **`ExerciseListItem`**: muscles `.join(', ')`; the image `rounded-sm`; the "Mine" badge `rounded-md bg-background px-2 text-xs font-semibold`, without peach; no family diamond.
- **`EquipmentFilter`, `LibraryTabs`**: `rounded-md`. Tabs become a segmented control `bg-card p-[3px] rounded-[5px]`, with the active tab `bg-primary text-primary-foreground rounded-[3px]`.
- **`ExerciseDetails`**:
  - Section cards `rounded-lg`, no shadow; frames and images `rounded-lg`.
  - The gym row value is a `<ul className="flex flex-col items-end gap-0.5">` with one `<li>` per group, from `formatRequirementGroup`. With `[]`, the plain text "Nothing special".
  - Buttons per the base rules.
- **`ExerciseForm`, `PhotoSlots`, `GymRequirementsField`, the skeletons, `ExerciseFrames`, `ExerciseImage`**: radius and shadow rules only. `GymRequirementsField` alternatives chips use `rounded-md`.

### Profile, auth, onboarding, i18n switcher, dev UI

Radius and shadow rules only: `ProfileView` rows `rounded-lg` without shadow, `EditProfileSheet`, `NameAvatarFields`, `AuthCard`, `AuthBrandPanel`, `AuthCardSkeleton`, the `(auth)` and `onboarding` layouts, `OnboardingFlow`, `LanguageSwitcher`, `DevUiPage`.

- Remove every `bg-accent-soft` used as a fill: replace with `bg-card` or `bg-background`. The exception is `--avatar-1`.
- Remove every `shadow-soft` on cards, rows, chips and buttons.
- The onboarding emoji grid uses square `rounded-md` cells, with selection shown as a `ring-2 ring-foreground`.

### Landing (`src/features/landing`) — board "D13. Лендинг 1440"

- **`LandingPage`**: the container stays `max-w-[1200px] px-4 md:px-6`. It renders Hero, Features, HowItWorks and ProgressShowcase inside it. `OfflineBanner` moves outside the container as a full-bleed band, followed by a second container with Faq and CtaBanner.
- **`Hero`**:
  - Replace `HeroPhone` with `HeroWorkoutCard` (rename the folder).
  - The meta line becomes `t('Free. Works on iPhone, Android and laptop.')`.
  - The buttons use the base styles (`rounded-md`).
- **`HeroWorkoutCard`** (`aria-hidden`, `data-testid="hero-workout"`):
  - `max-w-[440px] ml-auto rounded-lg bg-card p-[22px] shadow-[0_24px_48px_-24px_rgb(36_34_31/0.25)]`;
  - the header: "Bench Press" `text-3xl font-extrabold` + an offline `StatusPill` (`status="offline"`, no count);
  - four rows with `border-t border-border` (the last also `border-b`), `min-h-14`:
    - row 1: "Bench Press", with "Set 3 of 4" in muted, and "80 kg × 8";
    - rows 2 and 3: `SetDoneIcon done`, "Set 1" and "Set 2", "80 kg × 8";
    - row 4: `SetDoneIcon` with `text-planned`, "Set 3" in muted, "80 kg × 8".
  - The text `t('3 sets saved, will sync later')` sits under the rows.
  - A tag sits absolutely bottom-left, offset −12px below the card: `rounded-md bg-foreground text-card h-10 px-3.5 text-sm font-semibold` + `RecordIcon className="text-accent size-[18px]"` + "Record: +5 kg".
  - There is no exercise photo: the landing stays SVG-only (2026-11-08 decision).
  - The keys "Rest 01:15" and "PR +5 kg" are no longer used.
- **`Features`**:
  - The heading becomes visible: `h2 text-3xl font-extrabold`, "Features".
  - The `ul` is `grid sm:grid-cols-2 lg:grid-cols-4 border-t-2 border-foreground`, with each `li` `py-6 pr-6 border-b border-border-strong`.
  - Icons sit `size-7` with no box: `WorkoutIcon` for "Build your own workouts", lucide `CalendarDays` for the calendar, `SetDoneIcon` for "Works offline", lucide `Share2` for sharing.
  - The title `mt-3.5 text-lg font-extrabold`, the text `text-[15px] text-muted-foreground`.
- **`HowItWorks`**:
  - An `ol` grid of 3 (`md:grid-cols-3`).
  - Each `li` is `relative pt-9`.
  - The marker is a 24px `rotate-45 rounded-md` diamond with the number counter-rotated. Step 1 is `bg-accent text-foreground`; steps 2 and 3 are `bg-foreground text-card`.
  - A 2px `bg-border-strong` line at `top-[11px]` runs from each marker to the next, except after the last. The line is hidden below `md`, where the steps stack.
  - The arrows and step icons are removed.
- **`ProgressShowcase`**:
  - A visible `h2` "Your progress at a glance".
  - Three `rounded-lg bg-card p-[22px]` panels in `flex flex-wrap gap-4` (basis 280 / 420 / 220):
    - "Plan adherence": `82%` (`text-[44px] font-extrabold`, via `formatPercent`), a 12-column grid of `Diamond md`. Positions 4 and 9 are `planned outline`, the rest `accent fill`. Under it the new line "9 of 11 workouts this month".
    - "Bench press progress": `ProgressChart` restyled — a `--foreground` 2.5px line, `--border` gridlines, a 16px accent diamond on the last point, and the labels "70 kg" at the start and "80 kg" at the end — plus "3 months".
    - "BMI": `24.8` and "−0.6 this month".
  - `SegmentedGauge`, `StatCard` and `Sparkline` are no longer used here. Delete `Sparkline` if nothing else imports it; check with grep.
- **`OfflineBanner`**:
  - `section bg-foreground text-card`, an inner container `max-w-[1200px] mx-auto px-4 md:px-6 py-14`, `flex flex-wrap items-center justify-between gap-6`.
  - The `h2` "Train in the basement. Sync when you're back online." is `max-w-[18ch] text-[clamp(30px,4vw,44px)] font-extrabold`.
  - A tag `rounded-md bg-[#33302C] px-4 py-3.5`, with `Diamond accent outline md` and "3 sets saved, will sync later".
  - `#33302C` goes in as the token `--band-surface` in `globals.css`, not as a raw hex in the component.
- **`Faq`**:
  - The accordion items lose their card style: `border-b border-border-strong`, no radius or shadow, and the list `border-t-2 border-foreground lg:grid-cols-2 lg:gap-x-8`.
  - The trigger `min-h-16 text-[17px] font-bold`, with a `Plus` icon that rotates 45° when open (`transition-transform duration-120`).
- **`CtaBanner`**: `rounded-lg bg-card ring-1 ring-inset ring-border p-10 flex flex-wrap items-center justify-between gap-6`. The `h2` is "Log your next workout here", and a `Button` "Get started" has a leading Play diamond (the same `span` as the sidebar).
- **`MarketingFooter`**: the tagline "A workout log that works without a signal"; `border-t border-border-strong`.
- **`MarketingHeader`, `MobileMenu`, `LegalPlaceholder`**: radius and shadow rules.

### Brand assets

- Replace `#EC8447` with `#EC8447` and `#262626` with `#24221F` in `docs/brand/pampojo-icon.svg`, `docs/brand/pampojo-wordmark.svg` and their `public/brand/` copies.
- Run `pnpm icons:generate`, which rewrites `src/app/favicon.ico`, `apple-icon.png` and `icon.svg`.

### Fonts

`src/app/[lang]/layout.tsx`: Manrope weights `['400', '600', '700', '800']`.

### Offline behaviour and layouts

Offline behaviour is unchanged. Mobile and desktop layouts are unchanged except where described above (the Today greeting, the landing sections, the shell nav visuals).

## 7. Copy

Add (en key → uk):

| en | uk |
| --- | --- |
| Free. Works on iPhone, Android and laptop. | Безкоштовно. Працює на iPhone, Android і ноутбуці. |
| Log your next workout here | Записуй наступне тренування тут |
| A workout log that works without a signal | Журнал тренувань, який працює без мережі |
| Record: +5 kg | Рекорд: +5 кг |
| Set {{current}} of {{total}} | Підхід {{current}} з {{total}} |
| Set {{number}} | Підхід {{number}} |
| 9 of 11 workouts this month | 9 із 11 тренувань за місяць |
| −0.6 this month | −0,6 за місяць |
| 70 kg | 70 кг |
| 80 kg | 80 кг |
| Pick exercises from the catalog, set sets, reps and weight. | Обери вправи з каталогу, задай підходи, повтори й вагу. |
| {{greeting}}. {{date}} | {{greeting}}. {{date}} |
| Features (now visible) | Можливості (exists) |
| Your progress at a glance (now visible) | exists |

Rename (all 15, en and uk): "X · Pampojo" → "X | Pampojo", for example "Today | Pampojo" / «Сьогодні | Pampojo» and "{{name}} | Pampojo".

Remove: "Free • Works on iPhone, Android and laptop", "Start training smarter today", "Track. Progress. Repeat.", "Rest 01:15", "PR +5 kg". `i18n:extract` drops the unused ones.

Unchanged keys in use: "No workouts yet", "Create your first workout to start training.", "Create your first workout", "3 sets saved, will sync later", "80 kg × 8", "Bench Press", "Online", "Offline", "{{count}} change waiting to sync", "Start workout", "Nothing special", "or".

## 8. Steps

Each step ends with `pnpm typecheck` passing.

1. **Tokens and theme.** Edit `globals.css` (§3) and the font weights in `layout.tsx`. Update `src/app/__tests__/contrast.test.ts` (AC1): drop the `--accent-soft` case and add the five pairs.
2. **Base ui.** Update `button`, `input`, `checkbox`, `card`, `sheet`, `dialog`, `dropdown-menu`, `progress`, `tabs`, `skeleton` and `sonner`. Then run the component tests that render them (`pnpm test src/components src/features/app-shell`) and fix any class-name expectations.
3. **New shared components.** `BrandIcons/`, `Diamond/`, `GhostList/`, each with `__tests__`. Update `StatusPill` (AC5, its test drops the "·" expectation), `EmptyState` (its test asserts no tinted wrapper), `EmojiAvatar`, `OfflineNotice` and the other shared components.
4. **Muscle families.** The constants plus a test at `src/constants/__tests__/exercise.test.ts` (AC7).
5. **App shell.** `BottomNav`, `SidebarNav`, `TopBar`, `AppShell`, the skeleton and the sheet. Update `AppShell.test.tsx` (Play diamond, sidebar marker).
6. **Today.** `TodayView` and its props, `TodayEmpty`, the skeleton, `today/page.tsx`. Update `TodayView.test.tsx` (AC6: the greeting is a paragraph, no avatar image, ghost rows, link).
7. **Gym and exercises.** `GymNudgeCard`, `GymProfileRow`, `GymEditor` header and sticky offset, `GymEquipmentPicker`, `formatRequirementGroup` in `gym/utils.ts` and its test, `chipClass`, `MuscleChips`, `ExerciseCatalog`, `ExerciseListItem`, `EquipmentFilter`, `LibraryTabs`, `ExerciseDetails` (AC8), and the form files. Update their tests: details gym row, list item muscles ", ", catalog section heading diamond.
8. **Profile, auth, onboarding, dev UI.** The re-skin only; adjust the tests that assert removed classes, if any.
9. **Landing.** All landing files from §6, renaming `HeroPhone` to `HeroWorkoutCard`. Update `Faq.test.tsx` if the markup changes.
10. **Titles and copy.** The route `generateMetadata` titles, `og-colors.ts`, `opengraph-image.tsx`, `pnpm i18n:extract`, fill uk, `pnpm i18n:check`. Extend `src/i18n/__tests__/catalogs.test.ts` (AC12).
11. **Brand assets.** Recolour the SVGs and run `pnpm icons:generate`.
12. **e2e.**
    - Update the existing specs for the renamed titles, removed copy and new structure:
      - `02-landing` (sections, copy, FAQ);
      - `05-app-shell` (Today heading, the Play diamond clearance replacing the bottom-bar clearance check);
      - `06` (titles);
      - `07` and `08` (titles and the gym details text "Dumbbells", "Flat bench or Adjustable bench" as list items).
    - Add `e2e/28-visual-refresh.spec.ts` for AC2, AC3, AC4, AC13, AC14 and AC15.
13. **Checks.** Lint, typecheck, `format:check`, `i18n:check`, `pnpm test`, build, and the full e2e (it is a broad change).

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/app/__tests__/contrast.test.ts`: the five pairs at ≥ 4.5 |
| AC2 | `e2e/28-visual-refresh.spec.ts`: computed `border-radius` on the listed elements at both viewports; `box-shadow: none` on the Today card, a catalog card and a Profile row |
| AC3 | `e2e/28`: the mobile Play button's bounding box (≥ 44px), its name, the sheet opening; on `/library/exercises` scrolled to the bottom, the last list item bottom ≤ the diamond top. `AppShell.test.tsx`: the active link has `aria-current` and the accent class, and the Play button has the name "Start workout" |
| AC4 | `AppShell.test.tsx` (desktop render): the active link contains the diamond marker and inactive ones do not. `e2e/28` desktop: computed background of the active link = `--card` |
| AC5 | `src/components/StatusPill/__tests__/StatusPill.test.tsx`: the online and offline variants, the badge "3", no "·" in `textContent`, the sr-only text |
| AC6 | `TodayView.test.tsx`: the paragraph greeting with the date (fake timers 2026-11-13 09:00), no `img` named after the avatar, `h1` "No workouts yet", 3 ghost rows `aria-hidden`, the link href. `e2e/05` updated to the new heading |
| AC7 | `src/constants/__tests__/exercise.test.ts`: the family map. `ExerciseCatalog.test.tsx`: the chip and section heading contain `[data-family]`. `ExerciseListItem.test.tsx`: no `[data-family]`, muscles "Chest, Triceps" |
| AC8 | `ExerciseDetails.test.tsx`: three list items; "Dumbbells or Kettlebells"; "Nothing special"; no "·". `src/features/gym/__tests__/utils.test.ts`: `formatRequirementGroup`. `e2e/08` updated |
| AC9 | `src/components/BrandIcons/__tests__/BrandIcons.test.tsx`: each icon is `aria-hidden` by default and `role="img"` with a title. `GymNudgeCard.test.tsx`: an svg and no tinted wrapper. `EmptyState.test.tsx`: no wrapper span |
| AC10 | `e2e/02-landing.spec.ts` updated: `[data-testid=hero-workout]` visible, no phone frame, features `ul` with 4 items, `ol` with 3 items, "82%", the CTA and tagline text, `page.locator('body')` text has no "•" or "·", the SVG-only test stays, FAQ toggles |
| AC11 | `src/server/__tests__/brand-assets.test.ts` (new, node): the four SVGs contain the new hexes and not the old ones. `e2e/02` OG image test stays |
| AC12 | `src/i18n/__tests__/catalogs.test.ts`: no "·" or "•" in any value, no `/сет/i` in uk values |
| AC13 | `e2e/28`: a loop over the 10 routes × en-US and uk-UA, `scrollWidth - innerWidth <= 0` (signed-up user via the helpers, like `e2e/08`) |
| AC14 | `e2e/28`: the primary button's computed `transitionDuration` contains `0.12s`; with `emulateMedia({ reducedMotion: 'reduce' })` the opened sheet's `animationDuration` ≤ 0.01s; without it, `0.24s` |
| AC15 | `e2e/28`: keyboard Tab until `document.activeElement` is the first muscle chip; its computed `box-shadow` contains the `--foreground` rgb |

## 10. Risks and open questions

- **Broad class churn.** About 50 files change classes. The risk is tests asserting old class names or text ("·"). Step 2 runs the component tests early, so breakage shows before the feature steps.
- **The `rotate-45` Play hit area.** The rotated square's tap area is its diamond, which is larger than 44px, so this is fine. Focus rings rotate with it, which is acceptable.
- **The diamond overlapping sticky UI.** The main padding, the gym sticky save and the toast offset are raised to 8rem. Any other `bottom-[…6.5rem…]` found by grep must move too.
- **The landing photo.** The hero card has no exercise thumbnail, unlike the board, to keep the SVG-only landing rule from 2026-11-08.
- **The `formatRequirements` removal** touches spec 08 code and tests (`GymRequirementsField`, details, e2e 08). Behaviour stays the same except the details format.
- **Later specs.** The rest-day Today and the week strip (12), the session screen and its dark theme (10), the sync sheet (16, 17), and the set-done "click" animation (10) follow `VISUAL_LANGUAGE.md` when built. Desktop re-layouts of the catalog, profile and gym page wait for mockups.
- **Folder naming.** The spec names `src/components/icons/`. The plan uses `src/components/BrandIcons/` to follow the PascalCase component folder rule in `code-organization.md`.

No open questions block implementation.

## 11. Implementation notes
- `--shadow-soft` is stronger (`0 12px 32px rgb(36 34 31 / 0.12)`), because it is now kept only for floating layers.
- `--band-surface` (`#33302c`) is added to `globals.css` for the landing offline tag, as §6 asks; it is not in the §3 table.
- `PlayDiamond` is a shared component in `src/components/PlayDiamond/`, used by the sidebar Start button and the landing CTA.
- `PageHeader` gets an optional `icon` prop for the `/profile/gym` title icon.
- `AuthBrandPanel` also used `HeroPhone`; it now shows `HeroWorkoutCard` on a `bg-border/60` panel, and its gradient is removed.
- The shadcn accordion uses one rotating `Plus` instead of two chevrons; the FAQ is its only user.
- Muscle chips show the family diamond everywhere `MuscleChips` is used, including the exercise form.
- The Today date comes from `Intl`, so en reads "Friday, November 13". The plan's example was "Thursday, 13 November", but 2026-11-13 is a Friday.
- e2e AC3 checks the Play size, name, `rotate: 45deg`, the accent and the sheet opening. The content-clearance check is in `e2e/05` (on `/profile`, including the diamond) instead of `/library/exercises`, because the catalog loads more on scroll.
- On desktop the start sheet comes from the right, so AC2 checks an 8px top radius on mobile only.
- Locally the Next.js dev indicator covers the landing "Open menu" button, so `e2e/02` mobile menu fails on `pnpm dev`. The full e2e passes on `pnpm start` (`CI=1`), as in CI.
- Lead feedback after implementation, 2026-11-14:
  - **Nav icons.** They now match the board: lucide `Calendar` and `Library` instead of `CalendarDays` and `LibraryBig`, and inactive icons use the full `--primary-foreground` instead of 80%.
  - **One visible title per screen** (`DECISIONS.md`). The top bar label is `lg:hidden`, and `PageHeader sectionTitle` hides the duplicated `h1` below `lg`. The `e2e/05` breakpoint test is updated.
  - **The Profile gym row** value never wraps.
  - **The `/profile/gym` save button** is no longer sticky; it sits at the end of the list (lead's call).
  - **The Today empty state** shows three numbered steps instead of `GhostList`, which is removed. "Create your first workout" is full width only below `sm`, and a ghost "Browse exercises" link sits next to it.
  - **The accent** stays `#EC8447` (the "Warm stone" palette); the lead confirmed it on 2026-11-14 after briefly trying `#F59A62`.
  - **The bottom nav chamfer** uses the board's path, with joints rounded by about 4px.
  - **Mobile catalog filters** live in the new `FilterSheet` (`DECISIONS.md`). `EquipmentFilter` loses its `menu` variant. `useCatalogParams` gains `resetFilters`. "Create exercise" on mobile is an accent "+" in `LibraryTabs`, using the new `OnlineLinkButton` `ariaLabel` prop. The e2e helper is `e2e/helpers/catalog.ts`.
  - **`dark:` classes** are removed from `src/components/ui/*`.

## 12. Review — 2026-11-14

**Verdict:** Pass with notes

Reviewed the uncommitted spec 28 change set on `feat/28-visual-refresh` (134 changed and 12 new paths), including the lead's in-review changes logged in §11 and `DECISIONS.md` on 2026-11-14. Screenshots are in `scratch/review/28-visual-refresh/` (uk, 390×844 and 1440×900).

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `src/app/globals.css`, `src/app/__tests__/contrast.test.ts` |
| AC2 | Pass | `e2e/28-visual-refresh.spec.ts` (radius and shadow), `AC2-mobile-sheet.png` |
| AC3 | Pass | `e2e/28` Play diamond, `e2e/05` clearance, `AC3-mobile-nav.png` |
| AC4 | Pass | `e2e/28` sidebar marker, `AC4-desktop-sidebar.png` |
| AC5 | Pass | `StatusPill.test.tsx`, `e2e/01`, `AC5-mobile-offline.png` |
| AC6 | Pass | `TodayView.test.tsx`, `AC6-*-empty.png` (steps version, per `DECISIONS.md`) |
| AC7 | Pass | `src/constants/__tests__/exercise.test.ts`, `AC7-*-catalog.png`, `AC7-mobile-filter-sheet.png` |
| AC8 | Pass | `ExerciseDetails.test.tsx`, `e2e/08`, `AC8-*-details.png` |
| AC9 | Pass | `BrandIcons.test.tsx`, `GymNudgeCard.test.tsx`, `EmptyState.test.tsx`, `AC9-*-profile.png` |
| AC10 | Pass with a defect | `e2e/02` passes, but the progress card shows "1%" instead of "82%" (finding 1), `AC10-*-landing.png` |
| AC11 | Pass | `src/server/__tests__/brand-assets.test.ts`, regenerated `src/app/icon.svg`, `favicon.ico`, `apple-icon.png` |
| AC12 | Pass | `src/i18n/__tests__/catalogs.test.ts`, `pnpm i18n:check` |
| AC13 | Pass | `e2e/28` no-overflow test, en and uk, both viewports |
| AC14 | Pass | `e2e/28` motion test (0.12s press, 0.24s sheet, reduced ≤ 0.01s) |
| AC15 | Pass | `e2e/28` focus ring test |

### Findings

1. [major] **The landing "Plan completion" card shows "1%"** — `src/features/landing/ProgressShowcase/ProgressShowcase.tsx:24`.
   - The code passes `0.82`, but `formatPercent` in `src/i18n/format.ts:8` expects 0–100, so the first thing a visitor reads next to "9 of 11" is wrong.
   - No test asserts the number. Pass `82` and assert "82%" in `e2e/02`.
2. [minor] **Two segmented control looks.**
   - The auth Log in / Sign up switch has a light active segment on a `--background` track (`src/features/auth/AuthCard/AuthCard.tsx:66`).
   - The Library tabs use the dark active segment on a `--card` track (`src/features/library/LibraryTabs/LibraryTabs.tsx`).
   - `VISUAL_LANGUAGE.md` describes one segmented control.
3. [minor] **The hero card repeats "Bench Press".** The name is both the card title and the first row's title (`src/features/landing/HeroWorkoutCard/HeroWorkoutCard.tsx:18` and `:24`). One of them can go, or the first row can become the next exercise.
4. [minor] **The spec text is out of date in places.**
   - A bad replace left "orange `#EC8447` → `#EC8447`" in `docs/specs/28-visual-refresh.md:28`; it should read `#F59A62` → `#EC8447`.
   - The spec's Library section still describes the mobile chip row and Equipment menu.
   - The scratch §6 still describes `GhostList` and the sticky gym save.
   - The behaviour itself is recorded in §11 and `DECISIONS.md`.
5. [minor] **Full e2e runs on `pnpm dev` time out at random.** One different test timed out at 30s in each of two runs (`06` "loads more", `07` "taken name"). Each passes alone and with `--repeat-each=3`, which points to dev-server load, not a defect.

Code checks found no issues:
- Spec 28 has no data, API or auth changes.
- No secrets, `.env*` files or build output are in the diff.
- Comments follow `CLAUDE.md`.
- The cross-feature import `LibraryTabs` → `exercises/OnlineLinkButton` is allowed by `code-organization.md`.

### Checks

- lint: pass
- typecheck: pass
- format and i18n: pass
- tests: 69 files, 447 tests pass
- e2e on `pnpm dev`: 149 passed, 9 skipped (viewport-specific), 2 failed
  - `02` mobile menu: the known dev indicator overlap;
  - one load timeout (finding 5).
  - The earlier `CI=1` run on `pnpm start` passed apart from these.

### Out of scope

- The Next.js dev indicator covers the landing "Open menu" button and the status pill on `pnpm dev`. `devIndicators` in `next.config.ts` could move or hide it.
- The Today greeting uses the full display name ("John Smith") where the board shows a first name in the vocative. That is a naming decision for the profile spec.
- The start workout sheet still uses the generic `EmptyState`. Spec 09 replaces it with real workouts.

Follow-up on 2026-11-14: finding 1 is fixed (`formatPercent(locale, 82)`, and `e2e/02` asserts "82%"), and so is the colour typo from finding 4. Findings 2, 3 and the rest of 4 stay open.
