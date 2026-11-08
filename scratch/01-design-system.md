# 01-design-system — technical plan

Spec: `docs/specs/01-design-system.md`

## 1. Summary

Give the empty app its warm look and two languages:

- **Theme**: Pampojo tokens in `globals.css` (shadcn variables re-pointed to our hex values, plus `--accent-soft`, `--success` and `--avatar-1…8`), Nunito (latin + cyrillic), no dark theme.
- **Components**: shadcn primitives with custom `Button` variants, and six app components (`EmojiAvatar`, `StatCard`, `SegmentedGauge`, `StatusPill`, `PageHeader`, `LanguageSwitcher`).
- **Brand**: favicons generated from the brand SVG.
- **i18n**: i18next with `en` and `uk` catalogs. A proxy picks the locale from the `lang` cookie or `Accept-Language` and rewrites internally to a hidden `[lang]` root segment, so URLs stay unprefixed and pages stay static per locale.
- **Lint rules**: no hex colors and static `t()` keys.
- **`/dev/ui`**: a showcase page, 404 on Vercel production.

Existing code to build on (from spec 00):

- `src/app/layout.tsx`, `src/app/(marketing)/page.tsx` + its browser test, `src/app/globals.css` (shadcn radix-nova defaults), `src/app/favicon.ico` (create-next-app), `components.json` (radix-nova, neutral), `src/lib/utils.ts` (`cn` from the `cn` package), no shadcn components.
- `src/test/render.tsx` with an empty `AppProviders`.
- `eslint.config.mjs`, `vitest.config.ts` (projects `node` for `*.test.ts`, `browser` for `*.test.tsx`), `playwright.config.ts` (`mobile`, `desktop`).
- CI workflows `.github/workflows/ci.yml` and `main.yml` share the steps lint → format:check → typecheck → test → build.
- Next 16.4 with `cacheComponents: true`. `next.config.ts` calls `parseEnv(process.env)`.

## 2. Acceptance criteria

- AC1: `/dev/ui` renders nine sections, each with a visible `<h2>`: Colors, Type, Buttons, Inputs, Cards, Gauge, Avatars, Status, Overlays.
  - Buttons: every variant (`primary`, `accent`, `secondary`, `ghost`) in every size (`sm`, `md`, `lg`, `xl`, `icon`), plus one disabled button per variant.
  - Gauge: `SegmentedGauge` at 0, 50, 82 and 100.
  - Avatars: all 24 avatars, the 8 color swatches, and sizes sm/md/lg.
  - Status: `StatusPill` online, offline, and offline with 3 pending.
  - Overlays: the dialog, sheet, dropdown menu and toast open when their demo buttons are clicked.
- AC2: ESLint reports `no-restricted-syntax` for a string or template literal containing a hex color (`#abc`, `#aabbcc`, `#aabbccdd`) in any `src/**/*.{ts,tsx}` file ESLint checks. `pnpm lint` passes on the repo.
- AC3: The `<head>` of `/` contains `<link rel="icon">` and `<link rel="apple-touch-icon">`. Their `href`s return 200. The files come from `docs/brand/pampojo-icon.svg`.
- AC4: The key `Design system`, rendered through `t()` on `/dev/ui`, exists in both `src/i18n/locales/en.json` and `uk.json`. `pnpm i18n:extract` leaves the committed catalogs unchanged (`--ci` mode exits 0).
- AC5: `pnpm i18n:check` exits non-zero when a key from `en.json` is missing in `uk.json`, when a `uk` value is empty, or when a `uk` plural key lacks a form `Intl.PluralRules('uk')` needs (`one`, `few`, `many`, `other`). It exits 0 on the committed catalogs. CI runs it.
- AC6: ESLint reports `no-restricted-syntax` for `t(variable)`, `` t(`text`) `` and `i18n.t(variable)`. `t('literal')` passes.
- AC7: With `Accept-Language: uk-UA,uk;q=0.9` and no cookie, `/dev/ui` has `<html lang="uk">` and the heading `Дизайн-система`. With `Accept-Language: en-US`, it has `lang="en"` and `Design system`.
- AC8: Choosing `Українська` in the `LanguageSwitcher` writes `lang=uk` (path `/`, max-age one year, SameSite Lax) and reloads the same URL, which now shows Ukrainian. The choice survives another reload. With cookie `lang=uk` and `Accept-Language: en-US`, the page is Ukrainian.
- AC9: A test reads `--foreground`, `--accent` and `--accent-soft` from `src/app/globals.css` and asserts a WCAG contrast ≥ 4.5 for foreground on accent and foreground on accent-soft.
- AC10: Browser component tests:
  - `SegmentedGauge` with `value={82} label="Plan adherence"` renders `getByRole('meter', { name: 'Plan adherence' })` with `aria-valuetext="82%"`, visible text `82%`, and exactly 8 of 10 blocks marked filled (`data-filled="true"`). Values -5 and 140 render 0% and 100%.
  - `EmojiAvatar` uses `label` as the accessible name when given. Without a label, the name is `Fox` in `en` and `Лисиця` in `uk`.
  - `StatusPill`: online shows `Online`, offline shows `Offline`, and offline with 3 shows `Offline · 3 pending`. In `uk`, the screen-reader sentences for 1, 3 and 5 are `1 зміна чекає синхронізації`, `3 зміни чекають синхронізації` and `5 змін чекають синхронізації`.
