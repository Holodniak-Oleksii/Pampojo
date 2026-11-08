# 02-landing — technical plan

Spec: `docs/specs/02-landing.md`

## 1. Summary

Replace the `/` placeholder with the Pampojo landing page, statically prerendered for `en` and `uk`.

- **Page sections**: header with a mobile sheet menu; hero with a phone mockup built in code; four feature cards; three steps; a progress showcase (gauge, static SVG chart, BMI card); an offline banner; a FAQ accordion; a CTA banner; a footer with the `LanguageSwitcher`.
- **Legal placeholders**: `/privacy` and `/terms`.
- **Metadata**: localized title, description and Open Graph tags, plus a generated OG image per locale.
- **Lighthouse CI**: a job that fails a PR when mobile performance or accessibility drops below 0.9.

No raster images, no chart library, and no server data.

Existing code this builds on (specs 00 and 01):

- `src/app/[lang]/layout.tsx` (root: `<html lang>`, Nunito, `I18nProvider`, `Toaster`) and `src/app/[lang]/(marketing)/page.tsx` (placeholder `<h1>Pampojo</h1>`), with a browser test in `__tests__/page.test.tsx`.
- `src/proxy.ts`: locale rewrite, matcher `/((?!api|_next|brand/|.*\..*).*)`.
- i18n:
  - `getI18n()` from `@/i18n/server` returns `{ locale, t }` for server components;
  - `useTranslation()` (react-i18next) and `useLocale()` / `useFormat()` from `@/i18n/client` serve client components;
  - catalogs live in `src/i18n/locales/{en,uk}.json` and are updated by `pnpm i18n:extract`. Run it after adding keys, then fill `uk`.
- Components:
  - `@/components/SegmentedGauge`, `@/components/StatCard`, `@/components/StatusPill` and `@/components/PageHeader` are all client components that use `useTranslation`;
  - `@/features/i18n/LanguageSwitcher`;
  - shadcn `button` (variants `primary | accent | secondary | ghost`, sizes `sm | md | lg | xl | icon`) and `sheet` (`SheetContent` has `closeLabel`).
- Tokens: `bg-background`, `bg-card`, `bg-accent`, `bg-accent-soft`, `text-muted-foreground`, `shadow-soft`, `rounded-[24px]`. ESLint forbids hex literals in `src/**/*.{ts,tsx}`, and `t()` takes literal keys only.
- `public/brand/pampojo-icon.svg` and `pampojo-wordmark.svg` (1776×427).
- `e2e/00-project-setup.spec.ts` checks the `Pampojo` h1 on `/`.
- `next.config.ts` validates env at load. `cacheComponents: true`.

## 2. Acceptance criteria

- AC1: At 390×844 and 1440×900, in both `en` and `uk`, `/` shows in this order: header, hero, features, how it works, progress showcase, offline banner, FAQ, CTA, footer. Each section's texts match section 7. Test it through a `data-section` attribute on each section root, checking their order in the DOM and that each is visible after scrolling into view.
- AC2: Every "Get started" link has `href="/signup"`, every "Log in" link `href="/login"`, and "Continue with Google" `href="/signup"`.
- AC3: Clicking the header link (desktop) or the footer link for Features, How it works and FAQ sets `location.hash` to `#features`, `#how-it-works` or `#faq`, and the target section's heading ends up in the viewport.
- AC4: Mobile (390):
  - the button named "Open menu" opens a dialog named "Menu", by tap and by keyboard focus + Enter, and also + Space;
  - Escape closes it and focus returns to "Open menu"; the "Close" button also closes it;
  - tapping "FAQ" in the sheet closes the sheet and sets the hash to `#faq`.
- AC5: FAQ: four triggers with `aria-expanded="false"` at first.
  - Click opens one. Tab to another trigger and press Enter: that one opens and the first closes.
  - Space toggles the focused one.
  - The answer text is visible only when its item is open.
- AC6: The `<head>` of `/` has:
  - a `<title>` and `meta[name=description]` from section 7 for the active locale;
  - `og:title`, `og:description` and `og:type=website`;
  - `og:image`, whose URL returns 200 `image/png` at 1200×630 (read from the PNG IHDR);
  - `twitter:card=summary_large_image`.
- AC7: The CI job `lighthouse` (`lhci autorun`) passes: mobile preset, 3 runs on `http://localhost:3000/`, median `categories:performance` ≥ 0.9 and `categories:accessibility` ≥ 0.9.
- AC8: `document.documentElement.scrollWidth <= innerWidth` on `/` at 360, 390 and 1440 width.
- AC9: `/privacy` shows h1 "Privacy policy", "Coming soon." and a "Back to home" link to `/`. `/terms` does the same with "Terms of use". In `uk` the texts are "Політика конфіденційності" / "Умови використання" / "Скоро буде." / "На головну". Both pages have the marketing header and footer.
- AC10: Every `<img>` on `/` has a `src` ending in `.svg`. There are no `<picture>` or CSS `background-image: url(...)` rasters in the landing components; review the code to confirm.

