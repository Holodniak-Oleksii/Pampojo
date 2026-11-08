# 00. Project setup

## Goal

A deployable empty app with the agreed stack, tooling, database connection and CI, so every later spec only adds features.

## Scope

### App and tooling

- Next.js (latest stable, App Router, TypeScript strict, `src/` dir, `@/` alias), pnpm (pinned through `packageManager`).
- Node: the newest LTS major that Vercel supports as a runtime when `/scratch` runs. `/scratch` checks and records the exact major. Pinned in `package.json` `engines`, `.nvmrc` and the Vercel project setting.
- The repository already contains `docs/`, `.claude/`, `scratch/` and root files, so `create-next-app` must run in a temporary folder and its files moved in (or the app is set up by hand). Do not overwrite `CLAUDE.md`, `README.md` or `.gitignore`; merge.
- ESLint (Next config + typescript-eslint + testing-library + jsx-a11y) and Prettier.
- Tailwind CSS and shadcn/ui initialised (`components.json`); no custom theme yet (spec 01).
- Placeholder page at `/`: a single `<h1>` with the text `Pampojo`. No i18n yet (spec 01 sets it up); spec 02 replaces the page.

### Database

- One Supabase project, `Pampojo`. Local development, Vercel previews, CI tests and production all use the same database.
- Drizzle ORM + drizzle-kit with the `postgres` (postgres.js) driver. `src/server/db/client.ts` uses the transaction pooler URL (port 6543) with `prepare: false`. Empty `schema/index.ts`.
- Scripts `db:generate`, `db:migrate`, `db:seed` (no-op).
- Migrations run through the session pooler URL (port 5432), not the transaction pooler. The direct connection is not used: on the free tier it is IPv6-only, and GitHub Actions runners cannot reach it reliably.
- Migrations must be additive: add tables, columns and indexes, but never drop or rename anything. Previews and PR CI apply a migration to the shared database before it is merged, so the running production code must keep working with it. Dropping something needs a separate migration after the code that used it is gone.

### Env and HTTP

- `src/server/env.ts` validates env with Zod. `.env.example` lists every variable with a comment: `DATABASE_URL` (transaction pooler, runtime) and `DATABASE_MIGRATION_URL` (session pooler, drizzle-kit).
- Locally the values live in `.env.local`. `.env*` is git-ignored except `.env.example`.
- Validation runs when the server starts (`instrumentation.ts`), so a missing variable stops `pnpm dev` / `pnpm start` with a message that names each missing or invalid variable.
- `src/server/http/` with `withHandler`, `json()`, `DomainError` and the error-to-status table.
- `GET /api/v1/health`, no auth, `Cache-Control: no-store`:
  - runs `select 1`; on success returns 200 `{ "ok": true, "db": true }`;
  - if the query fails or times out returns 503 `{ "ok": false, "db": false }`, with no error details in the body; the error is logged on the server.

### Tests

- Vitest with two projects: `node` for `src/server` and helpers, `browser` (Playwright Chromium) for components. One sample test each. The node sample covers the health handler: 200 with a working DB and 503 when the DB call fails (DB failure is simulated by mocking the client).
- Database tests run against the `Pampojo` database. Each test runs inside a transaction that is rolled back, so tests never leave rows behind. Tests never truncate tables or touch data outside their own transaction, because this is the production database.
- Playwright with `mobile` (390×844) and `desktop` (1440×900) projects, one smoke test opening `/` and checking the `Pampojo` heading.
- `src/test/render.tsx` and `src/test/mocks.ts` skeletons as described in the frontend testing guide.

### CI/CD

- **PR workflow** (every PR): install, lint, typecheck, `db:migrate`, unit tests, build. e2e also runs on PRs labelled `e2e`.
- **Main workflow** (push to `main`): the same checks plus e2e, then `db:migrate`, then `vercel deploy --prod`. Deploy runs only if the migration succeeded. Vercel's own automatic production deploy from Git is turned off (`vercel.json`). Preview deploys per PR stay automatic.
- **Keepalive workflow** (schedule, every 3 days, plus manual `workflow_dispatch`): calls production `/api/v1/health` and fails on a non-200 response, so the free project does not pause.
- GitHub Actions secrets: `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. GitHub Actions variable: `PROD_URL`. The lead creates them, and the README lists them.
- Vercel project linked. `DATABASE_URL` and `DATABASE_MIGRATION_URL` are set to the same values for the Production, Preview and Development environments.

### Docs

- README "Running locally" section: prerequisites, how to fill `.env.local` from the Supabase **Connect** dialog, commands, the additive-migrations rule, how migrations reach the database, and the list of required GitHub secrets and Vercel env vars.

## Out of scope

- Theme, i18n setup (01), pages (02+), auth (03), any domain table.
- Separate dev, test or prod databases. Revisit before public launch.
- Pre-commit hooks (husky, lint-staged).
- Branch protection rules and other GitHub settings (the lead sets them by hand).
- Proving that a failed migration blocks the deploy end to end: 00 has no migrations. Spec 03 checks it with the first real migration.

## Data and API

- No tables.
- `GET /api/v1/health` as described in Scope. It is public, like the share preview (see `docs/development/backend/api-handlers.md`).

## Acceptance criteria

- [ ] AC1: `pnpm dev` serves `/` with a visible `Pampojo` heading.
- [ ] AC2: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass locally and in the PR workflow.
- [ ] AC3: `GET /api/v1/health` returns 200 `{ "ok": true, "db": true }` against the `Pampojo` database, with `Cache-Control: no-store`.
- [ ] AC4: When the database query fails, `GET /api/v1/health` returns 503 `{ "ok": false, "db": false }` (covered by the node test).
- [ ] AC5: A PR gets a Vercel preview URL, and the health endpoint returns 200 there.
- [ ] AC6: `pnpm test:e2e` runs the smoke test in both `mobile` and `desktop` projects and it passes.
- [ ] AC7: Starting the server with `DATABASE_URL` unset fails at startup with a message naming `DATABASE_URL`.
- [ ] AC8: The PR workflow runs `db:migrate` before the tests.
- [ ] AC9: A push to `main` runs the checks, then `db:migrate`, then deploys to Vercel production; the deploy job depends on the migrate job. Production `/api/v1/health` returns 200 with `db: true`.
- [ ] AC10: The keepalive workflow runs on its schedule and by manual dispatch, and succeeds against production.
- [ ] AC11: Following the README "Running locally" section on a new machine gets `pnpm dev` working, and the section lists the required secrets and env vars.

## Depends on

Lead has created: GitHub repo, Supabase project `Pampojo`, Vercel account.

## Open questions