- AC11: On `/dev/ui`, after `document.fonts.ready`, the first family in `getComputedStyle(document.body).fontFamily` contains `Nunito`, and `document.fonts.check('16px <that family>', 'ґїєі')` is true.
- AC12: `isDevUiEnabled({ VERCEL_ENV: 'production' })` is false. For `preview`, `development` and an unset value it is true. The page calls `notFound()` when it is false. `/dev/ui` returns 200 in the e2e run.
- AC13: On `/dev/ui`, `document.documentElement.scrollWidth <= window.innerWidth` in both the `mobile` (390) and `desktop` (1440) projects.

## 3. Data

No database changes.

Static data in code:

- `src/constants/avatar.ts`:
  - `AVATAR_EMOJI`: an `as const` object of 24 entries, id → emoji character, in this order: `fox` 🦊, `bear` 🐻, `panda` 🐼, `koala` 🐨, `tiger` 🐯, `lion` 🦁, `frog` 🐸, `monkey` 🐵, `penguin` 🐧, `owl` 🦉, `octopus` 🐙, `unicorn` 🦄, `peach` 🍑, `orange` 🍊, `lemon` 🍋, `watermelon` 🍉, `avocado` 🥑, `cherries` 🍒, `weightlifter` 🏋️, `boxing-glove` 🥊, `cyclist` 🚴, `runner` 🏃, `lightning` ⚡, `fire` 🔥.
  - `AvatarEmojiId = keyof typeof AVATAR_EMOJI`.
  - `AVATAR_COLORS = [1,2,3,4,5,6,7,8] as const`, with `AvatarColor`.
  - Spec 04 will build the Zod schema from these. It lives in `src/constants`, because profile, Today and the picker are independent areas.
- The `lang` cookie: `en` | `uk`. `LOCALES = ['en', 'uk'] as const`, `DEFAULT_LOCALE = 'en'`, `LOCALE_COOKIE = 'lang'` in `src/i18n/config.ts`.

## 4. API

No API changes. `/api/*` stays outside the `[lang]` segment, and the proxy never touches it.

## 5. Server

### Locale resolution — `src/i18n/resolve-locale.ts` (pure, no imports from Next)

```ts
export function resolveLocale(input: { cookie?: string; acceptLanguage?: string | null }): Locale
```

- A valid cookie (`en` | `uk`) wins.
- Otherwise, parse `Accept-Language` into `{ tag, q }` with q defaulting to 1, and sort by q descending (stable).
- Walk the list. The first entry whose primary subtag (`uk-UA` → `uk`, `en-GB` → `en`) is in `LOCALES` decides. `*` or nothing → `en`.
- So `uk` wins only when it is preferred over English; `ru,uk;q=0.8,en;q=0.5` → `uk`.

### Proxy — `src/proxy.ts`

- `matcher` excludes `api`, `_next`, `brand/`, and any path with a file extension (`favicon.ico`, `icon.svg`, `apple-icon.png`, …).
- If the path already starts with `/en` or `/uk` (exact segment), redirect (307) to the path without it and set the `lang` cookie to that locale. Prefixed URLs are never canonical.
- Otherwise `locale = resolveLocale({ cookie, acceptLanguage })` and `NextResponse.rewrite(new URL('/' + locale + pathname + search, request.url))`.
- No cookie is written on rewrite. The cookie is only set by the user's choice (switcher) or a prefixed URL.

### Server translation — `src/i18n/server.ts`

- `import { lang } from 'next/root-params'`.
- `getI18n()` returns `{ locale, t }` for the current request's locale. It uses one i18next instance per locale, created once and cached in a module-level map, with `createInstance` and `init({ lng, resources, fallbackLng: false, keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false } })`.
- Used by route files for `metadata` and by any server component text.

### Catalogs — `src/i18n/locales/en.json`, `uk.json`

- Flat JSON, key = English source string.
- `en` values equal the key, except plural forms: `<key>_one`, `<key>_other`.
- `uk` has `_one`, `_few`, `_many`, `_other` for plural keys.

### Formatting — `src/i18n/format.ts`

`formatNumber(locale, value, options?)` and `formatPercent(locale, value)` (with `value` 0–100) wrap `Intl.NumberFormat`. `useFormat()` in `src/i18n/client.tsx` binds them to the active locale.

## 6. Client

### Routing move

- `src/app/layout.tsx` → `src/app/[lang]/layout.tsx` (root layout):
  - `generateStaticParams` returns `[{ lang: 'en' }, { lang: 'uk' }]`;
  - `const locale = await lang()`; if `!isLocale(locale)` then `notFound()`;
  - `<html lang={locale}>` with the Nunito variable class;
  - loads the catalog with a static `import` map `{ en: () => import('@/i18n/locales/en.json'), uk: … }`;
  - wraps children in `<I18nProvider locale={locale} resources={catalog}>`;
  - renders `<Toaster />`;
  - `generateMetadata` gives the title `Pampojo`.
- `src/app/(marketing)/page.tsx` → `src/app/[lang]/(marketing)/page.tsx`, unchanged markup. The `__tests__` move with it.
- `src/app/api/**` stays in place.
- No `src/app/layout.tsx` remains.

### Font

`next/font/google` `Nunito({ subsets: ['latin', 'cyrillic'], weight: ['400', '600', '800'], variable: '--font-nunito', display: 'swap' })` in `src/app/[lang]/layout.tsx`. In `globals.css`: `@theme inline { --font-sans: var(--font-nunito), ui-sans-serif, system-ui, sans-serif; }`, and `html { @apply font-sans; }`.

### Theme — `src/app/globals.css`

Replace the shadcn oklch values in `:root` with:

| Variable | Value |
| --- | --- |
| `--background` | `#F2ECE4` |
| `--foreground`, `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground` | `#262626` |
| `--card`, `--popover`, `--secondary` | `#FBF8F4` |
| `--primary` | `#262626` |
| `--primary-foreground` | `#FBF8F4` |
| `--muted` | `#FBD9C3` (same as accent-soft) |
| `--muted-foreground` | `#7A736C` |
| `--accent` | `#F59A62` |
| `--accent-soft` | `#FBD9C3` (new) |
| `--success` | `#5BAA6A` (new) |
| `--destructive` | `#E5534B` |
| `--border`, `--input` | `#E6DED4` |
| `--ring` | `#F59A62` |
| `--chart-1` | `#F59A62` |
| `--chart-2` | `#FBD9C3` |
| `--chart-3` | `#262626` |
| `--chart-4` | `#7A736C` |
| `--chart-5` | `#5BAA6A` |
| `--radius` | `24px` |
| `--avatar-1`…`--avatar-8` | `#FBD9C3 #F9C9A0 #F6E3A1 #CFE3C8 #C5E6DE #C9DDF0 #DCD3EE #F3C9CF` |
| sidebar variables | the same values as their non-sidebar counterparts |

- Add `--color-accent-soft`, `--color-success` and `--color-avatar-1…8` to `@theme inline`.
- Add `--shadow-soft: 0 8px 24px rgb(38 38 38 / 0.06)` as the theme shadow `shadow-soft`.
- Delete the `.dark { … }` block and the `@custom-variant dark` line.
- Add `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`.

### shadcn components

Run `pnpm dlx shadcn@4.23.0 add button input label card tabs dialog sheet dropdown-menu sonner progress skeleton field`. Use `form` if `field` does not exist in the radix-nova registry. Generated files land in `src/components/ui/`, which ESLint ignores.

The generated `sonner.tsx` imports `next-themes`. Drop that import, use `theme="light"`, and do not add `next-themes`.

**Button** (`src/components/ui/button.tsx`), changed through its `cva` variants only:

| Variant | Classes (intent) |
| --- | --- |
| `primary` (default) | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `accent` | `bg-accent text-accent-foreground hover:bg-accent/90` |
| `secondary` | `bg-card text-foreground shadow-soft hover:bg-card/80` |
| `ghost` | `bg-transparent hover:bg-accent-soft` |

| Size | Classes |
| --- | --- |
| `sm` | `h-11 px-4 text-sm` |
| `md` (default) | `h-12 px-6 text-base` |
| `lg` | `h-14 px-8 text-lg` |
| `xl` | `h-[72px] px-10 text-xl font-extrabold` |
| `icon` | `size-12 rounded-2xl` |

- Every size except `icon` is `rounded-full`. Disabled state: `disabled:opacity-50 disabled:pointer-events-none`. Focus ring: `focus-visible:ring-2 ring-ring`.
- Remove shadcn's `default` / `outline` / `destructive` / `link` variants. If a generated component references a removed variant, map it: `outline` → `secondary`, `default` → `primary`. Record this in the notes.

**Input**: pill (`rounded-full h-12 bg-card px-5`); invalid state `aria-invalid:ring-destructive`.

### App components — `src/components/<Name>/` (folder per component: `<Name>.tsx`, `index.ts`, `__tests__/`)

All are client components (`'use client'`), because they translate via `useTranslation`.

- **`EmojiAvatar`**
  - Props: `{ emoji: AvatarEmojiId; color: AvatarColor; size?: 'sm' | 'md' | 'lg'; label?: string; className?: string }`.
  - Markup: `<span role="img" aria-label={label ?? names[emoji]}>` with the background `bg-avatar-{n}`, using a static class map (no class built from a string), and size 32/48/80px with emoji font-size about 55%.
  - The inner emoji is `aria-hidden`.
  - `names` comes from `useAvatarEmojiNames()` in `src/components/EmojiAvatar/useAvatarEmojiNames.ts`. That is a `useMemo` map of id → `t('Fox')` … for all 24 entries, with literal keys.
- **`StatCard`**
  - Props: `{ label: string; value: string; unit?: string; trend?: { direction: 'up' | 'down'; text: string }; children?: ReactNode }`.
  - Markup: `Card` with `rounded-[24px] shadow-soft`; the label in `text-muted-foreground text-sm`; the value `text-3xl font-extrabold tabular-nums`; the trend has an arrow icon (`ArrowUp` / `ArrowDown` from lucide, `aria-hidden`) plus the text, so color is not the only signal.
  - Callers pass translated, formatted strings.
- **`SegmentedGauge`**
  - Props: `{ value: number; label: string; className?: string }`.
  - `clamped = Math.min(100, Math.max(0, Math.round(value)))`, `filled = Math.round(clamped / 10)`.
  - An SVG half-arc (180°) of 10 rounded-rect blocks, rotated along the arc. Filled ones use `fill-accent` with `data-filled="true"`, the others `fill-accent-soft` with `data-filled="false"`.
  - The center text `formatPercent(locale, clamped)` (`82%`, uk `82 %`) is `aria-hidden`.
  - The wrapper is `role="meter"` with `aria-label={label}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={clamped}`, `aria-valuetext={formatPercent(...)}`.
  - Responsive width: `w-full max-w-[240px]`, `viewBox`-based.