## 3. Data

No changes.

## 4. API

No changes. The OG image is a Next.js metadata route (`opengraph-image.tsx`), statically generated per locale.

## 5. Server

No server modules. Translations in server components come from `getI18n()`.

- **Build year.** `next.config.ts` gets `env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) }`. Under Cache Components, `new Date()` in a prerendered server component is an error, so the footer reads `process.env.NEXT_PUBLIC_BUILD_YEAR`.
- **Proxy.** Extend the matcher to skip metadata image routes: `'/((?!api|_next|brand/|icons/|.*opengraph-image.*|.*\\..*).*)'`. Otherwise the generated `/en/opengraph-image…` URL would be redirected by the prefix rule. Check the generated URL during the build (see Risks).

## 6. Client

### Routes

| File | What |
| --- | --- |
| `src/app/[lang]/(marketing)/layout.tsx` | Server. Renders `<MarketingHeader />`, `<main id="main">{children}</main>` and `<MarketingFooter />`. |
| `src/app/[lang]/(marketing)/page.tsx` | Server. `generateMetadata` (title, description, OG/Twitter text) plus `<LandingPage />`. |
| `src/app/[lang]/(marketing)/opengraph-image.tsx` | `ImageResponse` 1200×630, `size`, `contentType = 'image/png'`, `alt` = hero headline. |
| `src/app/[lang]/(marketing)/privacy/page.tsx` | Server. `PageHeader` title "Privacy policy", the body and a back link. |
| `src/app/[lang]/(marketing)/terms/page.tsx` | Same, with "Terms of use". |

- Delete `src/app/[lang]/(marketing)/__tests__/page.test.tsx`. The page is now an async server component (it awaits `getI18n()`) and cannot render in Vitest browser mode; e2e covers it.
- Update `e2e/00-project-setup.spec.ts`: the h1 is now `Your workouts. Even offline.`

### Feature folder `src/features/landing/`

One folder per section component, with `<Name>.tsx` + `index.ts`. Server components unless marked client. Each section root gets `data-section="<name>"`. Sections with anchors also get `id` and `scroll-mt-24` (for the sticky header).

