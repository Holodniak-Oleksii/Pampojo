# 02. Landing page

## Goal

Explain Pampojo to a first-time visitor in one scroll and get them to sign up.

## Scope

Public page at `/` (`src/app/[lang]/(marketing)/page.tsx`, replacing the spec 00 placeholder). It is statically prerendered per locale and contains only server components, except the mobile menu, the FAQ accordion and the `LanguageSwitcher`. Reference: `docs/wireframes/01-landing.png`, for mood and layout, not pixels.

Sections, in order:

1. **Header**
   - Desktop: wordmark (links to `/`), anchor links Features / How it works / FAQ, Log in, Get started.
   - Mobile: the same wordmark, Log in, and a menu button that opens a `Sheet` from the right. The sheet holds the three anchor links, Log in, Get started and the `LanguageSwitcher`.
   - The header is sticky, with the background color.
2. **Hero** (`id="top"`): headline, subtitle, Get started (primary), Continue with Google (secondary, Google "G" mark), trust line, and the session-screen visual.
3. **Features** (`id="features"`): 4 cards. Each has a lucide icon in a rounded `accent-soft` tile with an `accent` icon color, a title and one sentence. The section heading is visually hidden.
4. **How it works** (`id="how-it-works"`): heading plus 3 numbered steps, each with a number badge (accent), a title, a sentence and a small lucide icon.
5. **Progress showcase**, with static illustrative data and a visually hidden heading:
   - `SegmentedGauge` "Plan adherence" at 82;
   - a "Bench press progress" card with a static SVG line chart (accent line, soft area, 8 points rising) and the caption "3 months";
   - a `StatCard` "BMI" 24.8 with trend down -0.6 and a small static SVG sparkline.

   No chart library.
6. **Offline highlight**: a peach gradient banner with a small phone frame showing `StatusPill` offline and the text "3 sets saved, will sync later", plus the headline.
7. **FAQ** (`id="faq"`): heading plus 4 accordion items (shadcn `accordion`). Single-open, all collapsed at first.
8. **CTA banner**: charcoal pill banner with the headline and Get started (accent).
9. **Footer**: wordmark, the tagline, link columns Product (Features, How it works, FAQ: anchors on `/`) and Legal (Privacy → `/privacy`, Terms → `/terms`), the `LanguageSwitcher`, and the copyright `© {year} Pampojo` (the build year).

### Hero visual

Built in code, not an image. A phone frame (charcoal rounded rectangle, cream screen) shows a session screen:

- exercise title "Bench Press";
- the set "80 kg × 8" in large tabular numbers;
- a rest chip "Rest 01:15";
- a PR chip "PR +5 kg" (accent-soft, trophy icon);
- an offline chip (`StatusPill` offline).

Desktop: the phone is tilted slightly (`rotate-6`) on a soft peach radial gradient. Mobile: smaller, under the buttons, not tilted. The whole visual is `aria-hidden`; its text is decorative.

### Links

- Get started → `/signup`. Log in → `/login`.
- Continue with Google → `/signup` until spec 03 replaces it with Google sign-in.
- These routes 404 until spec 03 ships. That is accepted.
- Anchor links scroll smoothly. `prefers-reduced-motion` turns smooth scrolling off.

### Placeholder legal pages

`/privacy` and `/terms`: `PageHeader` with the title, the body text "Coming soon." and a link back to `/`. They share the marketing header and footer. They are static.

### Metadata

- Per locale: `title`, `description`, Open Graph (`og:title`, `og:description`, `og:type=website`, `og:image`) and Twitter `summary_large_image`.
- The OG image is generated with `opengraph-image.tsx` (1200×630, `ImageResponse`): cream background, brand icon, the headline in the active language. Crawlers without `Accept-Language` get English.

### Lighthouse CI

New dev dependency `@lhci/cli`. A `lighthouse` job in the PR workflow:

- builds and starts the app, then runs Lighthouse with the mobile preset on `/` three times;
- asserts the median `performance` ≥ 0.9 and `accessibility` ≥ 0.9;
- fails the PR below that.

Config in `lighthouserc.json`.

## Out of scope

- Redirecting signed-in users from `/` to `/today`: spec 03 does it in `src/proxy.ts`, so the landing stays static.
- Real Google sign-in (03), real legal texts, blog, analytics.
- 3D illustrations; lucide icons stand in for them.

## UX

- **Mobile (360–767px)**: single column with a 16px gutter. The hero visual goes under the CTA buttons, and the buttons stack full width. Features in a 2×2 grid, steps stacked, showcase cards stacked, FAQ single column, footer columns stacked.
- **Desktop (≥ 1024px)**: content max width 1200px. Hero in two columns (text left, visual right), features in a row of 4, steps in a row of 3 with arrow separators, showcase as gauge + chart in one card and BMI under them with the offline banner to the right, FAQ in two columns of two items, footer in one row.
- The tablet width (768–1023px) uses the mobile layout with 2-column grids.
- **Focus order** follows the visual order. Every interactive element has a visible focus ring. The menu button has an accessible name, and so does the sheet's close button.
- **Empty, loading and error states** do not apply (static page). Offline: once spec 15 caches it, the page works like any static page.

## Copy

| Where | en | uk |
| --- | --- | --- |
| Meta title | Pampojo — workout tracker that works offline | Pampojo — трекер тренувань, що працює офлайн |
| Meta description | Build workouts, plan them in a calendar and log every set in the gym, even without a signal. | Створюй тренування, плануй їх у календарі й записуй кожен підхід у залі, навіть без зв'язку. |
| Nav | Features / How it works / FAQ | Можливості / Як це працює / Питання |
| Log in | Log in | Увійти |
| Get started | Get started | Почати |
| Menu button (accessible name) | Open menu | Відкрити меню |
| Sheet title | Menu | Меню |
| Sheet close (accessible name) | Close | Закрити |
| Hero headline | Your workouts. Even offline. | Твої тренування. Навіть офлайн. |
| Hero subtitle | Build workouts, plan them in a calendar and track every set right in the gym, no signal needed. | Створюй тренування, плануй їх у календарі й записуй кожен підхід прямо в залі, навіть без зв'язку. |
| Google button | Continue with Google | Продовжити з Google |
| Trust line | Free • Works on iPhone, Android and laptop | Безкоштовно • Працює на iPhone, Android і ноутбуці |
| Mockup | Bench Press / 80 kg × 8 / Rest 01:15 / PR +5 kg | Жим лежачи / 80 кг × 8 / Відпочинок 01:15 / Рекорд +5 кг |
| Features heading (hidden) | Features | Можливості |
| Feature 1 | Build your own workouts — Pick exercises from the catalog and set sets, reps and weight. | Створюй свої тренування — Обирай вправи з каталогу й задавай підходи, повтори та вагу. |
| Feature 2 | Plan with a calendar — Repeat workouts on your days and always see what's next. | Плануй у календарі — Повторюй тренування у свої дні й завжди знай, що далі. |
| Feature 3 | Works offline in the gym — Log sets in a basement with no signal. Everything syncs later. | Працює офлайн у залі — Записуй підходи навіть у підвалі без зв'язку. Усе синхронізується пізніше. |
| Feature 4 | Share workouts with friends — Send a link or a file. Your friend gets their own copy. | Ділись тренуваннями з друзями — Надішли посилання або файл, і друг отримає власну копію. |
| How it works heading | How it works | Як це працює |
| Step 1 | Create a workout — Choose exercises and save it once. | Створи тренування — Обери вправи й збережи його один раз. |
| Step 2 | Schedule it — Put it on your calendar, once or every week. | Заплануй — Додай у календар разово або щотижня. |
| Step 3 | Train and track — Log every set and watch your progress grow. | Тренуйся й відстежуй — Записуй кожен підхід і дивись, як росте прогрес. |
| Showcase heading (hidden) | Your progress at a glance | Твій прогрес з першого погляду |
| Showcase labels | Plan adherence / Bench press progress / 3 months / BMI | Виконання плану / Прогрес жиму лежачи / 3 місяці / ІМТ |
| Offline banner | Train in the basement. Sync when you're back online. | Тренуйся в підвалі. Синхронізуй, коли повернешся онлайн. |
| Offline mockup | 3 sets saved, will sync later | 3 підходи збережено, синхронізуємо пізніше |
| FAQ heading | FAQ | Часті питання |
| FAQ 1 | Is Pampojo free? — Yes. Pampojo is free to use. | Pampojo безкоштовний? — Так. Користуватися Pampojo можна безкоштовно. |
| FAQ 2 | Does it work without internet? — Yes. After the first visit you can run workouts and log sets offline. Changes sync when you're back online. | Чи працює без інтернету? — Так. Після першого відкриття можна проводити тренування й записувати підходи офлайн. Зміни синхронізуються, коли з'явиться зв'язок. |
| FAQ 3 | Can I use it on iPhone? — Yes. Open Pampojo in Safari and add it to your Home Screen. It also works on Android and laptops. | Чи можна на iPhone? — Так. Відкрий Pampojo в Safari й додай на початковий екран. Також працює на Android і ноутбуках. |
| FAQ 4 | How do I share a workout? — Share a link or a file from the workout. Your friend imports their own copy; your history stays private. | Як поділитися тренуванням? — Поділись посиланням або файлом прямо з тренування. Друг імпортує власну копію, а твоя історія лишається приватною. |
| CTA | Start training smarter today | Тренуйся розумніше вже сьогодні |
| Footer tagline | Track. Progress. Repeat. | Тренуйся. Прогресуй. Повторюй. |
| Footer columns | Product / Legal | Продукт / Правова інформація |
| Legal links | Privacy / Terms | Конфіденційність / Умови |
| Privacy page title | Privacy policy | Політика конфіденційності |
| Terms page title | Terms of use | Умови використання |
| Placeholder body | Coming soon. | Скоро буде. |
| Back link | Back to home | На головну |
| Copyright | © {{year}} Pampojo | © {{year}} Pampojo |
| Logo link (accessible name) | Pampojo home | Pampojo — головна |