- **`StatusPill`**
  - Props: `{ status: 'online' | 'offline'; pendingCount?: number }`.
  - Markup: a pill `inline-flex h-8 rounded-full bg-card shadow-soft px-3 text-sm font-semibold`.
    - Online: a `bg-success` dot (`aria-hidden`) and `t('Online')`.
    - Offline: the lucide `WifiOff` icon (`aria-hidden`) and `t('Offline')`.
  - If `pendingCount > 0`, append ` · ` and `t('{{count}} pending', { count })`. That part is `aria-hidden`, and next to it goes a `sr-only` span with `t('{{count}} change waiting to sync', { count })`.
  - Root `role="status"`.
- **`PageHeader`**
  - Props: `{ title: string; subtitle?: string; actions?: ReactNode }`.
  - Markup: `<header class="flex flex-wrap items-end justify-between gap-4">` with `<h1 class="text-3xl md:text-4xl font-extrabold">`, the subtitle in muted text, and actions in a `flex gap-2` box. Wrapping puts the actions under the title on mobile.

### Feature — `src/features/i18n/LanguageSwitcher/`

- Client component. Uses `DropdownMenu` with a trigger `Button variant="secondary" size="sm"` showing a `Languages` icon plus the current native name. The trigger's accessible name is `t('Language')`, through `aria-label`.
- Two `DropdownMenuItem`s: `English` and `Українська`. These are native names, rendered as plain strings outside `t()` and marked with `// i18n-ignore` comment if the linter needs it. The current one gets `aria-checked`, via `DropdownMenuRadioGroup`.
- `onSelect(locale)`: if it is the same locale, do nothing. Otherwise `document.cookie = 'lang=' + locale + '; path=/; max-age=31536000; SameSite=Lax'`, then `window.location.reload()`.
- The current locale comes from `useLocale()` (from `src/i18n/client.tsx`).

### i18n client — `src/i18n/client.tsx`

- `'use client'`.
- `I18nProvider({ locale, resources, children })` creates an i18next instance once per mount (`useState(() => createInstance(...).use(initReactI18next).init({ lng: locale, resources: { [locale]: { translation: resources } }, initAsync: false, keySeparator: false, nsSeparator: false, fallbackLng: false, interpolation: { escapeValue: false }, react: { useSuspense: false } }))`) and renders `<I18nextProvider i18n={instance}>` plus a locale context.
- Exports `useLocale()` and `useFormat()`.
- The shared init options live in `src/i18n/config.ts` and are used by both `server.ts` and `client.tsx`.

### Dev page

- `src/app/[lang]/dev/ui/page.tsx` (server):
  - `if (!isDevUiEnabled(process.env)) notFound();`
  - `generateMetadata` gives the title `Design system · Pampojo` via `getI18n()`;
  - renders `<DevUiPage />`.
- `src/features/dev-ui/utils.ts`: `isDevUiEnabled(env: { VERCEL_ENV?: string }) => env.VERCEL_ENV !== 'production'`.
- `src/features/dev-ui/DevUiPage/DevUiPage.tsx` (client) has the nine sections, each `<section aria-labelledby>` with an `<h2>`:
  - **Colors**: a swatch per token name. Each swatch reads its value in `useEffect` with `getComputedStyle(document.documentElement).getPropertyValue('--name')` and shows it, so there is no hex in TS.
  - **Type**: `text-5xl font-extrabold` display, h1/h2/h3/body/small, a `tabular-nums` number row `0123456789`, and the Ukrainian sample `Ґанок, їжак, єнот, ірис` in 400/600/800.
  - **Buttons**: a grid of variants × sizes. The label for each button is its `variant size` text, e.g. `primary md` (dev labels, not translated). An icon button uses `Plus` with `aria-label={t('Add')}`.
  - **Inputs**: `Label` + `Input` "Name"; a second one with `aria-invalid` and the error text below, linked by `aria-describedby`.
  - **Cards**: a plain `Card` with sample text, plus two `StatCard`s:
    - `t('BMI')`, value `formatNumber(locale, 24.8)`, trend down `formatNumber(locale, -0.6)`;
    - `t('Workouts this month')`, value `12`.
  - **Gauge**: four `SegmentedGauge`s with label `t('Plan adherence')` at 0/50/82/100.
  - **Avatars**: a `grid grid-cols-6` of all 24 `EmojiAvatar` `md` with colors cycling 1–8; a row of 8 color swatches; three sizes of `fox`.
  - **Status**: the three pills.
  - **Overlays**: buttons `Open dialog`, `Open sheet`, `Open menu` and `Show toast` (`toast(t('Saved'))`); `Tabs` with two tabs (`Tab one` / `Tab two`, dev labels); `Progress value={60}`; three `Skeleton` lines.
  - Header: `PageHeader` with `title={t('Design system')}` and `actions={<LanguageSwitcher />}`.
- Layout: a `main` with `mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-10`; the sections in a `grid gap-6 md:grid-cols-2`, with Colors, Buttons and Avatars spanning both columns (`md:col-span-2`). The button grid uses `flex flex-wrap gap-3` so the 390px width never scrolls horizontally.
- **Dev labels**: strings only on `/dev/ui` that the spec Copy does not list, such as variant names, `Tab one` and the sample card text. They stay untranslated plain strings, marked with a comment. They are developer-facing.

### Brand assets

- `public/brand/pampojo-icon.svg` and `public/brand/pampojo-wordmark.svg`, copied from `docs/brand/`.
- `scripts/generate-icons.ts` runs on Node 26 with native TS and uses the existing `playwright` dev dependency. It opens the SVG in headless Chromium at 16, 32, 48 and 180 px and screenshots each with `omitBackground`. Outputs:
  - `src/app/icon.svg`: a copy of the brand SVG;
  - `src/app/apple-icon.png`: 180×180;
  - `src/app/favicon.ico`: an ICO with embedded 16, 32 and 48 PNGs, written by hand (6-byte header + 16-byte entries + PNG blobs; no dependency). It replaces the create-next-app favicon.