| Component | Kind | Notes |
| --- | --- | --- |
| `MarketingHeader` | server | `<header class="sticky top-0 z-40 bg-background/95 backdrop-blur">`, inner `mx-auto max-w-[1200px] px-4 md:px-6 h-16 flex items-center justify-between`. Left: on desktop `next/image` `/brand/pampojo-wordmark.svg` (height 32, width 133), on mobile `/brand/pampojo-icon.svg` (28×28) + text "Pampojo". The logo link has an accessible name (Copy), and the images use `alt=""`. Desktop `nav` (`hidden md:flex`) with the three anchor links (`ghost` style), then Log in (`Button asChild variant="ghost" size="sm"` → `<Link href="/login">`) and Get started (`Button asChild size="sm"` → `/signup`). Mobile (`md:hidden`): Log in plus `<MobileMenu />`. `data-section="header"`. |
| `MobileMenu` | client | `Sheet` + `SheetTrigger asChild` → `Button variant="secondary" size="icon" aria-label={t('Open menu')}` (lucide `Menu`). `SheetContent side="right" closeLabel={t('Close')}` with `SheetTitle` "Menu". The anchor links are each wrapped in `SheetClose asChild` → `<a href="#features">`, so a tap closes the sheet and the browser follows the hash. Then Log in, Get started (full-width buttons) and `<LanguageSwitcher />`. |
| `Hero` | server | `id="top"`, `data-section="hero"`. Desktop: `grid md:grid-cols-2 gap-10 items-center`. Mobile: one column with the text first. `<h1 class="text-4xl md:text-7xl font-extrabold leading-[1.05]">` with the headline. The two sentences "Your workouts." and "Even offline." stay one string in Copy, and a line break comes from `max-w`, not split keys. Subtitle `text-lg text-muted-foreground max-w-[34ch]`. Button row `flex flex-col sm:flex-row gap-3`: Get started (`size="lg"`), Continue with Google (`variant="secondary" size="lg"`, with `next/image` `src={googleG}` imported from `@/assets/google-g.svg`, 20×20, `alt=""`). The trust line is `text-sm text-muted-foreground`. Then `<HeroPhone />`. |
| `HeroPhone` | server | `aria-hidden="true"` wrapper with `relative` and a soft radial glow (`bg-[radial-gradient(...)]` using `var(--accent-soft)`, no hex). Phone: `w-[260px] md:w-[300px] aspect-[9/19] rounded-[44px] bg-primary p-3 shadow-soft md:rotate-6`. Screen: `rounded-[34px] bg-card p-5 flex flex-col gap-4`. Content: a back-chevron row with "Bench Press" (`font-extrabold`); "80 kg × 8" (`text-4xl font-extrabold tabular-nums`); a chip row of a `rounded-full bg-background px-4 py-2` "Rest 01:15" with a `Pause` icon, and an `accent-soft` "PR +5 kg" with a `Trophy` icon; `<StatusPill status="offline" />`. |
| `Features` | server | `id="features"`, `data-section="features"`. `<h2 class="sr-only">`. `grid grid-cols-2 lg:grid-cols-4 gap-4`. The card is `rounded-[24px] bg-card p-5 shadow-soft flex flex-col gap-3`: an icon tile `size-14 rounded-2xl bg-accent-soft text-accent flex items-center justify-center` (lucide `Dumbbell`, `CalendarDays`, `WifiOff`, `Users`, `size-7`), an `<h3 class="font-extrabold">` title and a `text-sm text-muted-foreground` sentence. |
| `HowItWorks` | server | `id="how-it-works"`, `data-section="how-it-works"`. A visible `<h2 class="text-3xl font-extrabold">`. `<ol class="grid gap-4 lg:grid-cols-3">`. Each `<li>` is a card with a number badge (`size-9 rounded-full bg-accent text-accent-foreground font-extrabold`), an `<h3>` title, a sentence and an icon (`Plus`, `CalendarCheck`, `ChartColumn`) in an accent-soft tile on the right. On desktop the arrows between the cards are `ArrowRight` icons, `aria-hidden`, absolutely positioned and `hidden lg:block`. |
| `ProgressShowcase` | server | `data-section="showcase"`. `<h2 class="sr-only">`. `grid gap-4 lg:grid-cols-[1fr_1fr]`. Card A (`lg:col-span-1`): two columns on desktop (stacked on mobile): left `<SegmentedGauge value={82} label={t('Plan adherence')} />` with a label heading; right `<ProgressChart />` with the label "Bench press progress" and caption "3 months". Card B: `<StatCard label={t('BMI')} value="24.8"…>` with `<Sparkline />` as children. Format the numbers by locale: pass `formatNumber(locale, 24.8)` and `formatNumber(locale, -0.6)` from `@/i18n/format`. Then `<OfflineBanner />` takes the second column on desktop. |
| `ProgressChart` | server | Static SVG `viewBox="0 0 320 140"`, `role="img"` with `aria-label` = the "Bench press progress" text. Points `[[10,110],[50,98],[90,102],[130,80],[170,86],[210,60],[250,48],[300,40]]`. Area path `fill-accent-soft/60`, polyline `stroke-accent stroke-[3] fill-none`, dots `fill-accent` r=4. |
| `Sparkline` | server | SVG `viewBox="0 0 200 48"`, `aria-hidden`, a slowly descending line `stroke-accent`. |
| `OfflineBanner` | server | `data-section="offline"`. `rounded-[24px] p-6 md:p-8 bg-gradient-to-br from-accent-soft to-card shadow-soft grid md:grid-cols-[auto_1fr] gap-6 items-center`. A mini phone (`w-[180px] rounded-[32px] bg-primary p-2`, screen `bg-card rounded-[26px] p-4`) with `<StatusPill status="offline" />` and the text "3 sets saved, will sync later" (`font-semibold text-center`), all `aria-hidden`. Next to it the headline as `<h2 class="text-2xl md:text-3xl font-extrabold">`. |
| `Faq` | client | `id="faq"`, `data-section="faq"`. `<h2>`. shadcn `Accordion type="single" collapsible`. Desktop: two columns (`lg:grid-cols-2 gap-4`), each holding two items, but with **one** `Accordion` root so only one item opens at a time. Achieve it with a single `Accordion` whose items flow in a CSS grid `lg:grid lg:grid-cols-2`. Items are cards `rounded-[24px] bg-card px-5 shadow-soft`. |
| `CtaBanner` | server | `data-section="cta"`. `rounded-full md:rounded-[40px] bg-primary text-primary-foreground px-6 py-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4`. Mobile is `rounded-[32px]`, so a stacked layout is not a squashed pill. `<h2 class="text-2xl md:text-3xl font-extrabold text-center md:text-left">` plus Get started (`variant="accent" size="lg"`). |
| `MarketingFooter` | server | `data-section="footer"`. A `footer` with `mx-auto max-w-[1200px] px-4 md:px-6 py-10 grid gap-8 md:grid-cols-[1.5fr_1fr_1fr_auto]`. Brand block: wordmark + tagline. Columns `<nav aria-label={t('Product')}>` with `<h2 class="text-sm font-extrabold">` and links, and Legal likewise. `<LanguageSwitcher />`. Copyright `t('© {{year}} Pampojo', { year: process.env.NEXT_PUBLIC_BUILD_YEAR })`. |
| `LandingPage` | server | Composes Hero, Features, HowItWorks, ProgressShowcase (which contains OfflineBanner), Faq and CtaBanner inside `mx-auto max-w-[1200px] px-4 md:px-6 flex flex-col gap-12 md:gap-20 pb-16`. |
| `LegalPlaceholder` | server | Props `{ title: string }`. `PageHeader title`, `<p>` "Coming soon.", and a `Link href="/"` "Back to home" styled as `Button asChild variant="secondary"`. Used by both legal pages. |

