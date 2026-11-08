# 01. Design system and app foundations

## Goal

The warm Pampojo look as tokens and a few base components, plus i18n in English and Ukrainian, so every screen after this is built from the same parts.

## Scope

### Tokens and type

- Tokens from `docs/tech/DESIGN_SYSTEM.md` as CSS variables in `src/app/globals.css` and in the Tailwind theme. shadcn components pick them up. Values stay as documented.
- Avatar background tokens `--avatar-1` … `--avatar-8` (see "Avatar palette" below).
- Remove the `.dark` block that `shadcn init` wrote; dark theme is out of scope.
- Font: **Manrope** through `next/font/google`, weights 400, 600, 800, subsets `latin` and `cyrillic`. It replaces Plus Jakarta Sans, which has no basic Cyrillic on Google Fonts (Nunito was tried first and found too soft). Numbers in stats and session mode use tabular figures (`tabular-nums`).
- `prefers-reduced-motion` turns off non-essential animation (shadcn/`tw-animate-css` transitions).

### shadcn components

Add: button, input, label, card, tabs, dialog, sheet, dropdown-menu, sonner (toast), progress, skeleton, and the shadcn form building block (`form` or its current replacement `field`, `/scratch` picks). The `Toaster` is mounted once in the root layout.

### Button

- Variants: `primary` (charcoal bg, cream text), `accent` (peach bg, charcoal text), `secondary` (card-colored pill with soft shadow), `ghost`.
- Sizes (height): `sm` 44px, `md` 48px (default), `lg` 56px, `xl` 72px (session mode), `icon` 48×48 rounded square.
- All buttons are pills, except `icon`.

### App components (`src/components/`, presentation only, props in, no stores)

