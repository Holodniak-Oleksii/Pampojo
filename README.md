# Pampojo

Offline-first gym workout tracker. Build your own workouts, plan them in a calendar, log every set in the gym without a signal, and share workouts with friends.

> This README is a case-study skeleton. Fill each section as the project grows.

## Problem

People who train on their own plans juggle notes apps, spreadsheets and memory. Gyms are often in basements with no signal, so cloud-only apps fail exactly where they are needed.

## Solution

- Workouts built from a structured exercise catalog.
- A calendar plan with recurring sessions and adherence tracking.
- A fast session mode that works fully offline and syncs later.
- Progress charts, personal records, body measurements and BMI.
- Sharing workouts by secure link or file; import makes a copy.
- AI features on top of the same data: workout generation, smart substitutions, exercise creation by voice.

## Architecture

See `docs/tech/ARCHITECTURE.md`. Key decisions live in `docs/adr/`.

## AI approach

See `docs/tech/AI.md`: catalog-constrained generation, structured output, validation, evals in CI.

## How it was built

Spec-driven development with an AI agent: `docs/specs` → `/drill` → `/scratch` → `/implement` → `/review`. See `CLAUDE.md`.

## Running locally

### Prerequisites

- Node 26: `nvm install && nvm use` (reads `.nvmrc`). `engine-strict` refuses other versions.
- pnpm through corepack: `corepack enable`. The version is pinned in `package.json` (`packageManager`).

### Environment

Copy `.env.example` to `.env.local` and fill both values from the Supabase project **Pampojo**: **Connect → Direct connection string → Type: URI**, block **Shared pooler**.

| Variable | Connection method | Used by |
| --- | --- | --- |
| `DATABASE_URL` | Transaction pooler, port `6543` | the app at runtime |
| `DATABASE_MIGRATION_URL` | Session pooler, port `5432` | drizzle-kit migrations |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | session signing (required) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud → OAuth client (Web application) | Google sign-in (optional; hidden when unset) |

For local Google sign-in add the redirect URI `http://localhost:3000/api/auth/callback/google` to the OAuth client. Google sign-in never runs on Vercel previews.

Replace `[YOUR-PASSWORD]` including the brackets. Percent-encode special characters in the password (`?` → `%3F`, `$` → `%24`, `@` → `%40`, `#` → `%23`, `/` → `%2F`), or reset it to letters and digits under **Project Settings → Database**. Do not use the Direct connection: on the free tier it is IPv6-only.

The server refuses to start when a required variable is missing or invalid and names the variable. `pnpm build` and `pnpm typecheck` need `DATABASE_URL` too, because they load `next.config.ts`, which validates env; set up `.env.local` first.

### Run

```bash
pnpm install
pnpm db:migrate
pnpm dev                                    # http://localhost:3000
curl localhost:3000/api/v1/health           # {"ok":true,"db":true}
```

### Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm lint` | ESLint |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm typecheck` | Route type generation + `tsc --noEmit` |
| `pnpm test` | Vitest: `node` and `browser` (Chromium) projects |
| `pnpm test:e2e` | Playwright, `mobile` (390×844) and `desktop` (1440×900) |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |
| `pnpm db:seed` | Seed the exercise catalog (no-op for now) |
| `pnpm i18n:extract` | Update `src/i18n/locales/{en,uk}.json` from `t()` calls |
| `pnpm i18n:check` | Fail if catalogs are stale or `uk` misses a key or plural form |
| `pnpm lighthouse` | Lighthouse CI on `/` (mobile, 3 runs, perf and a11y ≥ 0.9); run after `pnpm build` |
| `pnpm icons:generate` | Regenerate favicons from `docs/brand/pampojo-icon.svg` |

First run of the browser tests: `pnpm exec playwright install chromium`.

### Database and migrations

There is one Supabase database for local development, Vercel previews, CI tests and production. Tests only run inside rolled-back transactions and never truncate.

Because PR CI applies migrations to that database before merge, **migrations are additive only**: add tables, columns and indexes, never drop or rename. Remove something in a later migration, after the code that used it is gone.

- Pull request: CI runs `pnpm db:migrate` before the tests.
- Push to `main`: checks → e2e → `pnpm db:migrate` → `vercel deploy --prod`. A failed migration stops the deploy.

### Deploy setup

Vercel's automatic production deploy from Git is disabled in `vercel.json`; production deploys come only from the `main` workflow. Preview deploys per PR stay automatic.

**Vercel → Settings → Environment Variables**: `DATABASE_URL`, `DATABASE_MIGRATION_URL` and `BETTER_AUTH_SECRET`, same values for Production, Preview and Development. Production also needs `BETTER_AUTH_URL` (the production URL; env validation fails the production build without it) and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (with `<prod URL>/api/auth/callback/google` as a redirect URI). If preview builds fail to detect the pnpm version, also add `ENABLE_EXPERIMENTAL_COREPACK=1`.

The auth rate limiter keys requests by the `x-forwarded-for` header. Vercel sets it from the real client IP. When self-hosting, put the app behind a proxy that overwrites this header, or clients can spoof it and bypass the limit.

**GitHub → Settings → Secrets and variables → Actions**:

| Name | Kind | Value |
| --- | --- | --- |
| `DATABASE_URL` | secret | Transaction pooler URL |
| `DATABASE_MIGRATION_URL` | secret | Session pooler URL |
| `BETTER_AUTH_SECRET` | secret | Same value as in Vercel |
| `VERCEL_TOKEN` | secret | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | secret | `orgId` in `.vercel/project.json` after `pnpm dlx vercel link` |
| `VERCEL_PROJECT_ID` | secret | `projectId` in the same file |
| `PROD_URL` | variable | Production URL without a trailing slash, e.g. `https://pampojo.vercel.app` |

The `Keepalive` workflow calls production `/api/v1/health` every 3 days so the free Supabase project does not pause. Run it by hand from the Actions tab to check the setup. Label a PR `e2e` to run Playwright on it.

## What I would do next

-