- **Anchors**: plain `<a href="#features">`, not `next/link`, so the hash updates natively. Add `html { scroll-behavior: smooth; }` to `globals.css`; the existing `prefers-reduced-motion` block already resets it to `auto`.
- **State and data**: none. Only `MobileMenu` and `Faq` hold UI state, through Radix.
- **Offline**: not applicable until spec 15.

### shadcn

`pnpm dlx shadcn@4.23.0 add accordion`. Style the items through classes in `Faq`, without forking the markup.

### Assets

- `src/assets/google-g.svg`: the standard four-color Google "G" mark (official brand colors live inside the SVG file, which the hex lint rule does not cover). Imported, so the build hashes it.
- `src/assets/fonts/Nunito-ExtraBold.ttf` plus `src/assets/fonts/OFL.txt`: Nunito static ExtraBold from the Google Fonts repository (`github.com/google/fonts/tree/main/ofl/nunito`, SIL Open Font License). Used only by `opengraph-image.tsx`, because `ImageResponse` needs a TTF with Cyrillic. The file must stay under about 300 KB; the `ImageResponse` bundle limit is 500 KB.

### OG image — `src/app/[lang]/(marketing)/opengraph-image.tsx`

- `export const size = { width: 1200, height: 630 }`, `contentType = 'image/png'`, and `generateStaticParams` is inherited from the root `[lang]` layout.
- `export default async function Image({ params })`: `const { lang } = await params`. Validate with `isLocale`, otherwise use `en`.
- The headline comes from the catalog JSON directly: `import en from '@/i18n/locales/en.json'` and `uk.json`, then `catalog['Your workouts. Even offline.']`. `next/root-params` is not available in metadata image routes.
- The font is read with `readFile(join(process.cwd(), 'src/assets/fonts/Nunito-ExtraBold.ttf'))`.
- Layout: background `var(--background)` is not available in Satori, so the colors go in as inline style values. Satori markup cannot use tokens, which makes it the one allowed exception. Put the colors in `src/app/[lang]/(marketing)/og-colors.ts`, with `// eslint-disable-next-line no-restricted-syntax -- Satori renders outside CSS; mirrors tokens in globals.css` above the object. Use cream `#F2ECE4`, charcoal `#262626`, accent `#F59A62`.
- Content: the brand icon SVG as a data URI `<img>` (160×160) and the headline at 80px, charcoal, ExtraBold.
- `alt` export: the English headline (static).

### Metadata — `src/app/[lang]/(marketing)/page.tsx` `generateMetadata`

```ts
const { t } = await getI18n();
return {
  title: t('Pampojo — workout tracker that works offline'),
  description: t('Build workouts, plan them in a calendar and log every set in the gym, even without a signal.'),
  openGraph: { title: <same>, description: <same>, type: 'website', siteName: 'Pampojo' },
  twitter: { card: 'summary_large_image', title: <same>, description: <same> },
};
```

- The title is set as `{ absolute: … }`, so a future root template does not append to it.
- `og:image` comes from the file convention automatically.
- `metadataBase`: set in the root layout `generateMetadata` to `new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')`.

### Layout checks

- 360px: the hero buttons stack full width, the feature grid is `grid-cols-2` with `min-w-0` cards and `break-words` titles, and the phone is `w-[240px]` below `sm`.
- 1440px: max width 1200, and the hero gap 40px.

## 7. Copy

Exact keys (en) → uk. The keys go through `t()` as literals; the English value equals the key.

