# Visual language

The look and behaviour every screen follows, agreed with the lead on 2026-11-13. It replaces the spec 01 palette and shape rules. Tokens live here; component inventory and accessibility rules stay in `DESIGN_SYSTEM.md`.

The mockups are on a private Design canvas: <https://claude.ai/artifact/WSZjiH55W9GfncqbK4WNQe>. The agreed boards are "Ж. Гострий" and its states, "Ж. Десктоп 1440", and the D2–D15 rows. The other boards record rejected directions.

The current code still uses the spec 01 tokens until spec `28-visual-refresh` ships.

## Direction

Warm and restrained. The product's character comes from its content and hierarchy, not from decoration:

- the workout is the headline of a screen;
- exercise thumbnails, the target and the last result are the visual material;
- one main action per screen;
- few cards, no tinted fills used as decoration;
- the accent marks actions and progress only.

A diamond is the brand sign. It shapes the Play button, the day and set markers, the status dot and the custom icons.

Rejected, so do not reintroduce them:

- "Training floor": cold chalk grey, a bright signal orange, huge condensed numerals;
- tonal colour fields;
- a photo used as the screen's cover;
- icons on tinted circles;
- stacks of identical rounded cards.

## Tokens

### Colour — "Warm stone"

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#ECE9E4` | Page |
| `--card` | `#F8F7F4` | Cards, sheets, inputs, the status pill |
| `--foreground` | `#24221F` | Text, primary buttons, bottom nav, logo square |
| `--muted-foreground` | `#5C5751` | Secondary text; passes AA on `--background` and `--card` |
| `--border` | `#E0DBD4` | Row dividers inside cards |
| `--border-strong` | `#D9D3CB` | Section dividers on the page |
| `--accent` | `#EC8447` | Play, done days and sets, progress, the PR marker, the active nav icon |
| `--planned` | `#AEA79F` | Outline of planned days and not-yet-done sets |
| `--success` | `#5BAA6A` | Online dot |
| `--destructive` | `#E5534B` | Missed, errors, delete |

- `--accent-soft` (peach) is retired except as one of the avatar colours.
- Text on `--accent` is `--foreground`.
- Never put white text on the accent.

### Muscle families

The 17 muscle groups fold into 6 families. A colour always sits next to its name, never alone.

| Family | Colour | Groups |
| --- | --- | --- |
| Chest | `#C9786B` | chest |
| Shoulders | `#C9A24E` | shoulders, traps, neck |
| Back | `#6F8FA8` | lats, middle back, lower back |
| Arms | `#9A7AA0` | biceps, triceps, forearms |
| Legs | `#7F9A72` | quadriceps, hamstrings, glutes, calves, adductors, abductors |
| Core | `#5E9A96` | abdominals |

Use: filter chips and section headings (a small diamond before the label) and charts (shares of weekly volume). Exercise rows carry no muscle colour.

### Dark session (spec 10)

The active session screen follows the system theme. Every other screen stays light in the MVP.

| Token | Value |
| --- | --- |
| background | `#1E1C1A` |
| surface | `#2A2724` |
| input field | `#353130` |
| text | `#F3F1EC` |
| secondary text | `#B3ACA3` |
| divider | `#3A3633` |
| primary button | `#F3F1EC` with `#1E1C1A` text |

The accent stays `#EC8447`.

### Type — Manrope

Manrope stays (`latin` + `cyrillic`, weights 400/600/700/800) and keeps tabular figures for numbers.

| Role | Size / weight |
| --- | --- |
| Screen headline (workout name, page title) | 30 / 800 (36 on desktop, up to 72 on the landing hero) |
| Section heading | 16–20 / 700–800 |
| Row title | 16 / 700 |
| Target and values ("80 кг × 8") | 15 / 600, the same style everywhere; no big display numerals |
| Body, secondary | 15 / 400, minimum 14 |
| Session inputs | 28 / 800 |

### Shape

| Element | Radius |
| --- | --- |
| Cards, panels | 6px |
| Sheets (top corners) | 8px |
| Buttons, inputs, chips, pills, avatar, logo square | 4px |
| Thumbnails | 3px |
| Diamonds (rotated squares) | 2px small, 8px for Play |

- Depth comes from tone and 1px dividers.
- A shadow is only for what floats over content: sheets, toasts, the landing hero card.

### Motion

| Kind | Duration |
| --- | --- |
| Press (buttons, Play) | 120ms, scale 0.98 / Play 0.92 |
| Sheet in / scrim | 240ms / 200ms |
| Set done "click" | 220ms: the diamond scales 0.55 → 1.18 → 1 and fills with the accent |
| Rest timer ring | linear for the rest duration, no pulsing |

- No entrance animations for sections, no hover effects on cards, no page transitions.
- Under `prefers-reduced-motion` every animation is off and the state changes at once.

## Components

### Bottom nav (mobile)

The structure is unchanged: Calendar, Library, Play, Progress, Profile.

- **Panel.** A hexagon: 45° chamfers on the top corners (20px), each joint slightly rounded. It is drawn as an SVG path so the corners stay soft. Fill `--foreground`.
- **Play.** A 60px accent diamond with an 8px radius. It rises 44px above the panel and has a 5px `--background` border, so it looks cut out of the panel. The play triangle inside has rounded corners.
- **Icons.** Lucide, stroke 2, round caps and joins, in `--card`. The active section's icon is the accent.

### Sidebar (desktop)