- Script `icons:generate`. Run once, commit the outputs.

### State and data

No server state, no stores. The locale comes from the root param (server) and the context (client).

### Offline

Nothing new. Spec 15 must vary its HTML cache by the `lang` cookie (see Risks).

## 7. Copy

Exact keys (en) and uk values. Each key goes through `t()` with this literal.

| Key (en) | uk |
| --- | --- |
| `Design system` | `Дизайн-система` |
| `Design system · Pampojo` | `Дизайн-система · Pampojo` |
| `Colors` | `Кольори` |
| `Type` | `Типографіка` |
| `Buttons` | `Кнопки` |
| `Inputs` | `Поля` |
| `Cards` | `Картки` |
| `Gauge` | `Шкала` |
| `Avatars` | `Аватари` |
| `Status` | `Статус` |
| `Overlays` | `Оверлеї` |
| `Name` | `Ім'я` |
| `This field is required` | `Це поле обов'язкове` |
| `BMI` | `ІМТ` |
| `Workouts this month` | `Тренувань цього місяця` |
| `Plan adherence` | `Виконання плану` |
| `Open dialog` | `Відкрити діалог` |
| `Open sheet` | `Відкрити панель` |
| `Open menu` | `Відкрити меню` |
| `Show toast` | `Показати сповіщення` |
| `Saved` | `Збережено` |
| `Add` | `Додати` |
| `Close` | `Закрити` |
| `Online` | `Онлайн` |
| `Offline` | `Офлайн` |
| `{{count}} pending` | `{{count}} в черзі` (use the same text for `_one`, `_few`, `_many`, `_other`) |
| `{{count}} change waiting to sync` | `_one` `{{count}} зміна чекає синхронізації`, `_few` `{{count}} зміни чекають синхронізації`, `_many` `{{count}} змін чекають синхронізації`, `_other` `{{count}} зміни чекають синхронізації` |
| `Language` | `Мова` |
| `Pampojo` | `Pampojo` |
| 24 emoji names: `Fox` … `Fire` | as in this list: Лисиця, Ведмідь, Панда, Коала, Тигр, Лев, Жаба, Мавпа, Пінгвін, Сова, Восьминіг, Єдиноріг, Персик, Апельсин, Лимон, Кавун, Авокадо, Вишні, Штангіст, Боксерська рукавиця, Велосипедист, Бігун, Блискавка, Вогонь |

- English plural values: `{{count}} pending_one` = `{{count}} pending`, `_other` = `{{count}} pending`. `{{count}} change waiting to sync_one` = `{{count}} change waiting to sync`, `_other` = `{{count}} changes waiting to sync`.
- Not translated (native names): `English`, `Українська`.
- Dialog demo: title `Design system`, body the `Saved` text, and a close button `Close`. Sheet demo: the same title. Menu demo items: `Online`, `Offline`.

## 8. Steps

1. **Dependencies.** `pnpm add i18next react-i18next sonner`, `pnpm add -D i18next-cli`. Add `react-hook-form` and `@hookform/resolvers` only if `shadcn add field|form` pulls them in. No others.
2. **i18n core.**
   - `src/i18n/config.ts` holds `LOCALES`, `Locale`, `isLocale`, `DEFAULT_LOCALE`, `LOCALE_COOKIE` and `i18nextOptions(locale, resources)`.
   - `src/i18n/resolve-locale.ts`.
   - `src/i18n/format.ts`.
   - `src/i18n/locales/en.json` and `uk.json`, with the keys from section 7.
   - `src/i18n/server.ts` and `src/i18n/client.tsx`.
   - Add `"allowImportingTsExtensions": true` to `tsconfig.json`; the check script needs it, and `noEmit` is already set.
3. **i18n tooling.**
   - `i18next.config.ts` (i18next-cli): locales `['en', 'uk']`, `extract.input: ['src/**/*.{ts,tsx}']`, `extract.output: 'src/i18n/locales/{{language}}.json'`, `keySeparator: false`, `nsSeparator: false`, `defaultNS: false` (flat file), the primary language `en` with the key as default value, `removeUnusedKeys: true`, `sort: true`.
   - `src/i18n/check-catalogs.ts`: `checkCatalogs(en, uk): string[]` (problems). A pure function with no imports.
   - `scripts/i18n-check.ts` imports `../src/i18n/check-catalogs.ts`, prints the problems and exits 1 when there are any.
   - Scripts: `i18n:extract` = `i18next-cli extract`, `i18n:check` = `i18next-cli extract --ci && node scripts/i18n-check.ts`.
4. **Proxy and routing move.**
   - `src/proxy.ts`.
   - `git mv src/app/layout.tsx src/app/[lang]/layout.tsx` and rewrite it (section 6).
   - `git mv 'src/app/(marketing)' 'src/app/[lang]/(marketing)'`.
   - Run `pnpm typecheck`, since `next typegen` creates the `next/root-params` types.