| Key (en) | uk |
| --- | --- |
| `Pampojo — workout tracker that works offline` | `Pampojo — трекер тренувань, що працює офлайн` |
| `Build workouts, plan them in a calendar and log every set in the gym, even without a signal.` | `Створюй тренування, плануй їх у календарі й записуй кожен підхід у залі, навіть без зв'язку.` |
| `Features` | `Можливості` |
| `How it works` | `Як це працює` |
| `FAQ` | `Часті питання` |
| `Log in` | `Увійти` |
| `Get started` | `Почати` |
| `Open menu` | `Відкрити меню` |
| `Menu` | `Меню` |
| `Close` | `Закрити` (exists) |
| `Pampojo home` | `Pampojo — головна` |
| `Your workouts. Even offline.` | `Твої тренування. Навіть офлайн.` |
| `Build workouts, plan them in a calendar and track every set right in the gym, no signal needed.` | `Створюй тренування, плануй їх у календарі й записуй кожен підхід прямо в залі, навіть без зв'язку.` |
| `Continue with Google` | `Продовжити з Google` |
| `Free • Works on iPhone, Android and laptop` | `Безкоштовно • Працює на iPhone, Android і ноутбуці` |
| `Bench Press` | `Жим лежачи` |
| `80 kg × 8` | `80 кг × 8` |
| `Rest 01:15` | `Відпочинок 01:15` |
| `PR +5 kg` | `Рекорд +5 кг` |
| `Build your own workouts` | `Створюй свої тренування` |
| `Pick exercises from the catalog and set sets, reps and weight.` | `Обирай вправи з каталогу й задавай підходи, повтори та вагу.` |
| `Plan with a calendar` | `Плануй у календарі` |
| `Repeat workouts on your days and always see what's next.` | `Повторюй тренування у свої дні й завжди знай, що далі.` |
| `Works offline in the gym` | `Працює офлайн у залі` |
| `Log sets in a basement with no signal. Everything syncs later.` | `Записуй підходи навіть у підвалі без зв'язку. Усе синхронізується пізніше.` |
| `Share workouts with friends` | `Ділись тренуваннями з друзями` |
| `Send a link or a file. Your friend gets their own copy.` | `Надішли посилання або файл, і друг отримає власну копію.` |
| `Create a workout` | `Створи тренування` |
| `Choose exercises and save it once.` | `Обери вправи й збережи його один раз.` |
| `Schedule it` | `Заплануй` |
| `Put it on your calendar, once or every week.` | `Додай у календар разово або щотижня.` |
| `Train and track` | `Тренуйся й відстежуй` |
| `Log every set and watch your progress grow.` | `Записуй кожен підхід і дивись, як росте прогрес.` |
| `Your progress at a glance` | `Твій прогрес з першого погляду` |
| `Plan adherence` | `Виконання плану` (exists) |
| `Bench press progress` | `Прогрес жиму лежачи` |
| `3 months` | `3 місяці` |
| `BMI` | `ІМТ` (exists) |
| `Train in the basement. Sync when you're back online.` | `Тренуйся в підвалі. Синхронізуй, коли повернешся онлайн.` |
| `3 sets saved, will sync later` | `3 підходи збережено, синхронізуємо пізніше` |
| `Is Pampojo free?` | `Pampojo безкоштовний?` |
| `Yes. Pampojo is free to use.` | `Так. Користуватися Pampojo можна безкоштовно.` |
| `Does it work without internet?` | `Чи працює без інтернету?` |
| `Yes. After the first visit you can run workouts and log sets offline. Changes sync when you're back online.` | `Так. Після першого відкриття можна проводити тренування й записувати підходи офлайн. Зміни синхронізуються, коли з'явиться зв'язок.` |
| `Can I use it on iPhone?` | `Чи можна на iPhone?` |
| `Yes. Open Pampojo in Safari and add it to your Home Screen. It also works on Android and laptops.` | `Так. Відкрий Pampojo в Safari й додай на початковий екран. Також працює на Android і ноутбуках.` |
| `How do I share a workout?` | `Як поділитися тренуванням?` |
| `Share a link or a file from the workout. Your friend imports their own copy; your history stays private.` | `Поділись посиланням або файлом прямо з тренування. Друг імпортує власну копію, а твоя історія лишається приватною.` |
| `Start training smarter today` | `Тренуйся розумніше вже сьогодні` |
| `Track. Progress. Repeat.` | `Тренуйся. Прогресуй. Повторюй.` |
| `Product` | `Продукт` |
| `Legal` | `Правова інформація` |
| `Privacy` | `Конфіденційність` |
| `Terms` | `Умови` |
| `Privacy policy` | `Політика конфіденційності` |
| `Terms of use` | `Умови використання` |
| `Coming soon.` | `Скоро буде.` |
| `Back to home` | `На головну` |
| `© {{year}} Pampojo` | `© {{year}} Pampojo` |

The keys `Pampojo` (root title) and `Design system` stay. The text "Pampojo" next to the mobile icon is the brand name and is not translated.

## 8. Steps

1. **shadcn accordion and assets.**
   - `shadcn add accordion`.
   - Add `src/assets/google-g.svg`, `src/assets/fonts/Nunito-ExtraBold.ttf` and `OFL.txt`.
   - Add `declare module '*.svg'` typing only if Next's image types do not already cover it (they do via `next-env.d.ts`).
2. **Config.**
   - `next.config.ts`: `env.NEXT_PUBLIC_BUILD_YEAR`.
   - `src/proxy.ts`: update the matcher.
   - `globals.css`: `html { scroll-behavior: smooth; }` inside `@layer base`.
   - Root layout `generateMetadata`: add `metadataBase`.
