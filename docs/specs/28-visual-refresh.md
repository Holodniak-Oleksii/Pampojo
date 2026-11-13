# 28. Visual refresh

## Goal

Move every existing screen to the visual language agreed on 2026-11-13 (`docs/tech/VISUAL_LANGUAGE.md`), so the app stops looking generated before the workout features (09+) are built on it. The structure and behaviour of the product do not change.

## User stories

- As a user, I want the app to look like one considered product, so I trust it with my training log.
- As a user, I want to see at a glance what to do next, so I don't read through decoration.
- As a user, I want to see clearly when I'm offline and what is waiting to sync.

## Scope

### Tokens and base styles

- `src/app/globals.css` gets the "Warm stone" tokens, the muscle family colours, `--planned`, `--border-strong` and the radius scale from `VISUAL_LANGUAGE.md`.
  - `--accent-soft` is used only by avatar colour 1.
  - The shadcn token names stay, so existing classes keep working.
- No pills. Buttons, inputs, selects, chips, tabs, the status pill and avatars get a 4px radius; cards and panels 6px; sheets and dialogs 8px on top; thumbnails 3px.
- Shadows go everywhere except floating layers: sheets, dialogs, dropdowns, toasts, and the landing hero card.
- Manrope gets weight 700 in addition to 400, 600 and 800.
- Press feedback uses the motion tokens: 120ms on buttons and the Play diamond, 240ms sheet in, 200ms scrim. The global reduced-motion rule stays.

### Brand assets

- `docs/brand/` and `public/brand/` logo SVGs:
  - orange `#F59A62` → `#EC8447`;
  - charcoal `#262626` → `#24221F`.
- Regenerate the favicons, the Apple icon and the PWA icons (`pnpm icons:generate`).
- The OG image uses the new colours (`og-colors.ts`) and the new tagline.

### App shell (spec 05)

- **Bottom nav:** the hexagonal panel and the cut-out Play diamond from `VISUAL_LANGUAGE.md`, "Components". The five slots, their order and their targets stay; the active section's icon is the accent.
- **Sidebar:**
  - the "Почати тренування" button with a small accent Play diamond;
  - the active row as a `--card` row with an accent diamond marker, instead of the peach pill;
  - a 1px divider to the content.
- **Status pill:**
  - Online: light, green diamond dot, "Онлайн".
  - Offline: dark (`--foreground`), accent outline diamond, "Офлайн", and the pending count as a small accent badge.
  - No "·" separator.
  - The sync sheet and real pending counts stay in specs 16 and 17. Here the pill renders both looks from its props.
- **Top bar:** unchanged apart from the tokens.

### Today (spec 05)

The current screen has no workouts yet: spec 09 adds them, and spec 12 adds the week and the rest day.

- The greeting becomes one quiet line, "Доброго ранку, Олексію. Четвер, 13 листопада", without the avatar.
- The empty state becomes the "ghost" layout (board "Ж. Тренувань ще немає"):
  - the headline "Тренувань ще немає" and its line;
  - three placeholder rows with dashed thumbnails and grey bars;
  - the hint line;
  - one "Створити перше тренування" button.
- The gym nudge card (spec 08) loses the peach circle. It shows the custom "My gym" icon inline before the title, and the button keeps its 4px style.

### Library and catalog (specs 06, 07, 08)

- The Workouts/Exercises tabs become a 4px segmented control.
- Search input, chips, the Equipment menu and checkboxes follow the radius rules.
- **Muscle families:** the 17 groups map to 6 families in one constant. Muscle chips and catalog section headings show a small family-colour diamond before the label. Exercise rows show no family colour.
- **Catalog list:**
  - on mobile, one 6px card per section with 1px dividers;
  - on desktop, the same grid with 6px cards, without shadows;
  - the "Mine" badge becomes a 4px tag.
- **Exercise details:**
  - metadata sections are 6px cards with dividers;
  - the "Gym equipment" row lists each requirement on its own line, and alternatives stay "Гантелі або гирі";
  - "Nothing special" stays one line.
  - The format changes spec 08.
- **Custom exercise form:** re-skinned only. The photo slots and the gym picker follow the radius and divider rules.

### Gym page, profile, auth, onboarding and other screens

These are re-skinned only, with no layout changes: `/profile/gym`, `/profile` with the edit sheet, `/login`, `/signup`, `/onboarding`, the start workout sheet, not-found pages, the legal placeholders and `/dev/ui`.