## Data and API

None.

## Acceptance criteria

- [ ] AC1: A visitor sees all nine sections in the order listed, at 390px and at 1440px, in English and in Ukrainian. Every text matches the Copy table.
- [ ] AC2: Get started links go to `/signup`, Log in to `/login`, Continue with Google to `/signup`.
- [ ] AC3: Header and footer anchor links scroll to `#features`, `#how-it-works` and `#faq`. The URL hash updates, and the target heading is in the viewport.
- [ ] AC4: On mobile the menu button opens the sheet with touch and with Enter or Space. Escape and the close button close it, and focus returns to the menu button. Choosing a link in the sheet closes it and scrolls to the section.
- [ ] AC5: FAQ items expand and collapse by click and by keyboard (Tab to the trigger, Enter or Space). `aria-expanded` reflects the state, and only one item is open at a time.
- [ ] AC6: The page has a localized `<title>`, meta description, `og:title`, `og:description`, `og:image` (200, `image/png`, 1200×630) and `twitter:card=summary_large_image`.
- [ ] AC7: The Lighthouse CI job passes on the PR: mobile median performance ≥ 0.9 and accessibility ≥ 0.9 on `/`.
- [ ] AC8: No horizontal scroll at 360px, 390px and 1440px.
- [ ] AC9: `/privacy` and `/terms` render their title, "Coming soon." and a working Back to home link, in both languages.
- [ ] AC10: The hero visual and the showcase use no raster images. The only images on `/` are the SVG brand marks.

## Depends on

01.

## Open questions