5. **Theme.** `globals.css` (section 6) and the Nunito font in the layout.
6. **shadcn.** `shadcn add …` (section 6). Rework the `button` variants and sizes, the `input` look, and `sonner` without `next-themes`. Mount `<Toaster />` in the layout.
7. **Constants.** `src/constants/avatar.ts`.
8. **App components**: `EmojiAvatar` (+ `useAvatarEmojiNames`), `StatCard`, `SegmentedGauge`, `StatusPill`, `PageHeader`, each with `index.ts`.
9. **LanguageSwitcher**: `src/features/i18n/LanguageSwitcher/`.
10. **Dev page**: `src/features/dev-ui/utils.ts`, `src/features/dev-ui/DevUiPage/`, `src/app/[lang]/dev/ui/page.tsx`.
11. **Brand.**
    - Copy the SVGs to `public/brand/`.
    - Write `scripts/generate-icons.ts`, run it, and delete the old `src/app/favicon.ico` before writing the new one.
    - Add `icons:generate` to `package.json`.
12. **Lint rules** (`eslint.config.mjs`, a new block for `src/**/*.{ts,tsx}`). `no-restricted-syntax` with:
    - `Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/]`: message `Use a design token instead of a hex color.`
    - `TemplateElement[value.raw=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/]`: same message.
    - `CallExpression[callee.name='t'][arguments.0.type!='Literal']`: message `t() needs a string literal key so extraction can see it.`
    - `CallExpression[callee.property.name='t'][arguments.0.type!='Literal']`: same message.

    `src/components/ui/**` stays ignored. Exempt test files from the hex rule only if a test needs a literal (it should not).