- Tokens, radius and shadow rules apply throughout.
- Icons on tinted circles become plain icons: `EmptyState`, the onboarding avatar picker frame, the nudge card.
- The avatar becomes a 4px square.

### Icons

- A new set of five custom icons in `src/components/icons/`: workout, set done, record, rest, my gym. They use a 24px grid, stroke 2, round caps, and `currentColor`.
- This spec uses three of them:
  - my gym: the nudge card, the Profile gym row, the `/profile/gym` header;
  - workout: the Today empty state;
  - record: the landing hero tag.
- The other two ship for specs 10 and 13.

### Landing (spec 02)

The same sections in the same order, with the treatments of board "D13. Лендинг 1440":

- **Hero:**
  - the real workout card instead of the phone mockup: rows with set-done diamonds, the offline pill, and the "3 підходи збережено…" line;
  - the "Рекорд: +5 кг" tag;
  - the meta line as a sentence.
- **Features:** a divided list under a 2px rule, each item with its custom or lucide icon and no circle.
- **How it works:** three numbered diamonds on a line.
- **Progress:** "82%" with a row of 12 diamonds; the bench line chart with an accent diamond on the last point; the BMI number.
- **Offline band:** a dark full-width band with the headline and the pending tag.
- **FAQ:** a divided list in two columns on desktop, keeping the accordion behaviour.
- **CTA:** a light panel with «Записуй наступне тренування тут» and «Почати», with a Play diamond.
- **Footer:** the new tagline.
- **Mobile:** every section stacks, and the hero card comes after the text.

### Copy

- Ukrainian uses «підходи» everywhere sets appear.
- Remove the "•" and "·" separators from UI strings.
- Use the new CTA, tagline and meta line (see Copy below).

## Out of scope

- The session screen and its dark mode (10), the week strip and the rest day on Today (12), the sync sheet and the offline strip (16, 17), real pending counts (16).
- Desktop re-layouts of the catalog, details, profile and gym page beyond tokens. Their mockups are still open in `VISUAL_LANGUAGE.md`.
- The workout, set done and record icons in product screens other than those listed. Charts and muscle-family charts belong to spec 13.
- Changing any data, API or route.

## UX

- **Mobile (390px):** one column, the hexagonal bottom nav. The Play diamond rises above the panel and never covers interactive content: the shell's bottom padding grows to clear it.
- **Desktop (≥ 1024px):** the sidebar as above; the content column keeps its current widths.
- **States:** every existing loading, error, empty and offline state keeps its behaviour and takes the new look. Skeletons use 4px and 6px shapes in `--border`, not peach.
- **Focus:** a visible 2px `--foreground` ring on every focusable control.

## Design

Canvas: <https://claude.ai/artifact/WSZjiH55W9GfncqbK4WNQe> (private to the lead).

| Board | Screen / state |
| --- | --- |
| Ж. Гострий | Today with a workout (target layout for 09/12; shows the nav, header, list and button language) |
| Ж. Тренувань ще немає | Today empty state, used now |
| Ж. Сьогодні без тренування | Rest day (spec 12) |
| Ж. Десктоп 1440 | Desktop shell: sidebar, header, content column |
| D2. Три теплі палітри, variant 2 | Palette |
| D3. Кольори мʼязів у каталозі | Catalog chips, section headings, family legend |
| D8. Власні іконки | Custom icons |
| D10. Today офлайн | Offline status pill |
| D11. Моушн | Press, sheet and set-done motion |
| D13. Лендинг 1440 | Landing |

Screens without a board are re-skinned with the same tokens and rules and keep their current layout.

## Data and API

No changes. Muscle families are a client constant in `src/constants/exercise.ts` (`MUSCLE_FAMILY`, and a map from every `MUSCLE_GROUP` to its family).

## Copy