3. **Section components** in `src/features/landing/` (section 6), each with `index.ts`. `LandingPage` composes them.
4. **Routes**: the marketing `layout.tsx`, `page.tsx` (metadata + `LandingPage`), `privacy/page.tsx`, `terms/page.tsx`, `opengraph-image.tsx` + `og-colors.ts`.
5. **Clean up**: delete the old placeholder page test, update `e2e/00-project-setup.spec.ts`.
6. **i18n**: `pnpm i18n:extract`, then fill `uk.json` from section 7, then `pnpm i18n:check`.
7. **Lighthouse CI.**
   - `pnpm add -D @lhci/cli`.
   - `lighthouserc.json`:

     ```json
     {
       "ci": {
         "collect": {
           "startServerCommand": "pnpm start",
           "startServerReadyPattern": "Ready",
           "url": ["http://localhost:3000/"],
           "numberOfRuns": 3,
           "settings": { "formFactor": "mobile", "screenEmulation": { "mobile": true } }
         },
         "assert": {
           "assertions": {
             "categories:performance": ["error", { "minScore": 0.9, "aggregationMethod": "median-run" }],
             "categories:accessibility": ["error", { "minScore": 0.9, "aggregationMethod": "median-run" }]
           }
         },
         "upload": { "target": "filesystem", "outputDir": ".lighthouseci" }
       }
     }
     ```

   - Script `lighthouse` = `lhci autorun`.
   - `.gitignore` and `.prettierignore`: `.lighthouseci/`.
   - `.github/workflows/ci.yml`: new job `lighthouse` (`needs: checks`), with the setup action, `pnpm build`, then `pnpm lighthouse`, and the env `DATABASE_URL` from secrets (required by `next start`). Chrome is preinstalled on `ubuntu-latest`.
8. **Tests** (section 9).
9. **README**: add `pnpm lighthouse` to the commands table.
10. **Verify**: `pnpm lint`, `pnpm typecheck`, `pnpm i18n:check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, then `pnpm lighthouse` locally after the build. Look at the screenshots at 360, 390 and 1440 in both locales.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/02-landing.spec.ts`: for `en-US` and `uk-UA` (`test.use({ locale })`), the `[data-section]` values in DOM order equal `['header','hero','features','how-it-works','showcase','offline','faq','cta','footer']`, and each is visible after `scrollIntoViewIfNeeded`. Spot-check the texts: h1, one feature title per card (4), the step titles (3), the offline headline, the 4 FAQ questions, the CTA and the tagline, in both locales. Runs in both projects. |
| AC2 | Same file: every `getByRole('link', { name: 'Get started' })` has `href` `/signup`; Log in has `/login`; Continue with Google has `/signup`. |
| AC3 | Same file, `desktop` only: click the header `Features` → `expect(page).toHaveURL(/#features$/)` and `expect(heading).toBeInViewport()` (for Features the heading is sr-only, so check that the section is in the viewport). The same for How it works and FAQ via the footer links on both projects. |
| AC4 | Same file, `mobile` only: tap `Open menu` → `getByRole('dialog', { name: 'Menu' })` visible; Escape → hidden and `Open menu` focused. `Open menu` via `focus()` + `Enter`, then `Close` → hidden. Open again via `Space`, tap `FAQ` → dialog hidden and URL `#faq`. |
| AC5 | `src/features/landing/Faq/__tests__/Faq.test.tsx` (browser, `render` from `@/test/render`): four buttons with `aria-expanded="false"`; click the first → `true` and the answer visible; `userEvent.keyboard('{Tab}')` to the second + `{Enter}` → second `true`, first `false`; `{ }` (space) toggles. Also asserted in e2e on the real page. |
| AC6 | `e2e/02-landing.spec.ts`: read `title`, `meta[name=description]`, `meta[property="og:title"]`, `og:description`, `og:type`, `twitter:card` in `en` and `uk`. Fetch the `og:image` content URL with `request.get`: 200, `image/png`, and the IHDR width/height read from bytes 16–23 equal 1200/630. |
| AC7 | The CI job `lighthouse` (`lhci autorun` assertions). Also run locally in step 10. |
| AC8 | `e2e/02-landing.spec.ts`: `page.setViewportSize({ width: 360, height: 780 })`, then 390 and 1440; `scrollWidth <= innerWidth` on `/`. |
| AC9 | `e2e/02-landing.spec.ts`: `/privacy` and `/terms` in `en` and `uk`: h1, body, Back to home → `/`, and the header + footer present (`[data-section=header]`, `[data-section=footer]`). |
| AC10 | `e2e/02-landing.spec.ts`: every `img` `src` (decoded `next/image` URL or the raw src) ends with `.svg`; `page.locator('picture')` count 0. |
| — | `e2e/00-project-setup.spec.ts` (updated h1). |

## 10. Risks and open questions

No blocking questions.

