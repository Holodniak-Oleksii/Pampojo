# 00. Project setup

## Goal

A deployable empty app with the agreed stack, tooling, database connection and CI, so every later spec only adds features.

## Scope

- Next.js (latest stable, App Router, TypeScript strict, `src/` dir, `@/` alias), pnpm, Node LTS pinned in `package.json` `engines` and `.nvmrc`.
- The repository already contains `docs/`, `.claude/`, `scratch/` and root files, so `create-next-app` must run in a temporary folder and its files moved in (or the app is set up by hand). Do not overwrite `CLAUDE.md`, `README.md` or `.gitignore`; merge.
- ESLint (Next config + typescript-eslint + testing-library + jsx-a11y) and Prettier.
- Tailwind CSS and shadcn/ui initialised (`components.json`); no custom theme yet (spec 01).
- Drizzle ORM + drizzle-kit, `src/server/db/client.ts`, empty `schema/index.ts`, scripts `db:generate`, `db:migrate`, `db:seed` (no-op).
- `src/server/env.ts` validating env with Zod; `.env.example` updated.
- `src/server/http/` with `withHandler`, `json()`, `DomainError` and the error-to-status table; `GET /api/v1/health` returning `{ ok: true, db: true }` after a `select 1`.
- Vitest with two projects: `node` for `src/server` and helpers, `browser` (Playwright Chromium) for components. One sample test each.
- Playwright with `mobile` (390×844) and `desktop` (1440×900) projects, one smoke test opening `/`.
- `src/test/render.tsx` and `src/test/mocks.ts` skeletons as described in the frontend testing guide.
- GitHub Actions: install, lint, typecheck, unit tests, build on every PR; e2e on `main` and on PRs labelled `e2e`.
- GitHub Action on a schedule (every 3 days) calling `/api/v1/health` in production so the free Supabase project does not pause.
- Vercel project linked; preview deploys per PR.
- README "Running locally" section.

## Out of scope

Theme, pages, auth, any domain table.

## Acceptance criteria

- [ ] AC1: `pnpm dev` serves a placeholder page at `/`.
- [ ] AC2: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass locally and in CI.
- [ ] AC3: `GET /api/v1/health` returns 200 with `db: true` against the Supabase dev database.
- [ ] AC4: A PR gets a Vercel preview URL; the health endpoint works there.
- [ ] AC5: `pnpm test:e2e` runs the smoke test in both viewports.
- [ ] AC6: Missing required env variables fail fast at startup with a clear message.

## Depends on

Lead has created: GitHub repo, Supabase project (dev), Vercel account.

## Open questions

- Separate Supabase project for production now, or later before launch?