- **`EmojiAvatar`**: an emoji on a colored circle.
  - Props: `emoji` (id from the palette), `color` (1–8), `size` `sm` 32px / `md` 48px / `lg` 80px, optional `label`.
  - `role="img"`. The accessible name is `label` when given (for example the user's name). Otherwise it is the emoji's name in the active language.
- **`StatCard`**: a card with:
  - `label`;
  - `value`;
  - optional `unit`;
  - optional `trend` (`up` / `down` plus a short text such as `-0.6`);
  - optional `children` slot for a chart.
- **`SegmentedGauge`**: an arc of 10 rounded blocks.
  - Props: `value` 0–100 (clamped) and `label`.
  - Filled blocks = `Math.round(value / 10)`. Filled blocks use `--accent`, empty ones `--accent-soft`.
  - The percent (for example `82%`) is shown in the center.
  - Accessibility: `role="meter"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow`, `aria-valuetext="82%"`; the accessible name is `label`.
- **`StatusPill`** (visual only; specs 05 and 17 connect real state). Props: `status` `online` | `offline`, `pendingCount` (default 0). Online has a `--success` dot; offline has an offline icon. Color is never the only signal.
- **`PageHeader`**: `title` (renders `<h1>`), optional `subtitle`, optional `actions` slot on the right. On mobile the actions wrap under the title.
- **`LanguageSwitcher`**: a dropdown listing `English` and `Українська`. Selecting a language sets the cookie and reloads the current page at the same URL, now in that language.

### Avatar palette

24 emoji, ids are kebab-case English names. 8 background colors. Stored values (spec 04) are the emoji id and the color number.

| Id | Emoji | en | uk |
| --- | --- | --- | --- |
| `fox` | 🦊 | Fox | Лисиця |
| `bear` | 🐻 | Bear | Ведмідь |
| `panda` | 🐼 | Panda | Панда |
| `koala` | 🐨 | Koala | Коала |
| `tiger` | 🐯 | Tiger | Тигр |
| `lion` | 🦁 | Lion | Лев |
| `frog` | 🐸 | Frog | Жаба |
| `monkey` | 🐵 | Monkey | Мавпа |
| `penguin` | 🐧 | Penguin | Пінгвін |
| `owl` | 🦉 | Owl | Сова |
| `octopus` | 🐙 | Octopus | Восьминіг |
| `unicorn` | 🦄 | Unicorn | Єдиноріг |
| `peach` | 🍑 | Peach | Персик |
| `orange` | 🍊 | Orange | Апельсин |
| `lemon` | 🍋 | Lemon | Лимон |
| `watermelon` | 🍉 | Watermelon | Кавун |
| `avocado` | 🥑 | Avocado | Авокадо |
| `cherries` | 🍒 | Cherries | Вишні |
| `weightlifter` | 🏋️ | Weightlifter | Штангіст |
| `boxing-glove` | 🥊 | Boxing glove | Боксерська рукавиця |
| `cyclist` | 🚴 | Cyclist | Велосипедист |
| `runner` | 🏃 | Runner | Бігун |
| `lightning` | ⚡ | Lightning | Блискавка |
| `fire` | 🔥 | Fire | Вогонь |

| Token | Name | Value |
| --- | --- | --- |
| `--avatar-1` | peach | `#FBD9C3` |
| `--avatar-2` | apricot | `#F9C9A0` |
| `--avatar-3` | butter | `#F6E3A1` |
| `--avatar-4` | sage | `#CFE3C8` |
| `--avatar-5` | mint | `#C5E6DE` |
| `--avatar-6` | sky | `#C9DDF0` |
| `--avatar-7` | lavender | `#DCD3EE` |
| `--avatar-8` | rose | `#F3C9CF` |

### Brand

- Copy `docs/brand/*.svg` to `public/brand/`.
- Favicon set and apple-touch icon (180×180 PNG) generated once from `pampojo-icon.svg` and committed. They use the Next.js file conventions (`src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/favicon.ico`) and replace the `create-next-app` favicon. PWA manifest icons are spec 15.

### i18n

- `i18next` + `react-i18next`. Two locales from day one: `en` and `uk`. The key is the English source string (`docs/development/frontend/overview.md`).
- Catalogs: one JSON per locale, committed.
  - `pnpm i18n:extract` updates both from the source code: new keys are added, unused keys are removed.
  - The tool is `i18next-parser` or its maintained successor, `/scratch` picks.
- `pnpm i18n:check` fails when the `uk` catalog has a key missing from `en`, or an empty value. It runs in CI. Every spec's Copy section gives `en` and `uk` text. The agent proposes the Ukrainian, and the lead reviews it during `/drill` or `/review`.
- Locale resolution, on the server, so the first paint is already in the right language:
  1. cookie `lang` (`en` | `uk`) if set;
  2. otherwise `Accept-Language`: `uk` if Ukrainian is preferred over English, otherwise `en`.
- No locale in URLs. The routes stay `/today`, `/library`, …. `src/proxy.ts` resolves the locale and rewrites internally to a hidden `[lang]` root segment (`/today` → `/uk/today`), so pages stay statically prerendered per locale under Cache Components.
- `<html lang>` matches the active locale.
- Numbers and dates format through `Intl` with the active locale (for example `24,8` in `uk`). A small formatting helper lives next to the i18n setup.
- ESLint enforces the static-key rule: `t()` with a first argument that is not a string literal is an error.
- ESLint forbids hex color literals (`#rgb`, `#rrggbb`, `#rrggbbaa`) in `src/**/*.{ts,tsx}`; colors come from tokens.

### Dev page

`/dev/ui` shows the tokens and components. It returns 404 when `VERCEL_ENV === 'production'` and works everywhere else (`pnpm dev`, local `pnpm start`, Vercel previews). It is not linked from anywhere.

## Out of scope

- Dark theme.
- Navigation, top bar, real connectivity state (05, 17).
- Placing `LanguageSwitcher` on real screens: landing footer (02). The profile language setting has no owner yet: spec 04 excludes it; assign it when drilling 04.
- Avatar picker (04).
- Fixing contrast of `--muted-foreground` on `--background` (3.98:1) and of `--destructive` text (3.5:1). AA is required only for text on `--accent` and `--accent-soft`.
- PWA manifest icons (15).

## UX

`/dev/ui` is one scrolling page on `--background`, with a `PageHeader` ("Design system") and the `LanguageSwitcher` in its actions. Sections:

1. **Colors**: a swatch per token with its name and value. The swatch shows the value read from the CSS variable at runtime, not a hard-coded hex.
2. **Type**: the scale (display, h1, h2, h3, body, small, numbers with tabular figures). A Ukrainian sample line `Ґанок, їжак, єнот, ірис` in each weight.
3. **Buttons**: every variant × size, plus a disabled example per variant.
4. **Inputs**: input with label, input with an error message.
5. **Cards**: plain card, two `StatCard`s (`BMI 24.8` with trend `down` `-0.6`; `Workouts this month 12`).
6. **Gauge**: `SegmentedGauge` at 0, 50, 82 and 100.
7. **Avatars**: all 24 emoji in a grid, the 8 colors, and the three sizes.
8. **Status**: `StatusPill` online, offline, and offline with 3 pending.
9. **Overlays**: buttons that open a dialog, a sheet, a dropdown menu and a toast; tabs; progress at 60%; skeletons.

Layout: one column with a 16px gutter on mobile (390px); a 2-column grid for sections on desktop (1440px), max width 1200px. No horizontal scroll at either width.

## Copy

| Where | en | uk |
| --- | --- | --- |
| `/dev/ui` title | Design system | Дизайн-система |
| Section headings | Colors / Type / Buttons / Inputs / Cards / Gauge / Avatars / Status / Overlays | Кольори / Типографіка / Кнопки / Поля / Картки / Шкала / Аватари / Статус / Оверлеї |
| Sample input label | Name | Ім'я |
| Sample input error | This field is required | Це поле обов'язкове |
| Sample StatCard labels | BMI / Workouts this month | ІМТ / Тренувань цього місяця |
| Sample gauge label | Plan adherence | Виконання плану |
| Overlay demo buttons | Open dialog / Open sheet / Open menu / Show toast | Відкрити діалог / Відкрити панель / Відкрити меню / Показати сповіщення |
| Toast demo text | Saved | Збережено |
| `StatusPill` online | Online | Онлайн |
| `StatusPill` offline | Offline | Офлайн |
| `StatusPill` with pending (any status, count > 0) | `{status} · {count} pending` | `{status} · {count} в черзі` |
| `StatusPill` screen-reader text for pending | `{count} change waiting to sync` / `{count} changes waiting to sync` | `{count} зміна чекає синхронізації` / `{count} зміни чекають синхронізації` / `{count} змін чекають синхронізації` (i18next plural forms one/few/many) |
| `LanguageSwitcher` accessible name | Language | Мова |
| `LanguageSwitcher` options | English / Українська | English / Українська (native names, not translated) |
| Emoji names | see Avatar palette | see Avatar palette |

## Data and API

No database or API changes. The `lang` cookie is a UI preference only: path `/`, one year, `SameSite=Lax`, not `HttpOnly` (the client switcher writes it).

## Acceptance criteria

- [ ] AC1: `/dev/ui` shows every section listed in UX: colors, type scale, buttons in all variants and sizes, inputs, cards, the gauge at 0/50/82/100%, all 24 avatars and 8 colors, `StatusPill` online / offline / offline with 3 pending, and the overlay demos, which open.
- [ ] AC2: ESLint reports an error for a hex color literal in a `.ts`/`.tsx` file under `src/`, and `pnpm lint` passes on the code base.
- [ ] AC3: The HTML head of `/` has a favicon link and an `apple-touch-icon` link. Both files return 200 and are built from `pampojo-icon.svg`.
- [ ] AC4: A string rendered through `t()` appears in both the `en` and `uk` catalogs after `pnpm i18n:extract`.
- [ ] AC5: `pnpm i18n:check` fails when a key is missing or empty in `uk`, and passes on the committed catalogs. CI runs it.
- [ ] AC6: ESLint reports an error for `t(variable)` or `` t(`template`) ``.
- [ ] AC7: A first visit with `Accept-Language: uk` renders `/dev/ui` in Ukrainian with `<html lang="uk">`. A visit with `Accept-Language: en-US` renders English with `lang="en"`.
- [ ] AC8: Choosing a language in `LanguageSwitcher` sets the `lang` cookie and reloads the same URL in that language. The choice survives later reloads, and the cookie wins over `Accept-Language`.
- [ ] AC9: Charcoal text on `--accent` and on `--accent-soft` meets WCAG AA (≥ 4.5:1). A test computes this from the token values in `globals.css`.
- [ ] AC10: Component tests cover:
  - `SegmentedGauge` at 82: a `meter` named by its label, with `aria-valuetext="82%"`, the visible text `82%` and 8 of 10 blocks filled. Values below 0 and above 100 are clamped.
  - `EmojiAvatar`: the accessible name is the `label` when given; otherwise it is the emoji name in the active language (`Fox` / `Лисиця`).
  - `StatusPill`: each state shows the copy above, including the Ukrainian plural forms for 1, 3 and 5.
- [ ] AC11: Manrope renders Ukrainian text: on `/dev/ui`, `document.fonts.check('16px Manrope', 'ґїєі')` is true and the body font-family resolves to Manrope.
- [ ] AC12: `/dev/ui` returns 404 when `VERCEL_ENV=production` and 200 otherwise.
- [ ] AC13: `/dev/ui` has no horizontal scroll at 390px and 1440px.

## Depends on

00.

## Open questions