- **OG image URL and the proxy.** Next may emit `og:image` as `/<lang>/opengraph-image?<hash>` or `/opengraph-image-<hash>`. The matcher exclusion `.*opengraph-image.*` keeps the proxy from redirecting it. Check the real URL in `next build` output and in the `<head>`, and adjust the matcher if needed. If the emitted URL lacks the lang segment and therefore 404s, also exclude it and route it by the lang segment Next generates. Record what happened.
- **Satori and hex colors.** The OG image needs literal colors. Only `og-colors.ts` disables the hex rule, with a reason comment.
- **Nunito TTF size.** If the static ExtraBold file is over ~300 KB, subset it to Latin + Cyrillic with `pyftsubset` (one-off, not a dependency), or fall back to the variable TTF if it stays under 500 KB together with the code.
- **Lighthouse flakiness.** CI runners vary. Median of 3 runs. If performance swings around 0.9 because of the font, keep `display: swap` (already set) and preload only the Latin subset for the hero. Do not lower the threshold without the lead.
- **Lighthouse and the root layout.** The page shell is static, but the hydrated client parts (`I18nProvider` with the full catalog, `Toaster`, `LanguageSwitcher`, `MobileMenu`, `Faq`) cost JS. Pass the catalog as is for now. If TBT pushes performance under 0.9, split the catalog by route in a later spec. Note it here first.
- **`/signup` and `/login` 404** until spec 03. Accepted by the spec.
- **Spec 03** adds the signed-in redirect from `/` in the proxy and replaces the Google link.
- **Spec 15** must precache `/` per locale (HTML varies by the `lang` cookie).

## 11. Implementation notes

- OG font: the static TTF comes from the Google Fonts CSS API (`fonts.gstatic.com`, Nunito 800, 125 KB, Latin + Cyrillic), saved as `src/assets/fonts/Nunito-ExtraBold.ttf` with the OFL text in `OFL.txt` (taken from the Fontsource package, same OFL). The google/fonts repo now ships only the variable TTF. The Fontsource WOFF subsets that were tried first were not parsed by Satori and the image fell back to a default font.
- The OG image route builds as dynamic (`ƒ /[lang]/opengraph-image-<hash>`), not prerendered. It reads the font and icon per request, which is acceptable for a share-preview image.
- Next emits `og:image` as `/<lang>/opengraph-image-<hash>?<hash>`. The matcher exclusion `.*opengraph-image.*` lets it bypass the prefix redirect; the image returns 200 `image/png` 1200×630 in both languages.
- `og-colors.ts` disables `no-restricted-syntax` per line, with a reason, for its three colors. The `@next/next/no-img-element` disable in `opengraph-image.tsx` was unnecessary and was removed.
- Desktop showcase: `LandingPage` wraps `ProgressShowcase` in a `lg:grid-cols-2` grid, and `ProgressShowcase` returns the showcase section plus `OfflineBanner` as siblings, so the offline banner sits in the right column. The DOM order stays showcase → offline.
- Footer anchor links are `next/link` with `/#features` etc., so they also work from `/privacy` and `/terms`. Header and mobile-menu anchors are plain `<a href="#…">`, as planned.
- The header nav landmark has the accessible name `Menu` (key reused).
- Lighthouse locally (`pnpm lighthouse` after `pnpm build`): performance 1.0 and accessibility 0.96 in all three runs. The remaining failed a11y audits are `color-contrast` (`--muted-foreground` on cream, 3.97–4.41, accepted in spec 01) and `label-content-name-mismatch` on the `LanguageSwitcher` trigger (spec 01 code, reported, not changed).
- `lighthouserc.json` limits the run to `performance` and `accessibility` via `onlyCategories`, to keep CI fast.
- The CI `lighthouse` job has no explicit `DATABASE_URL` env. The workflow-level `env` in `ci.yml` already provides it to every job.
- Later change (lead request, 2026-11-08): the font is Manrope instead of Nunito (`--font-manrope`; the OG image uses `src/assets/fonts/Manrope-ExtraBold.ttf`). See DECISIONS.

## 12. Review — 2026-11-08

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/02-landing.spec.ts` (section order + copy, en and uk, both projects); `scratch/review/02-landing/AC1-{mobile,desktop}-{en,uk}.png` |
| AC2 | Pass | `e2e/02-landing.spec.ts` ("links to sign up and log in") |
| AC3 | Pass | `e2e/02-landing.spec.ts` (footer on both projects, header on desktop); walk: hash `#faq` and section in view (`AC3-*-faq-anchor.png`) |
| AC4 | Pass | `e2e/02-landing.spec.ts` (tap, Enter, Space, Escape with focus return, Close, link closes sheet); `AC4-mobile-menu-open.png` |
| AC5 | Pass | `src/features/landing/Faq/__tests__/Faq.test.tsx` plus e2e; `AC5-*-faq-open.png` |
| AC6 | Pass | `e2e/02-landing.spec.ts` (title, description, og:*, twitter:card, og:image 200 `image/png` 1200×630); `AC6-og-uk.png` (Manrope ExtraBold, Ukrainian) |
| AC7 | Pass locally / Not run in CI | `pnpm lighthouse`: performance 1.0 and accessibility 0.96 in all 3 runs. The `lighthouse` job in `ci.yml` has not run on GitHub. |
| AC8 | Pass | e2e (360, 390, 1440) plus walk overflow 0 in both locales; `AC8-360-uk.png` |
| AC9 | Pass | `e2e/02-landing.spec.ts` (both locales, header + footer, Back to home); `AC9-*-privacy.png` |
| AC10 | Pass | `e2e/02-landing.spec.ts` (all `<img>` are `.svg`, no `<picture>`); code: hero, chart and sparkline are JSX/SVG |