- The logo, then a dark "Почати тренування" button with a small accent Play diamond, then the sections.
- The active section has a `--card` row with a 4px radius and an accent diamond marker on the right.
- A 1px `--border` separates the sidebar from the content.

### Status pill

- Online: `--card`, a green diamond dot, "Онлайн".
- Offline: `--foreground` with an accent outline diamond, "Офлайн" and a pending counter. It is a button that opens the sync sheet.

### Lists

- Rows sit inside one card, separated by 1px dividers.
- A row is a link with a chevron, at least 64px tall. It holds a thumbnail, a title, a secondary line, and the value on the right.
- Long lists collapse to the first 3–4 rows plus "Ще N вправ".
- On desktop a workout's exercises become a table: Exercise / Sets / Target / Last time.

### Icons

- Lucide for everything generic.
- Five custom icons on the diamond, in the same 24px grid, stroke 2, round caps:
  - **Workout:** a dumbbell with diamond plates.
  - **Set done:** a diamond with a check; done is accent-filled, pending is a `--planned` outline.
  - **Record:** a diamond with an up arrow; it replaces the trophy.
  - **Rest:** a stopwatch with a diamond button.
  - **My gym:** a plate with a diamond hole.
- No icon on a tinted circle anywhere.

## Screen rules

- **Today.**
  - A quiet greeting line with the date. There is no avatar on Today.
  - The workout card: name, "N вправ, близько M хв", rows, and one "Почати тренування" button.
  - Below it, the week: 7 days with diamonds (done accent, today a dark outline, planned a `--planned` outline) and "N з M".
- **Empty states.** Show a ghost of the content to come (dashed thumbnails, grey bars in the real layout), one sentence, and one action. Never an icon in a bubble.
- **Rest day.** "Сьогодні відпочинок", a hint that Play starts any workout, and a card for the next workout with thumbnails and "Переглянути тренування".
- **Offline.**
  - The dark status pill plus a quiet strip: "Ти офлайн" and how many changes are saved on the phone.
  - Actions that need the network are disabled with "Потрібен інтернет". Starting a session stays enabled.
  - A missing cached photo becomes a grey "Фото офлайн" tile.
- **Desktop.** Sidebar, then the main card on the left with a narrower column on the right (week, next workout). Never a stretched mobile column.
- **Landing.** The structure is unchanged, with these treatments:
  - the hero shows the real workout UI instead of a phone mockup;
  - features are a divided list with custom icons, not cards;
  - "How it works" uses numbered diamonds on a line, because it is a real sequence;
  - progress is shown as diamonds, a line chart with an accent diamond on the last point, and the BMI number;
  - the dark full-width offline band stays;
  - the FAQ is a divided list;
  - the final CTA is a light panel.

## Copy rules

- Ukrainian uses «підходи» for sets, as the existing catalogs do. Never «сети».
- No middle-dot or bullet separators in meta lines. Use a sentence ("Безкоштовно. Працює на iPhone, Android і ноутбуці.") or separate lines.
- The details page "Gym equipment" row lists each requirement on its own line; alternatives stay "Гантелі або гирі". This changes spec 08.
- Landing CTA: «Записуй наступне тренування тут». Footer and OG tagline: «Журнал тренувань, який працює без мережі».
- Tone:
  - informal "ти", short sentences, no exclamation marks;
  - an error says what happened and what to do;
  - an empty screen invites one action.

### Draft strings

These are drafts from the mockups. Each is confirmed in the `/drill` of the spec that owns the screen.

| Where | uk | Spec |
| --- | --- | --- |
| Today, no workouts | Тренувань ще немає / Створи перше тренування, щоб почати. / Обери вправи з каталогу, задай підходи, повтори й вагу. / Створити перше тренування | 09 |
| Today, week with no plan | Тут зʼявиться твій план, коли поставиш тренування в календар. | 12 |
| Today, rest day | Сьогодні відпочинок / За планом тренування немає. Хочеш позайматися, натисни Play. / Наступне тренування, N вправ / Переглянути тренування | 12 |
| Offline strip | Ти офлайн / Тренуйся як завжди. N змін збережено на телефоні, синхронізуємо їх, щойно зʼявиться мережа. | 16 |
| Sync sheet | Чекають синхронізації / Остання синхронізація / Підходи, тренування й заміри зберігаються на телефоні. Не виходь з акаунта, поки зміни не синхронізуються, інакше вони загубляться. / Синхронізувати зараз | 16 |
| Cached photo missing | Фото офлайн | 17 |

## Constraints

- Contrast AA for all text, including 13–14px secondary text.
- Touch targets at least 44px, 48px in the session.
- Colour is never the only signal: a diamond's fill or outline, or a label, carries the state.
- Every font supports Cyrillic. Ukrainian labels must fit without horizontal scroll at 390px.
- `prefers-reduced-motion` turns every animation off.
- Only lucide plus the five custom icons. No emoji as icons; emoji stay only in avatars.

## Open questions

- **Desktop for the rest of the app.** Catalog, details, profile and My gym have no desktop mockups yet.
- **Final copy** for the draft strings above, in their specs.
- **Catalog photo rights.** The new layout shows more of them. This is still open from the 2026-11-10 decision and must be settled before a public launch.

Resolved on 2026-11-13: the refresh ships as spec `28-visual-refresh` (including the OG image), the logo moves to `--accent`, and the status markers are confirmed (`DESIGN_SYSTEM.md`).