| Where | en | uk |
| --- | --- | --- |
| Landing meta line | Free. Works on iPhone, Android and laptop. | Безкоштовно. Працює на iPhone, Android і ноутбуці. |
| Landing CTA | Log your next workout here | Записуй наступне тренування тут |
| Footer and OG tagline | A workout log that works without a signal | Журнал тренувань, який працює без мережі |
| Landing hero tag | Record: +5 kg | Рекорд: +5 кг |
| Landing hero line | 3 sets saved, will sync later | 3 підходи збережено, синхронізуємо пізніше (exists) |
| Today greeting | {{greeting}}, {{name}}. {{date}} (one line, reusing the existing greetings) | the same in uk |
| Today empty hint | Pick exercises from the catalog, set sets, reps and weight. | Обери вправи з каталогу, задай підходи, повтори й вагу. |
| Today empty | No workouts yet / Create your first workout to start training. / Create your first workout (exist) | Тренувань ще немає / Створи перше тренування, щоб почати. / Створити перше тренування (exist) |
| Status pill offline count | {{count}} pending (exists; shown in the badge without "·") | exists |
| Muscle family names | Chest, Shoulders, Back, Arms, Legs, Core | Груди, Плечі, Спина, Руки, Ноги, Прес |
| Details gym row | One requirement per line; alternatives "Dumbbells or Kettlebells" | One per line; "Гантелі або гирі" |

The removed strings are "Start training smarter today", "Track. Progress. Repeat." and "Free • Works on iPhone, Android and laptop".

## Acceptance criteria

- [ ] AC1: `globals.css` defines every token in `VISUAL_LANGUAGE.md` "Tokens", including the muscle family, `--planned` and `--border-strong` colours, with the listed values. The contrast test asserts AA (4.5:1) for `--foreground` and `--muted-foreground` on `--background` and `--card`, and for `--foreground` on `--accent`.
- [ ] AC2: No control uses a pill radius. In e2e at 390 and 1440 the computed border radius is checked:
  - 4px: a primary button, an input, a muscle chip and the status pill;
  - 6px: a catalog card;
  - 8px on top: a sheet.
  - No card on Today, the catalog or Profile has a box shadow.
- [ ] AC3: The mobile bottom nav renders the hexagonal panel and a Play diamond with an accessible name. The Play diamond is at least 44×44px, and its tap opens the start workout sheet as before. The active section's icon uses `--accent`. Content is never hidden under the diamond (the last element of a scrolled page stays fully visible).
- [ ] AC4: The desktop sidebar shows the Start button with a Play diamond, and the active row has a `--card` background and an accent diamond. It keeps `aria-current="page"`.
- [ ] AC5: The status pill:
  - with `status="online"` is light with "Online";
  - with `status="offline"` and `pendingCount={3}` is dark with "Offline" and a badge "3", has no "·", and keeps the screen-reader text "3 changes waiting to sync".
- [ ] AC6: Today shows the one-line greeting and no avatar. With no workouts it shows the ghost rows, the hint and one "Create your first workout" link to `/library/workouts`. The gym nudge card has no tinted circle.
- [ ] AC7: Every one of the 17 muscle groups maps to exactly one of the 6 families (unit test). Muscle chips and catalog section headings show the family diamond. Exercise rows do not.
- [ ] AC8: On the details page the "Gym equipment" row renders one line per requirement group, and an alternatives group as "Dumbbells or Kettlebells" (component test). `[]` renders "Nothing special". The spec 08 tests are updated to the new format.
- [ ] AC9: The five custom icons exist with `currentColor` strokes. The my gym icon appears in the nudge card and the Profile gym row. No `EmptyState`, nudge or feature item renders an icon inside a tinted circle.
- [ ] AC10: The landing:
  - the hero shows the workout card and no phone mockup;
  - the features are a divided list;
  - "How it works" has three numbered diamonds;
  - the FAQ accordion still opens one item at a time;
  - the CTA reads "Log your next workout here" / «Записуй наступне тренування тут»;
  - the footer shows the new tagline;
  - no "•" or "·" separator is visible.
- [ ] AC11: The brand SVGs use `#EC8447` and `#24221F`. The favicon, Apple icon and PWA icons are regenerated from them. The OG image uses the new colours and tagline.
- [ ] AC12: The en and uk catalogs contain no " • " or " · " separator in any value (unit test). uk uses «підход» and never «сет» for sets (unit test). `pnpm i18n:check` passes.
- [ ] AC13: At 390 and 1440, in en and uk, these pages have no horizontal scroll: landing, login, signup, onboarding, Today, the library catalog, exercise details, the new exercise form, profile and `/profile/gym`.
- [ ] AC14: With `prefers-reduced-motion: reduce` the sheet opens without a transition (e2e with emulated media). Press feedback is 120ms without it.
- [ ] AC15: Every focusable control in the shell, Today and the catalog shows a visible focus ring with keyboard navigation (e2e: Tab to the first chip, the ring is visible).

## Depends on

05, 06, 07, 08.

## Open questions

None.