### Findings

1. [minor] The spec text is out of date after the lead's brand changes. `docs/specs/02-landing.md:15` says the mobile header is "brand icon + Pampojo", and `:29` says "brand icon + wordmark" in the footer. Both now use the new wordmark (icon-style P + "ampojo"), as DECISIONS ("Wordmark") records. Update the spec lines.
2. [minor] The OG image route is dynamic (`ƒ /[lang]/opengraph-image-…`) and reads the font and icon from disk on every request. That is fine for share previews. If it becomes hot, add `export const dynamic = 'force-static'`-equivalent caching (`'use cache'`).
3. [minor] It inherits the two spec 01 a11y notes (LanguageSwitcher label, muted contrast). Lighthouse still scores accessibility 0.96.

### Checks

- lint: pass (`pnpm lint`, 0 problems); `pnpm format:check` pass.
- typecheck: pass (`next typegen && tsc --noEmit`).
- tests: pass — `pnpm test` 16 files, 64 tests (node + browser); `pnpm i18n:check` pass.
- e2e: pass — `CI=1 pnpm test:e2e` against `pnpm start`: 42 passed, 2 skipped (viewport-specific tests).
- build: pass (`pnpm build`).
- lighthouse: pass locally (performance 1.0, accessibility 0.96 × 3 runs).

### Out of scope

- Spec 03: the signed-in redirect from `/`, real Google sign-in, and the `/signup` and `/login` pages (they 404 now, as accepted).
- Spec 15: precache `/` per locale.

### Follow-up — 2026-11-08

- Finding 1 fixed: `docs/specs/02-landing.md` now describes the wordmark in the mobile header and the footer.
- The inherited LanguageSwitcher label issue is fixed (see scratch 01). Lighthouse: accessibility 0.96, and the only remaining a11y failure is the accepted muted-text contrast.

### UI polish — 2026-11-08 (lead request after the review)

Walked `/` at 390, 768, 1024 and 1440 in `uk` and fixed what looked wrong:

- Header: the inline nav and "Get started" now appear from `lg` (1024). At 768 the Ukrainian nav crowded the header, and the spec says the tablet uses the mobile layout, so the menu sheet serves 768–1023.
- Hero phone: it had no fixed tall aspect ratio and left the bottom half of the screen empty. The screen now has decorative set rows (shapes only, no new copy) and a button shape. The offline pill moved into the chip row, so "Жим лежачи" no longer wraps. The chips are `whitespace-nowrap` ("Відпочинок 01:15" broke onto two lines at 390). The tilt starts at `lg`.
- Hero headline: `lg:text-6xl xl:text-7xl` plus `text-balance` (it was four lines in Ukrainian at 1024).
- BMI sparkline: `preserveAspectRatio="none"` with a non-scaling stroke, so it spans the card instead of sitting as a narrow strip in the middle.
- Offline banner: fills the showcase row height (`h-full`). At `lg` the mini phone stacks above a centered heading, and it goes side by side again from `xl` (the heading was six lines in the half column).
- Footer on phones: Product and Legal side by side, and the language switcher and copyright in one row.
- Checks after the change: lint, typecheck, i18n:check, test 64/64, build, e2e 42 passed / 2 skipped, Lighthouse perf 1.0 and a11y 0.96. Overflow is 0 at 390, 768, 1024 and 1440.
- Second pass (lead screenshots): features are one column under `sm`, with the icon left and the text right (2×2 was cramped at 390). The mobile menu links use `-mx-3 px-3`, so their text lines up with the title and buttons. The language dropdown is right-aligned to its trigger, `sideOffset` 8, min width max(trigger, 11rem), and has explicit radii (20px menu, 14px items). The `rounded-2xl` scale is ×1.8 of the 24px `--radius`, which made it pill-shaped.
- `src/components/ui/dropdown-menu.tsx`: the focused item uses `accent-soft` instead of the full `accent` fill in all menus (spec 01 risk note).
- The "4 Issues" badge in the lead's dev browser is a hydration warning caused by a browser extension, which adds `__processed_…` to `<body>`. A clean Chromium shows no console errors.

