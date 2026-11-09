# Decisions log

Answers the lead has given. Agents read this before asking a question and append to it after one is answered.

Format: `## YYYY-MM-DD — short title`, then **Context**, **Decision**, **Why** in one line each. Newest at the bottom. Architecture-level decisions also get an ADR in `docs/adr/`.

## 2026-11-08 — Platform

**Context:** Must run on Android, iPhone and laptop, and work in a basement gym.
**Decision:** One PWA, mobile-first, offline-first. Capacitor wrapper only if store presence or native notifications become necessary.
**Why:** One codebase, no store review, offline works on both platforms. See ADR 0001.

## 2026-11-08 — Stack

**Context:** Lead is a React + TypeScript developer; free tiers only at the start.
**Decision:** Next.js (App Router) for UI and API, Supabase Postgres + Storage, Better Auth (email + Google), Drizzle, Zod, Dexie, Tailwind + shadcn/ui, Vercel.
**Why:** One language end to end, shared Zod schemas, own backend logic, no paid auth. See ADRs 0002–0004.

## 2026-11-08 — Domain model

**Context:** Self-trainers first, trainers later.
**Decision:** Exercise → Workout (a reusable set of exercises) → Plan (calendar with recurring rules) → Session (what actually happened). No trainer role in the MVP; anyone can share a workout.
**Why:** Matches how people train alone and keeps the trainer mode an add-on. See ADR 0007.

## 2026-11-08 — Sharing

**Decision:** Share by token link (expiry, revoke) or JSON file. Import creates a copy, custom exercises are copied with it, history and measurements are never shared.

## 2026-11-08 — Offline behaviour

**Decision:** Online/offline pill with pending-changes count. Offline allows viewing, running sessions, logging sets and measurements. Offline blocks creating/editing workouts and plans, AI, sharing, importing by link and account changes. Logout is blocked while the outbox is not empty. See `docs/tech/OFFLINE.md`.

## 2026-11-08 — Delivery order

**Decision:** Foundation and manual features first, then offline and sharing, AI last, trainer mode after that.

## 2026-11-08 — Workflow

**Decision:** Specs in `docs/specs`, skills `/drill`, `/scratch`, `/implement`, `/review`. No status headers in specs; history is tracked through git. Review covers code and UI through Playwright against the spec's acceptance criteria.

## 2026-11-08 — One database

**Context:** Spec 00; free Supabase tier, solo project before launch.
**Decision:** One Supabase project `Pampojo` for local, previews, CI tests and production. Tests run in rolled-back transactions and never truncate. Separate databases are revisited before public launch.
**Why:** Simplest setup to run and pay for; supersedes the earlier two-project plan from the same day.

## 2026-11-08 — Migrations and deploy order

**Context:** One shared database; Vercel auto-deploy would race with migrations (spec 00).
**Decision:** PR CI runs `db:migrate` before tests. On `main`, a workflow runs `db:migrate`, then `vercel deploy --prod`; Vercel's automatic production deploy is off, previews stay automatic. Migrations are additive only; drops and renames go in a later migration after the code stops using them.
**Why:** PR migrations reach the production database before merge, so they must not break running code; code never deploys ahead of its schema.

## 2026-11-08 — Postgres driver

**Context:** Drizzle client for Supabase on serverless (spec 00).
**Decision:** `postgres` (postgres.js) with `prepare: false` on the transaction pooler URL; migrations use the session pooler URL (the direct connection is IPv6-only on the free tier).
**Why:** Drizzle's recommended driver for Supabase; works with the transaction pooler.

## 2026-11-08 — Health endpoint failure

**Context:** Keepalive must notice a paused or unreachable database (spec 00).
**Decision:** `GET /api/v1/health` returns 503 `{ ok: false, db: false }` when `select 1` fails, with no error details.
**Why:** A failed status turns the scheduled job red and GitHub sends a notification.

## 2026-11-08 — Node version