13. **Test utils.** `src/test/render.tsx`: `render(ui, { locale?: Locale })` wraps in `I18nProvider` with the matching catalog imported from `@/i18n/locales/*.json`. Default `en`.
14. **Tests** (section 9).
15. **CI.** Add `pnpm i18n:check` after `pnpm format:check` in the `checks` job of `.github/workflows/ci.yml` and `main.yml`.
16. **Docs.** README commands table: add `i18n:extract`, `i18n:check` and `icons:generate`.
17. **Verify.** `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`, `pnpm test`, `pnpm build` (both locales prerendered), `pnpm test:e2e`. Check `/dev/ui` by hand at 390 and 1440 in both languages.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/01-design-system.spec.ts`: on `/dev/ui`, the nine `<h2>`s are visible. Every variant × size button exists by name (`primary md` …). Four meters. 24 avatar `img`s in the Avatars section. Three status pills. Click `Open dialog` → `dialog` visible, then Escape. `Open sheet` → `dialog` visible. `Open menu` → `menu` visible. `Show toast` → text `Saved` visible. |
| AC2 | `src/test/__tests__/lint-rules.test.ts` (node): `new ESLint({ cwd })`, `lintText("const c = '#F59A62';", { filePath: 'src/components/Foo/Foo.ts' })` gives a `no-restricted-syntax` message. Also a template literal ``bg-[#fff]`` and the JSX attribute `style={{ color: '#262626' }}`. `'#section'` gives none. |
| AC3 | `e2e/01-design-system.spec.ts`: on `/`, `link[rel="icon"]` and `link[rel="apple-touch-icon"]` exist, and `request.get(href)` is 200 with a `image/*` content type. |
| AC4 | `src/i18n/__tests__/catalogs.test.ts` (node): both JSON files contain `Design system`. The CI step `pnpm i18n:check` (which runs `extract --ci`) proves the catalogs match the code. |
| AC5 | `src/i18n/__tests__/check-catalogs.test.ts` (node): `checkCatalogs` reports a missing key, an empty value, and a missing `_few`/`_many` for a key that has `_one`. It returns `[]` for the committed catalogs. |
| AC6 | `src/test/__tests__/lint-rules.test.ts`: `t(key)`, `` t(`x`) `` and `i18n.t(key)` report; `t('Online')` does not. |
| AC7 | `e2e/01-design-system.spec.ts`: `test.describe` with `use({ locale: 'uk-UA' })` (Playwright sends `Accept-Language`) → `html[lang="uk"]` and heading `Дизайн-система`. With `use({ locale: 'en-US' })` → `lang="en"` and `Design system`. |
| AC7 | `src/i18n/__tests__/resolve-locale.test.ts` (node): cookie wins; `uk-UA` → uk; `en-US,uk;q=0.8` → en; `ru,uk;q=0.8,en;q=0.5` → uk; `de` → en; invalid cookie ignored; empty → en. |
| AC8 | `e2e/01-design-system.spec.ts` (en locale): open `LanguageSwitcher` (button named `Language`), choose `Українська`, then `waitForURL` the same path and the heading `Дизайн-система`. The cookie `lang` = `uk` via `context.cookies()`. `page.reload()` → still uk. |
| AC9 | `src/app/__tests__/contrast.test.ts` (node): read `src/app/globals.css`, regex the three variables from `:root`, compute the WCAG relative luminance ratio, and expect each ≥ 4.5. |
| AC10 | `src/components/SegmentedGauge/__tests__/SegmentedGauge.test.tsx`, `src/components/EmojiAvatar/__tests__/EmojiAvatar.test.tsx`, `src/components/StatusPill/__tests__/StatusPill.test.tsx` (browser, via `render(ui, { locale })`), as listed in AC10. |
| AC11 | `e2e/01-design-system.spec.ts`: `page.evaluate` runs `await document.fonts.ready`, reads the first family, and checks `document.fonts.check`. Expect `Nunito` in the name and `true`. |
| AC12 | `src/features/dev-ui/__tests__/utils.test.ts` (node) for `isDevUiEnabled`. The e2e `/dev/ui` response status is 200. |
| AC13 | `e2e/01-design-system.spec.ts`: `scrollWidth <= innerWidth` on `/dev/ui`; runs in both projects. |
| — | `src/app/[lang]/(marketing)/__tests__/page.test.tsx` (moved), still passing. `e2e/00-project-setup.spec.ts` still passes through the proxy rewrite. |
| — | `src/components/StatCard/__tests__/StatCard.test.tsx`, `src/components/PageHeader/__tests__/PageHeader.test.tsx`: renders label/value/trend text, `<h1>` title, actions. |

## 10. Risks and open questions

No blocking questions.

- **Metadata files outside the root layout.** `src/app/icon.svg`, `apple-icon.png` and `favicon.ico` sit above `[lang]`. If Next does not serve them from there with a `[lang]` root layout, move them into `src/app/[lang]/` and check that the `<link>`s still point to `/icon.svg` etc. Otherwise put them in `public/` and declare `metadata.icons` in the layout. Record which.
- **Proxy and static files.** A matcher mistake would rewrite `/_next/*`, `/brand/*` or `/api/*` to `/<lang>/…` and break them. The e2e smoke of 00 plus AC3 catch it.
- **i18next-cli config.** Option names (`defaultNS: false` for a flat file, key-as-default, plural generation for `uk`) must be checked against its docs in `node_modules/i18next-cli`. If `extract` cannot keep plural `_other` values written by hand, keep the plural keys out of extraction with its preserve option. Record the exact config.
- **i18next keys with `.` and `:`.** Keys like `Design system · Pampojo` are fine with `keySeparator: false` and `nsSeparator: false` on both the runtime and the extractor. Forgetting either breaks lookups silently. AC4 and AC7 cover it.
- **shadcn `accent` semantics.** shadcn uses `bg-accent` for menu-item hover and focus, so menus get a peach highlight. That is accepted. If it looks too loud on review, map the menu highlight to `accent-soft` in the generated `dropdown-menu.tsx`. Not in scope now.
- **`next-themes` in the sonner template.** Drop it (no dark theme). Do not add the dependency.
- **Emoji rendering** differs per OS. That is cosmetic and accepted.
- **Hex regex false positives**, for example an anchor `#add` or `#bad`. Rename the anchor, or use `// eslint-disable-next-line no-restricted-syntax` with a reason.
- **Spec 15 (service worker).** HTML responses for the same URL differ by the `lang` cookie. The SW cache must key by locale or be cleared on switch. Write this into spec 15 when drilled.
- **Spec 02 and later.** Every page is created under `src/app/[lang]/` and gets text via `getI18n()` (server) or `useTranslation()` (client). Links stay unprefixed.
- **Profile language setting**: unassigned (spec 04 excludes it). Decide when drilling 04.

## 11. Implementation notes

- `shadcn add … field` worked, so `field` is used instead of `form`. No `react-hook-form` or `@hookform/resolvers` was added. `shadcn add` also generated `separator.tsx` (used by `field`).
- `shadcn add sonner` installed `next-themes`. It was removed again, and `sonner.tsx` uses `theme="light"`.
- `button.tsx`: the shadcn variants and sizes were replaced by the plan's set. The generated `dialog.tsx`/`sheet.tsx` used `size="icon-sm"`, which now maps to `icon`. `DialogFooter`'s `variant="outline"` maps to `secondary`.
- `dialog.tsx` and `sheet.tsx` got a `closeLabel` prop (default `Close`), so the screen-reader text of the close icon can be translated. `/dev/ui` passes `t('Close')`.
- `input.tsx`: pill look (`h-12 rounded-full bg-card px-5`). `aria-invalid` uses a 2px destructive ring.
- Prettier now formats the generated `src/components/ui/*` files (single quotes etc.); they are not in `.prettierignore`.
- `package.json` got `"type": "module"`. Without it, Node warns on every run of `scripts/*.ts` and of the seed script, because they are ESM with native TS. Build, lint, tests and drizzle-kit all pass with it.
- `pnpm-workspace.yaml` allows the `@swc/core` build script, which `i18next-cli` needs.
- `I18nProvider` takes a `catalog` prop instead of `resources`, because it is one flat translation map per locale.
- `i18next.config.ts` uses `defaultNS: false`, `keySeparator: false`, `nsSeparator: false`, `functions: ['t', '*.t']`, `useTranslationNames: ['useTranslation', 'getI18n']`, and ignores `__tests__` and `src/components/ui`. `extract` creates the `uk` plural forms (`_one/_few/_many/_other`) and keeps hand-edited values, such as the English `_other` plural. No preserve patterns were needed.
- `DevUiPage` section order is Colors, Type, Inputs, Buttons, …. Inputs comes before Buttons so the two-column grid packs better; all nine sections are present. The icon buttons are named `Add (<variant>)` so each one is unique.
- Color swatches read CSS variables through `useSyncExternalStore`, not `useEffect` + state, because the React hooks lint rule forbids setState in an effect.
- `StatCard` wraps the value in its own `<span>`, so the value and the unit are separate text nodes.
- `SegmentedGauge` blocks carry `data-testid="gauge-block"`. Tests count them through the locator, since `testing-library/no-container` forbids `container.querySelectorAll`. The blocks are decorative; the meter carries the value.
- `src/test/__tests__/lint-rules.test.ts` disables `no-restricted-syntax` for the file, because its fixtures contain the forbidden patterns.
- AC11: `document.fonts.check('16px Nunito', 'ґїєі')` is false even with the font loaded. ґ (U+0491) is also inside the `cyrillic-ext` face's range, which never loads for Ukrainian text. The e2e test instead checks `їєі` plus a loaded Nunito face whose range includes `U+490-491`.
- Metadata icons work from `src/app/` (above `[lang]`). `/favicon.ico`, `/icon.svg` and `/apple-icon.png` are served and linked. The fallback was not needed.
- In Vitest browser mode, `toHaveTextContent` did not match Cyrillic text that was present in the element. Ukrainian assertions use `getByText` instead.
- `.vitest/` (Vitest browser failure screenshots) was added to `.gitignore` and `.prettierignore`.
- The page under `/dev/ui` is a server route at `src/app/[lang]/dev/ui/page.tsx` that passes `{ VERCEL_ENV: process.env.VERCEL_ENV }` to `isDevUiEnabled`. Passing `process.env` itself does not type-check against the narrow parameter.
- Later change (lead request, 2026-11-08): the font is Manrope instead of Nunito (`--font-manrope`; the OG image uses `src/assets/fonts/Manrope-ExtraBold.ttf`). See DECISIONS.

## 12. Review — 2026-11-08

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/01-design-system.spec.ts` (sections, variants × sizes, 4 meters, 27 avatars, 3 pills, overlays); `scratch/review/01-design-system/AC1-*-en.png`, `AC1-*-dialog.png`, `AC1-*-sheet.png` |
| AC2 | Pass | `src/test/__tests__/lint-rules.test.ts` (string, template and JSX style); `pnpm lint` clean |
| AC3 | Pass | `e2e/01-design-system.spec.ts` (icon and apple-touch-icon 200 `image/*`); generated from `docs/brand/pampojo-icon.svg` by `scripts/generate-icons.ts` |
| AC4 | Pass | `src/i18n/__tests__/catalogs.test.ts`; `pnpm i18n:check` runs `i18next-cli extract --ci` |
| AC5 | Pass | `src/i18n/__tests__/check-catalogs.test.ts`; `pnpm i18n:check` is in `ci.yml` and `main.yml` |
| AC6 | Pass | `src/test/__tests__/lint-rules.test.ts` (`t(key)`, `` t(`x`) ``, `i18n.t(key)`) |
| AC7 | Pass | `e2e/01-design-system.spec.ts` (uk-UA → `lang="uk"`, en-US → `lang="en"`); `src/i18n/__tests__/resolve-locale.test.ts` |
| AC8 | Pass | `e2e/01-design-system.spec.ts`; walk: switch → `lang="uk"`, h1 `Дизайн-система`, same URL (`AC8-*-switcher-open.png`, `AC8-*-after-switch-uk.png`) |
| AC9 | Pass | `src/app/__tests__/contrast.test.ts` (charcoal on accent 6.98, on accent-soft 11.4) |
| AC10 | Pass | `SegmentedGauge`, `EmojiAvatar` and `StatusPill` tests under `src/components/*/__tests__/` |
| AC11 | Pass with deviation | `e2e/01-design-system.spec.ts:80`: checks `їєі` plus a loaded face covering `U+490-491` instead of `check(…, 'ґїєі')`, which Chromium reports as false because ґ is also in the unloaded cyrillic-ext range. Recorded in Implementation notes. The font is now Manrope (lead request). |
| AC12 | Pass | `src/features/dev-ui/__tests__/utils.test.ts`; `/dev/ui` 200 in e2e |
| AC13 | Pass | e2e plus walk: overflow 0 at 390 and 1440 |

### Findings

1. [minor] The `LanguageSwitcher` trigger shows "English" or "Українська" but its accessible name is only "Language" (`src/features/i18n/LanguageSwitcher/LanguageSwitcher.tsx:38`). Lighthouse flags `label-content-name-mismatch`, and voice-control users saying "English" cannot hit it. Fix: `aria-label={`${t('Language')}: ${LANGUAGE_NAMES[locale]}`}` or drop the `aria-label` and add sr-only text.
2. [minor] `--muted-foreground` text fails AA on cream (3.97) and on card (4.41). Accepted in DECISIONS ("Contrast scope"), but it is the only Lighthouse contrast failure on every page.
3. [minor] The Vitest browser matcher `toHaveTextContent` did not match Cyrillic text that was present. The tests work around it with `getByText`. Worth rechecking after a Vitest upgrade; not a product bug.
4. [minor] The `/dev/ui` icon buttons are named `Add (<variant>)`, mixing a translated word with a dev label. Dev-only page, harmless.

### Checks

- lint: pass (`pnpm lint`, 0 problems); `pnpm format:check` pass.
- typecheck: pass (`next typegen && tsc --noEmit`).
- tests: pass — `pnpm test` 16 files, 64 tests (node + browser); `pnpm i18n:check` pass.
- e2e: pass — `CI=1 pnpm test:e2e` against `pnpm start`: 42 passed, 2 skipped (viewport-specific tests).
- build: pass (`pnpm build`).

### Out of scope

- Profile language setting has no owner spec yet (spec 04 excludes it).
- Spec 15 must vary the HTML cache by the `lang` cookie.
- ADR 0009 (bilingual UI without locale URLs) was proposed and not written yet.

### Follow-up — 2026-11-08

- Finding 1 fixed: the `LanguageSwitcher` trigger's `aria-label` is now `Language: <current language>` (`src/features/i18n/LanguageSwitcher/LanguageSwitcher.tsx`). Lighthouse `label-content-name-mismatch` passes. lint, typecheck, test (64/64) and e2e (42 passed) are green after the change.

### UI polish — 2026-11-08

- `/dev/ui`: the two-column section grid starts at `lg` instead of `md`. At 768 the gauges and cards were cramped in half columns.