**Context:** Spec 00 pins Node LTS.
**Decision:** Node 26 (current LTS and Vercel's default at `/scratch` time), pinned in `.nvmrc`, `engines` and `engine-strict`.
**Why:** Newest supported runtime without pinning to a version Vercel cannot run.

## 2026-11-08 — shadcn/ui primitives

**Context:** shadcn CLI v4 asks for a primitives library at `init` (spec 00).
**Decision:** Radix (`radix-nova` style, neutral base color).
**Why:** Classic shadcn base with the most examples and blocks, well-tested accessibility.

## 2026-11-08 — UI languages

**Context:** Spec 01; the roadmap had Ukrainian as "later".
**Decision:** English and Ukrainian from day one. Every spec's Copy gives `en` and `uk`; the agent proposes Ukrainian, the lead reviews it. `pnpm i18n:check` fails CI on a missing or empty `uk` key.
**Why:** The lead wants both languages at launch; adding them per spec is cheaper than a later pass.

## 2026-11-08 — Locale resolution

**Context:** Spec 01; routes, PWA caching and SEO depend on it.
**Decision:** No locale in URLs. The `lang` cookie wins; otherwise `Accept-Language` picks `uk` when preferred over English, else `en`. `LanguageSwitcher` writes the cookie.
**Why:** Same URLs for both languages keep routing and the service worker cache simple; landing SEO in one language is acceptable.

## 2026-11-08 — Font

**Context:** Plus Jakarta Sans on Google Fonts has no basic Cyrillic (spec 01).
**Decision:** Nunito for both languages, weights 400/600/800, subsets latin and cyrillic.
**Why:** One rounded, friendly font that renders Ukrainian; lead's choice.

## 2026-11-08 — Avatar palette

**Context:** Spec 01 builds `EmojiAvatar`; spec 04 stores the choice.
**Decision:** 24 emoji (animals, fruit, sport) with kebab-case ids and 8 warm pastel backgrounds `--avatar-1…8`; the list is in spec 01.
**Why:** A 6×4 grid fits a phone; ids keep stored values stable if an emoji changes.

## 2026-11-08 — Contrast scope

**Context:** Computed contrast: muted text on background 3.98:1, destructive text 3.5:1 (spec 01).
**Decision:** WCAG AA is required only for text on `--accent` and `--accent-soft` (charcoal on peach, 6.98:1). Other tokens stay as documented.
**Why:** Lead's choice to keep the documented palette.

## 2026-11-08 — Dev UI page

**Context:** `/dev/ui` must not ship to users, but Vercel previews are production builds (spec 01).
**Decision:** `/dev/ui` returns 404 only when `VERCEL_ENV === 'production'`; it works locally and on previews.
**Why:** Previews are where `/review` checks the components.

## 2026-11-08 — Status pill copy

**Context:** Spec 01 builds `StatusPill` (visual only).
**Decision:** `Online` / `Offline`, plus ` · {count} pending` (`· {count} в черзі`) when count > 0; screen readers get a full plural sentence.
**Why:** Short enough for the mobile top bar.

## 2026-11-08 — Locale routing under Cache Components

**Context:** Reading the `lang` cookie in the root layout makes every page dynamic and blocking in Next 16 with Cache Components (scratch 01).
**Decision:** `src/proxy.ts` resolves the locale and rewrites internally to a hidden `[lang]` root segment; all page routes live under `src/app/[lang]/`, the locale is read with `next/root-params`. URLs stay unprefixed.
**Why:** Keeps pages statically prerendered per locale, as Next.js documents for i18n.

## 2026-11-08 — Language switch reloads

**Context:** Changing the hidden `[lang]` root segment always forces a full page load (scratch 01).
**Decision:** `LanguageSwitcher` sets the cookie and reloads the same URL.
**Why:** Language changes are rare; a reload keeps server-rendered text and `<html lang>` consistent.

## 2026-11-08 — Landing visuals

**Context:** Spec 02; the wireframe has a phone photo with dumbbells and 3D clay icons.
**Decision:** Hero phone mockup and showcase charts are built in code (tokens, components, static SVG); features and steps use lucide icons on accent-soft tiles. No raster images.
**Why:** Crisp at any size, translatable, light for Lighthouse; 3D art can come later.

## 2026-11-08 — Signed-in redirect from the landing

**Context:** Spec 02 AC2 needs sessions (spec 03); a server check would make the landing dynamic.
**Decision:** Spec 03 redirects `/` → `/today` in `src/proxy.ts` based on the session cookie.
**Why:** Keeps the landing static and puts the behavior where sessions exist.

## 2026-11-08 — Landing footer

**Context:** Spec 02 footer columns; no legal texts or resources yet.
**Decision:** Columns Product (anchors) and Legal (`/privacy`, `/terms` placeholder pages "Coming soon."). No Resources column.
**Why:** No empty links; real legal pages replace the placeholders before launch.

## 2026-11-08 — Lighthouse in CI

**Context:** Spec 02 requires Lighthouse ≥ 90 on mobile.
**Decision:** `@lhci/cli` job in the PR workflow, mobile preset, 3 runs on `/`, median performance and accessibility ≥ 0.9 or the PR fails.
**Why:** Lead's choice: catch regressions automatically rather than at review.

## 2026-11-08 — Font changed to Manrope

**Context:** Nunito looked too soft; the lead asked for a sharper font with Cyrillic, preferably Plus Jakarta Sans.
**Decision:** Manrope 400/600/800 (latin + cyrillic) replaces Nunito everywhere, including the OG image. Plus Jakarta Sans still has no basic Cyrillic on Google Fonts (checked in Chromium).
**Why:** Closest geometric match to Jakarta with full Ukrainian support. Supersedes the "Font" entry above.

## 2026-11-08 — Wordmark

**Context:** Lead iterated on the wordmark: first a charcoal dumbbell inside the P, then a dark badge around the whole word (rejected as crooked).
**Decision:** The "P" is the app icon (charcoal rounded square, orange P, dumbbell cut-out); "ampojo" stays charcoal on the page. The icon's P aligns with the x-height and baseline, and the square ends at the descenders. Used in the header (mobile and desktop) and footer.
**Why:** Ties the wordmark to the app icon and reads cleanly on cream.

## 2026-11-08 — Account emails postponed

**Context:** Spec 03; sending email to real users needs a provider and an own domain the lead does not have yet.
**Decision:** Password reset, email verification and Google linking move to a new spec 27, planned in M4 before sharing (19). Spec 03 ships email + password and Google without them.
**Why:** Unblocks auth now; email delivery is set up once, with a domain.

## 2026-11-08 — No Google account linking (until 27)

**Context:** Without email verification, auto-linking Google to an existing password account allows account pre-hijacking.
**Decision:** No linking. Google sign-in with an email that has a password account fails with "registered with a password"; email sign-up with a Google account's email fails with "already exists".
**Why:** Safe by default; spec 27 enables linking for verified emails.

## 2026-11-08 — Post-auth landing before onboarding exists

**Context:** `/onboarding` and the onboarding flag arrive in spec 04, `/today` in 05.
**Decision:** Spec 03 adds a protected `/today` placeholder (signed-in email + Log out) and sends every successful auth there; spec 04 adds the onboarding redirect, spec 05 replaces the page.
**Why:** Everything in 03 is testable without pulling in 04.

## 2026-11-08 — Auth rate limiting

**Context:** Better Auth's default in-memory limiter is ineffective on serverless.
**Decision:** Database storage (`rate_limit` table); sign-in and sign-up 10 requests / 60 s per IP.
**Why:** No new service; works across Vercel instances.

## 2026-11-08 — Google sign-in on previews

**Context:** Google OAuth needs exact redirect URIs; every preview has a new domain.
**Decision:** Google sign-in only on localhost and production; previews hide the Google buttons.
**Why:** No per-preview OAuth setup; email + password covers preview testing.

## 2026-11-08 — Session lifetime

**Context:** Spec 03 AC requires staying signed in on the phone for at least 30 days.
**Decision:** Database sessions, 30-day sliding expiry refreshed at most daily; HTTP-only, `SameSite=Lax`, `Secure` in production.
**Why:** Meets the requirement with Better Auth defaults adjusted, decided during drill.

## 2026-11-09 — Auth form validation and layout

**Context:** After the spec 03 review, the lead looked at the sign-up form.
**Decision:** Field errors appear only after the first submit, then update as the user types (no on-blur errors). No "At least 8 characters" hint on sign-up. The password field's placeholder is `••••••••` on both pages (not translated). On desktop the auth page fits one screen without scrolling.
**Why:** Early errors and the duplicated hint made the form noisy; the lead's call.

## 2026-11-09 — Onboarding fields are required

**Context:** Spec 04; skippable fields would leave BMI and future norms without data.
**Decision:** Name, avatar, sex, birth date, height and weight are all required. Sex is `male` / `female`. A user without a `profile` row has not finished onboarding.
**Why:** The flow is three short steps; complete profiles keep later features simple.

## 2026-11-09 — Minimum age 16

**Context:** Spec 04 stores body data; the EU digital consent age is 13–16 by country.
**Decision:** Age must be 16–100. Under 16 is a field error; the account is not blocked.
**Why:** Safe for every EU country without parental consent.

## 2026-11-09 — Birth date instead of birth year

**Context:** Spec 04; the data model had `birthYear`.
**Decision:** Onboarding asks for the date of birth (three numeric fields DD / MM / YYYY in both languages); `profile.birthDate date` replaces `birthYear`. Age is computed in full years on today's date.
**Why:** Lead wants the profile to show the exact current age.

## 2026-11-09 — Onboarding draft and finish

**Context:** Spec 04 AC2 needs values to survive a reload mid-onboarding.
**Decision:** The draft lives in `localStorage` per user, cleared on finish and log out. Finish is one idempotent `PUT /api/v1/me/profile` that creates the profile and first weight and sets `onboardingCompletedAt`; a repeat changes nothing. Edits use `PATCH` with only changed fields; `GET` / `PATCH` return 404 `PROFILE_NOT_FOUND` before onboarding.
**Why:** No half-filled profiles in the database; one request to make safe.

## 2026-11-09 — Onboarding avatar and name

**Context:** Spec 04 step 1.
**Decision:** A random emoji and color are pre-selected and can be changed. Name 1–40 characters, trimmed, prefilled only for Google sign-ups; saving it also updates `user.name`.
**Why:** Lead's choice for the avatar; the email local part looks odd as a name.

## 2026-11-09 — Weight edits in the profile

**Context:** Spec 04 Edit profile; weight lives in `body_measurement`.
**Decision:** Changing the weight writes today's weight measurement (profile time zone): update it if one exists today, else insert. Older ones stay as history.
**Why:** Keeps a history for spec 14 without duplicate rows per day.

## 2026-11-09 — Units and precision

**Context:** Spec 04 metric/imperial input.
**Decision:** The step 3 toggle sets `profile.unitSystem`; the same toggle is in Edit profile. Height in whole cm or ft + in, weight with one decimal; stored in cm and kg rounded to 0.1.
**Why:** Enough precision for a weight trend; no separate Settings block yet.

## 2026-11-09 — Language is not stored

**Context:** `DATA_MODEL.md` had `profile.locale`, while the language lives in the `lang` cookie.
**Decision:** No language column. The cookie stays the only source.
**Why:** Lead: the language is a client-side preference only.

## 2026-11-09 — Log out and profile entry before the app shell

**Context:** Spec 04 ships `/profile` before spec 05 adds navigation.
**Decision:** The `/today` placeholder links to `/profile` instead of showing Log out. The onboarding header has a small Log out button.
**Why:** Profile is reachable, and a user in the wrong account is not stuck in onboarding.

## 2026-11-09 — TanStack Query arrives with spec 04

**Context:** Scratch 04; ADR 0006 and `state-and-data.md` prescribe TanStack Query and `src/api/http.ts`, neither existed yet.
**Decision:** Spec 04 adds `@tanstack/react-query`, `src/api/http.ts`, `src/api/query-client.ts` and the provider; `/profile` uses `useProfileQuery` with server-loaded initial data.
**Why:** Follows the guide from the first screen with server data; specs 05 and 06 build on it.

## 2026-11-10 — No query pipelining on the transaction pooler

**Context:** Review of spec 04; with about 6+ parallel requests, postgres.js pipelined queries onto busy connections and the Supabase transaction pooler stalled them forever (backends stuck in `ClientRead`).
**Decision:** The app's Drizzle client sets `max_pipeline: 1` (one query in flight per connection), keeping `prepare: false` and `max: 5`.
**Why:** Fixes the hang without a new pooler or a bigger pool; a full queue now waits instead of stalling. Approved by the lead.

## Open questions

Raise these during `/drill` of the listed spec.

- Data layer before spec 15: write sessions straight to the server, or build the local Dexie layer from spec 10? (spec 10)
- Exercise dataset source and its license. (spec 06)
- Speech-to-text and image generation providers. (specs 20, 24)
