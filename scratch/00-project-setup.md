# 00-project-setup — technical plan

Spec: `docs/specs/00-project-setup.md`

## 1. Summary

Turn the docs-only repository into an empty, deployable Next.js app. The app gets the agreed tooling (TypeScript strict, ESLint, Prettier, Tailwind, shadcn/ui), a Drizzle connection to the single Supabase database `Pampojo`, Zod-validated env, the HTTP handler layer and a public `GET /api/v1/health`. Tests run in Vitest (node + browser) and Playwright (mobile + desktop). There are three GitHub Actions workflows (PR checks, main migrate → deploy, keepalive) and a README "Running locally" section. No domain tables, no auth, no theme.

Fixed facts:

- **Node 26** (current LTS, the Vercel default). Pinned in `.nvmrc`, `engines` and `.npmrc` `engine-strict=true`. The lead's machine runs Node 24 and must switch (`nvm install 26`).
- **pnpm**: the current stable at implement time, pinned through `packageManager` (`pnpm@<exact version>`).
- **Database**: one Supabase project `Pampojo` for local, previews, CI and production. `DATABASE_URL` = transaction pooler (port 6543). `DATABASE_MIGRATION_URL` = session pooler (port 5432). `.env.local` already exists locally with both values.
- Migrations are additive only (no drop, no rename). PR CI migrates the shared database before merge.

## 2. Acceptance criteria

- AC1: `pnpm dev` serves `/` with a visible `<h1>` reading `Pampojo`.
- AC2: `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally and in the PR workflow.
- AC3: `GET /api/v1/health` returns status 200, body `{ "ok": true, "db": true }` and header `Cache-Control: no-store` when the `Pampojo` database answers `select 1`.
- AC4: When the database query fails or times out, `GET /api/v1/health` returns 503 with body `{ "ok": false, "db": false }` and no error details. A node test covers this by making the DB call reject.
- AC5: A PR gets a Vercel preview URL, and `/api/v1/health` returns 200 there. Checked manually in `/review`; needs the lead's Vercel setup.
- AC6: `pnpm test:e2e` runs the smoke test in both Playwright projects `mobile` (390×844) and `desktop` (1440×900), and both pass.
- AC7: Starting the server (`pnpm dev` or `pnpm start`) with `DATABASE_URL` unset or empty stops at startup. The error message names `DATABASE_URL` and never prints a value.
- AC8: The PR workflow runs `pnpm db:migrate` before `pnpm test`.
- AC9: A push to `main` runs the checks, then `pnpm db:migrate`, then deploys to Vercel production. The deploy job declares `needs:` on the migrate job, so a failed migration stops the deploy. Production `/api/v1/health` then returns 200 with `db: true`.
- AC10: The keepalive workflow runs on a schedule every 3 days and via `workflow_dispatch`. It fails when production `/api/v1/health` is not 200.
- AC11: The README "Running locally" section takes a new machine to a working `pnpm dev`. It lists the GitHub secrets, the GitHub variable and the Vercel env vars.

## 3. Data

No tables, no migrations, no Zod domain schemas.

- `src/server/db/schema/index.ts` exports nothing yet (`export {};`).
- `drizzle.config.ts`: `dialect: 'postgresql'`, `schema: './src/server/db/schema/index.ts'`, `out: './src/server/db/migrations'`, `dbCredentials.url` from `DATABASE_MIGRATION_URL`.
- Drizzle keeps its journal in the default `drizzle` Postgres schema. That is fine on Supabase.

## 4. API

### `GET /api/v1/health`

- File: `src/app/api/v1/health/route.ts`, `export const dynamic = 'force-dynamic'`. The route must never be prerendered at build, because the build must not run a query.
- Auth: none (`withHandler({ auth: 'none' })`).
- 200 `{ "ok": true, "db": true }` when `select 1` succeeds within 5 s.
- 503 `{ "ok": false, "db": false }` on any DB error or timeout. The server logs the error (`console.error` with a short tag `[health]`). The body carries no details.
- Headers on both: `Cache-Control: no-store`.
- No idempotency concerns (read-only).

### Error envelope (for later routes, built now)

`{ "error": { "code": string, "message": string, "details"?: unknown } }`. Base codes in `src/server/http/errors.ts`:

| Code | Status |
| --- | --- |
| `VALIDATION_FAILED` | 400 (`details` = Zod issues) |
| `UNAUTHORIZED` | 401 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INTERNAL` | 500 (no internals in the body) |

Domain specs add their codes to the same table. An unknown `DomainError` code maps to 500.

## 5. Server

```text
src/
├── instrumentation.ts              # validates env at server start
├── server/
│   ├── env.ts                      # Zod env schema, parseEnv(), getEnv()
│   ├── db/
│   │   ├── client.ts               # postgres.js + drizzle, singleton
│   │   ├── schema/index.ts         # empty
│   │   ├── migrations/             # drizzle-kit output (empty for now, keep .gitkeep)
│   │   └── seed/index.ts           # no-op seed
│   ├── http/
│   │   ├── handler.ts              # withHandler
│   │   ├── response.ts             # json()
│   │   └── errors.ts               # DomainError, status table, toErrorResponse()
│   └── health/
│       └── service.ts              # checkHealth()
└── app/api/v1/health/route.ts
```

Every file under `src/server` that reads env or touches the DB starts with `import 'server-only'`.

**`env.ts`**

- `envSchema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), DATABASE_URL: z.url().refine(postgres protocol) })`. Use Zod 4 APIs.
- `parseEnv(source: Record<string, string | undefined>)` throws `Error` with the message from section 7. It lists every failing variable name with the Zod reason and never includes values.
- `getEnv()` parses `process.env` once and caches it. Nothing parses env at import time, so `next build` and test imports stay side-effect free.
- `DATABASE_MIGRATION_URL` is **not** in this schema. Only drizzle-kit needs it, and `drizzle.config.ts` validates it on its own.

**`instrumentation.ts`**

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('@/server/env');
    getEnv();
  }
}
```

**`db/client.ts`**

- `postgres(getEnv().DATABASE_URL, { prepare: false, max: 5, connect_timeout: 5 })`. `prepare: false` is required by the Supabase transaction pooler.
- `export const db = drizzle(client, { schema })`. In development, cache the postgres client on `globalThis`, so hot reload does not open new pools.
- The client is created lazily on first use, through an exported `getDb()`. `db` must not connect during `next build`.

**`http/`**

- `DomainError extends Error` with `code: string`, `details?: unknown`.
- `json(data, init?)` returns `Response.json` with `Cache-Control: private, no-store` unless `init.headers` overrides it.
- `withHandler(options, fn)`:
  - options: `{ auth: 'none'; params?: ZodType; query?: ZodType; body?: ZodType }`. Only `'none'` exists now. Spec 03 adds `'required'` and the `userId` in context.
  - It awaits Next's `context.params`, parses params, query (`URLSearchParams` → object) and JSON body with Zod. On failure it returns 400 `VALIDATION_FAILED` with `details: issues`.
  - It calls `fn({ request, params, query, body })`.
  - A thrown `DomainError` becomes the envelope with the mapped status. Any other error is logged with `console.error('[api]', error)` and returns 500 `INTERNAL` with message `Internal error`.
  - Generic types infer `params`/`query`/`body` from the schemas. No `as` casts in callers.

**`health/service.ts`**

- `checkHealth(): Promise<{ ok: boolean; db: boolean }>` runs ``getDb().execute(sql`select 1`)`` raced against a 5 s timeout. It catches every error, logs it with `[health]` and returns `{ ok: false, db: false }`. It never throws.
- The route maps `ok` to 200/503 and passes `Cache-Control: no-store`.

User scoping: no user data exists yet. The health query reads no table.

**Scripts and config**

- `drizzle.config.ts` loads `.env.local` with `process.loadEnvFile('.env.local')` when the file exists, because CI has no file and uses real env. It throws `DATABASE_MIGRATION_URL is missing` when the variable is absent. No `dotenv` dependency.
- `db:generate` = `drizzle-kit generate`. `db:migrate` = `drizzle-kit migrate`.
- `db:seed` = `node src/server/db/seed/index.ts`. Node 26 strips TypeScript types natively. The file has no imports and logs `Nothing to seed yet.`

## 6. Client

- `src/app/layout.tsx`: `<html lang="en">`, imports `./globals.css`, `metadata = { title: 'Pampojo' }`. Remove the `create-next-app` Geist fonts: spec 01 owns fonts, and the build must not fetch Google Fonts.
- `src/app/(marketing)/page.tsx` is a server component:

  ```tsx
  export default function HomePage() {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <h1 className="text-4xl font-semibold">Pampojo</h1>
      </main>
    );
  }
  ```

  No `t()` yet; spec 01 sets up i18n.
- `src/app/globals.css`: Tailwind v4 `@import "tailwindcss";` plus whatever `shadcn init` writes, with the default neutral base color. No custom tokens.
- `components.json` from `shadcn init`: `src/components/ui`, `@/lib/utils` with `cn()`, RSC on, TSX. Do not add any shadcn components.
- Delete the default `public/*.svg` files from `create-next-app`.
- Layout: the centered heading works at 390 and 1440 px. No other UI states.

## 7. Copy

| Where | Text |
| --- | --- |
| `<h1>` on `/` | `Pampojo` |
| `<title>` | `Pampojo` |
| Env error (thrown by `parseEnv`) | `Invalid environment variables:` followed by one line per variable: `- DATABASE_URL: <zod message>`, then `Check .env.local (see .env.example).` |
| Drizzle config error | `DATABASE_MIGRATION_URL is missing. Set it in .env.local (see .env.example).` |
| Seed script output | `Nothing to seed yet.` |
| 500 envelope message | `Internal error` |

`.env.example`:

```bash
# Supabase "Pampojo" -> Connect -> Direct connection string -> Transaction pooler (port 6543). Used by the app at runtime.
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
# Same dialog -> Session pooler (port 5432). Used by drizzle-kit for migrations.
DATABASE_MIGRATION_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

## 8. Steps

1. **Scaffold.** Run `pnpm create next-app@latest` in a scratch folder outside the repo (TypeScript, ESLint, Tailwind, App Router, `src/`, alias `@/*`, no Turbopack prompts changed). Move `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` and `src/app` into the repo. Merge its `.gitignore` lines into the existing `.gitignore`, keeping the current entries. Do not touch `CLAUDE.md` or `README.md`. Add `.nvmrc` (`26`), `.npmrc` (`engine-strict=true`), `engines.node` `">=26 <27"` and `packageManager`. Set `name: "pampojo"` and `private: true`. Remove the fonts and default content (section 6), and move the page to `src/app/(marketing)/page.tsx`.
2. **TypeScript.** In `tsconfig.json` set `strict: true`, `noUncheckedIndexedAccess: true` and `paths` `@/*` → `./src/*`. Include `e2e/**/*.ts` and the root config files. Scripts: `typecheck` = `tsc --noEmit`.
3. **Prettier.** Add `prettier` and `eslint-config-prettier`. `.prettierrc.json`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }`. `.prettierignore`: `docs`, `scratch`, `.claude`, `prompts`, `evals`, `*.md`, `pnpm-lock.yaml`, `src/server/db/migrations`. Scripts: `format` = `prettier --write .`, `format:check` = `prettier --check .`.
4. **ESLint.** `eslint.config.mjs` (flat). Layers, in order:
   - the `eslint-config-next` core-web-vitals + typescript configs;
   - `typescript-eslint` recommended (type-aware not required);
   - `eslint-plugin-jsx-a11y` `flatConfigs.recommended`, but only if Next's config does not already register the plugin; otherwise only add its recommended rules;
   - `eslint-plugin-testing-library` `flatConfigs.react`, limited to `src/**/__tests__/**`;
   - `eslint-config-prettier` last.

   Ignore `.next`, `src/components/ui` and `src/server/db/migrations`. Script: `lint` = `eslint .`.
5. **Tailwind + shadcn.** Make sure Tailwind v4 works from the scaffold. Run `pnpm dlx shadcn@latest init` (neutral). It adds `components.json`, `src/lib/utils.ts` and its own dependencies (`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`). Keep them.
6. **Env.** `src/server/env.ts` and `src/instrumentation.ts` (section 5). Add `zod` and `server-only`.
7. **HTTP layer.** `src/server/http/errors.ts`, `response.ts`, `handler.ts`.
8. **Database.** Add `drizzle-orm`, `postgres` and dev `drizzle-kit`. Create `src/server/db/client.ts`, `schema/index.ts`, `migrations/.gitkeep`, `seed/index.ts` and `drizzle.config.ts`, plus the scripts `db:generate`, `db:migrate`, `db:seed`. Run `pnpm db:migrate` locally against `Pampojo`. It must exit 0 with no migrations (see Risks).
9. **Health.** `src/server/health/service.ts` and `src/app/api/v1/health/route.ts`. Check manually: `pnpm dev`, then `curl -i localhost:3000/api/v1/health` gives 200 and `no-store`.
10. **Vitest.** Add `vitest`, `@vitest/browser-playwright`, `vitest-browser-react`, `@vitejs/plugin-react` and `playwright`. `vitest.config.ts` has two projects:
    - `node`: `include: ['src/**/__tests__/**/*.test.ts']`, `environment: 'node'`, `setupFiles: ['./vitest.setup.node.ts']`.
    - `browser`: `include: ['src/**/__tests__/**/*.test.tsx']`, `plugins: [react()]`, `browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: 'chromium' }] }`.

    Both resolve `@` → `src` and alias `server-only` to an empty module (`src/test/server-only-stub.ts`). `globals: false`. `vitest.setup.node.ts` calls `process.loadEnvFile('.env.local')` if the file exists. Script: `test` = `vitest run`.
11. **Test utilities.**
    - `src/test/render.tsx` exports `render(ui)`. It wraps `vitest-browser-react`'s `render` with an `AppProviders` wrapper, which holds no providers yet. A comment says that QueryClient (first query spec) and i18n (spec 01) are added here.
    - `src/types/utils.ts` holds `ValueOf<T>` and `DeepPartial<T>`.
    - `src/test/mocks.ts` holds `mergeMock<T>(base: T, override?: DeepPartial<T>): T`. It deep-merges plain objects, and arrays in the override replace the base. There are no factories yet.
12. **Tests.** Write the files in section 9.
13. **Playwright.** Add `@playwright/test`. `playwright.config.ts`:
    - `testDir: 'e2e'`;
    - projects `mobile` (Chromium, `viewport: { width: 390, height: 844 }`, `isMobile: true`, `hasTouch: true`) and `desktop` (Chromium, `viewport: { width: 1440, height: 900 }`);
    - `webServer`: `pnpm start` when `process.env.CI` is set, otherwise `pnpm dev`, `url: 'http://localhost:3000'`, `reuseExistingServer: !process.env.CI`.

    Script: `test:e2e` = `playwright test`. File: `e2e/00-project-setup.spec.ts`.
14. **Deploy config.** `vercel.json` = `{ "$schema": "https://openapi.vercel.sh/vercel.json", "git": { "deploymentEnabled": { "main": false } } }`. `.env.example` from section 7.
15. **GitHub Actions.**
    - `.github/actions/setup/action.yml` (composite): `pnpm/action-setup` (reads `packageManager`), `actions/setup-node` with `node-version-file: .nvmrc` and `cache: pnpm`, then `pnpm install --frozen-lockfile`.
    - `.github/workflows/ci.yml`: on `pull_request` (`opened`, `synchronize`, `reopened`, `labeled`); `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`; secrets as env.
      - job `checks`: setup → `pnpm lint` → `pnpm format:check` → `pnpm typecheck` → `pnpm db:migrate` → `pnpm exec playwright install --with-deps chromium` → `pnpm test` → `pnpm build`.
      - job `e2e`: `if: contains(github.event.pull_request.labels.*.name, 'e2e')`, `needs: checks`. setup → install chromium → `pnpm build` → `pnpm test:e2e`.
    - `.github/workflows/main.yml`: on `push` to `main`; `concurrency: { group: production, cancel-in-progress: false }`.
      - job `checks`: the same steps as PR `checks`, but **without** `db:migrate`. The schema was migrated by the PR. AC9 order: checks → migrate → deploy.
      - job `e2e` (`needs: checks`).
      - job `migrate` (`needs: [checks, e2e]`): `pnpm db:migrate`.
      - job `deploy` (`needs: migrate`): `pnpm dlx vercel@<pinned ≥65.8.0> pull --yes --environment=production --token=$VERCEL_TOKEN`, then `vercel build --prod`, then `vercel deploy --prebuilt --prod`, with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as env.
    - `.github/workflows/keepalive.yml`: on `schedule: cron '0 6 */3 * *'` and `workflow_dispatch`. One step: `curl --fail --silent --show-error --max-time 30 "${{ vars.PROD_URL }}/api/v1/health"`.
    - Secrets used: `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Variable: `PROD_URL` (for example `https://pampojo.vercel.app`, no trailing slash).
16. **README.** Replace the "Running locally" placeholder with these parts:
    - Prerequisites: Node 26 (`nvm use`) and pnpm through corepack (`corepack enable`).
    - `.env.local` from `.env.example`, using the Supabase **Connect** dialog: Shared pooler, both ports. Replace `[YOUR-PASSWORD]` without the brackets and percent-encode special characters.
    - `pnpm install`, `pnpm db:migrate`, `pnpm dev`.
    - The table of commands.
    - The additive-migrations rule.
    - How migrations reach the database (PR CI, then main).
    - The GitHub secrets and variable.
    - The Vercel env vars: both URLs in Production, Preview and Development.
    - Vercel's automatic production deploy, which `vercel.json` disables.
17. **Verify.** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`. Check AC7 by hand: `DATABASE_URL= pnpm dev` must stop with the env message.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/00-project-setup.spec.ts`: open `/`, then `getByRole('heading', { level: 1, name: 'Pampojo' })` is visible. `src/app/(marketing)/__tests__/page.test.tsx` (browser) renders `HomePage` and asserts the same heading. |
| AC2 | No test file. The first PR's `ci.yml` run, plus the local run in step 17. |
| AC3 | `src/server/health/__tests__/health-route.test.ts` (node, real `Pampojo` DB): calls the exported `GET` with `new Request('http://localhost/api/v1/health')`. It expects 200, body `{ ok: true, db: true }` and `cache-control` `no-store`. |
| AC4 | Same file: `vi.spyOn` on the db instance's `execute` rejects once. It expects 503, body exactly `{ ok: false, db: false }` and `no-store`. A second case: `execute` never resolves while fake timers advance 5 s, and the result is 503. |
| AC5 | Manual in `/review`: preview URL `/api/v1/health` returns 200. Needs the lead's Vercel setup. |
| AC6 | `pnpm test:e2e`: the AC1 e2e file runs in both `mobile` and `desktop` projects. |
| AC7 | `src/server/__tests__/env.test.ts` (node). Case 1: `parseEnv({})` throws, and the message contains `DATABASE_URL`. Case 2: `parseEnv({ DATABASE_URL: '' })` throws. Case 3: an invalid URL `postgresql://user:secret@x` with a bad protocol, and the message must not contain `secret`. Case 4: a valid postgres URL parses. Plus the manual check in step 17. |
| AC8 | Review of `.github/workflows/ci.yml` (step order) and the first PR run. |
| AC9 | Review of `.github/workflows/main.yml` (`needs` chain checks → e2e → migrate → deploy) and the first push to `main`. |
| AC10 | Manual `workflow_dispatch` of `keepalive.yml` after `PROD_URL` is set. |
| AC11 | `/review` follows the README from a clean clone. |
| — | `src/server/http/__tests__/handler.test.ts` (node): invalid body returns 400 `VALIDATION_FAILED` with `details`. A thrown `DomainError('NOT_FOUND')` returns 404 with the envelope. A thrown plain `Error('boom')` returns 500 `INTERNAL`, and the body does not contain `boom`. `json()` sets `private, no-store` by default. |
| — | `src/test/__tests__/mocks.test.ts` (node): `mergeMock` deep-merges objects and replaces arrays. |

## 10. Risks and open questions

No blocking questions.

- **Dependencies added.** The spec names these tools: `next`, `react`, `react-dom`, `typescript`, `eslint`, `eslint-config-next`, `typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-plugin-testing-library`, `prettier`, `tailwindcss` (+ `@tailwindcss/postcss`), `drizzle-orm`, `drizzle-kit`, `postgres`, `zod`, `vitest`, `@playwright/test`. Glue they need: `eslint-config-prettier`, `server-only`, `@vitest/browser-playwright`, `vitest-browser-react`, `@vitejs/plugin-react`, `playwright`, and the packages `shadcn init` adds. Nothing else. Use `process.loadEnvFile` instead of `dotenv`, and native TS in Node 26 instead of `tsx`.
- **Empty migrations folder.** `drizzle-kit migrate` may fail when `migrations/meta/_journal.json` is missing. If it does, first try running `pnpm db:generate` once to produce an empty journal, and commit it if one appears. Otherwise make `db:migrate` a tiny Node script `src/server/db/migrate.ts` that exits 0 when no journal exists. Record which one in Implementation notes.
- **Fail-fast in `instrumentation.ts`.** If Next logs the `register()` error but keeps serving, AC7 is not met. Fallback: move the schema into a module without `server-only` (`src/server/env-schema.ts`) and call `parseEnv(process.env)` from `next.config.ts` as well. Next loads `.env*` before the config. Record the outcome.
- **ESLint plugin clash.** `eslint-config-next` already registers `jsx-a11y`. Registering it twice throws `Cannot redefine plugin`. Testing-library rules may misfire on Vitest browser locators. Disable a misfiring rule only in `__tests__`, with a one-line comment.
- **Real DB in tests and CI.** The node health test hits the production database (`select 1` only, no writes). CI is red until the lead adds the `DATABASE_URL` and `DATABASE_MIGRATION_URL` secrets. The rolled-back-transaction test helper is not needed yet. Spec 03 adds it with the first tables, together with the `touch()` helper from the database guide and the auth option `'required'` in `withHandler`.
- **pnpm on Vercel previews.** Previews are built by Vercel, not by Actions. If Vercel does not detect the pinned pnpm major from the lockfile, set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel env (all environments) and note it in the README.
- **Prebuilt deploy on Node 26.** Needs Vercel CLI ≥ 65.8.0. Pin the exact version in `main.yml`.
- **Preview protection.** Vercel previews require login by default. AC5 is checked in a logged-in browser. Do not disable protection.
- **Keepalive limits.** GitHub disables scheduled workflows after 60 days without repo activity. The `*/3` day-of-month cron gives a 1–2 day gap at month end; that is fine. Supabase pauses after about 7 idle days.
- **Additive-only migrations.** These are a process rule, not tooling. A later spec may add a CI check that rejects `DROP`/`RENAME` in new migration files. Not in scope here.
- **Lead's actions outside code:** install Node 26; add the GitHub secrets and the variable; set the Vercel env vars; label PRs `e2e` when needed.

## 11. Implementation notes

- Scaffold is Next.js 16.4.5 with `cacheComponents` and `partialPrefetching` on, and Tailwind through `@tailwindcss/turbopack` (no PostCSS config). Kept as generated.
- `export const dynamic = 'force-dynamic'` is not allowed with Cache Components. `withHandler` calls `await connection()` instead, so every API route renders per request; the build lists `/api/v1/health` as dynamic. The node test setup mocks only `connection` from `next/server`, because handler tests run outside a request scope.
- `next dev` regenerates `AGENTS.md` (Next.js agent rules) at the repo root. It is kept and should be committed so the tree stays clean.
- Fail-fast fallback is used. `next start` only logs a failing `register()` and keeps serving. The schema and `parseEnv` moved to `src/server/env-schema.ts` (no `server-only`). `next.config.ts` calls `parseEnv(process.env)`, and `src/server/env.ts` re-exports it with `getEnv()`. Both `pnpm dev` and `pnpm start` with an empty `DATABASE_URL` now exit 1 with the message. Side effect: `next build` and `next typegen` also need `DATABASE_URL`; CI and Vercel provide it.
- Zod 4 runs `.refine` even after `z.url()` fails. The protocol check uses `z.url({ protocol: /^postgres(ql)?$/ })` instead.
- Empty migrations: `drizzle-kit migrate` fails without a journal. `pnpm db:generate` produced `src/server/db/migrations/meta/_journal.json` with no entries, which is committed; `pnpm db:migrate` then exits 0. No custom migrate script.
- `shadcn init` (v4.23) needs a preset: `-b radix -p nova` (lead chose Radix, see DECISIONS). It also generated `src/components/ui/button.tsx` and a Geist font in the layout; both removed (no components in 00, fonts are spec 01). The circular `--font-sans` theme lines were removed too. shadcn now uses its own `cn` package instead of `clsx` + `tailwind-merge`, and it adds `radix-ui`, `shadcn` (for `shadcn/tailwind.css`), `class-variance-authority`, `lucide-react` and `tw-animate-css`.
- `pnpm-workspace.yaml` (from the scaffold, pnpm 12 build approvals) allows the `esbuild` build script.
- `typecheck` is `next typegen && tsc --noEmit`, because `LayoutProps` comes from generated route types.
- ESLint: `testing-library/render-result-naming-convention` is off in tests, because the testing guide names the render result `screen`.
- Health tests: the timeout case makes `execute` hang and advances fake timers by `HEALTH_TIMEOUT_MS`.
- Playwright `mobile` uses Chromium with a 390×844 viewport and `isMobile`/`hasTouch`, so only Chromium is installed.
- Actions pinned to current majors: `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, Vercel CLI `65.12.1`.
- The DB password in the lead's `.env.local` contained `?` and `$`, which broke URL parsing. It was percent-encoded in place, and the README now explains the encoding.
- Not verified locally (needs the lead's GitHub and Vercel setup): AC5, AC8–AC10 runs.

## 12. Review — 2026-11-08

**Verdict:** Pass with notes

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/00-project-setup.spec.ts` (h1 now the landing headline after spec 02); `scratch/review/00-project-setup/AC1-mobile-home.png`, `AC1-desktop-home.png` |
| AC2 | Pass locally / Not testable in CI | All four commands pass locally. The PR workflow has not run yet: no PR exists, and the GitHub secrets are not set. |
| AC3 | Pass | `curl -i /api/v1/health` → `200`, `cache-control: no-store`, `{"ok":true,"db":true}` against `Pampojo`; `src/server/health/__tests__/health-route.test.ts` |
| AC4 | Pass | `src/server/health/__tests__/health-route.test.ts` (rejected query and 5 s timeout → 503 `{ ok: false, db: false }`) |
| AC5 | Not testable | Vercel project, env vars and preview deploys are not set up yet. |
| AC6 | Pass | `e2e/00-project-setup.spec.ts` runs in `mobile` and `desktop` |
| AC7 | Pass | `src/server/__tests__/env.test.ts`. Manually, `DATABASE_URL= pnpm dev` and `pnpm start` exit 1 naming `DATABASE_URL` (`next.config.ts:5`). |
| AC8 | Pass by inspection / Not run | `.github/workflows/ci.yml`: `db:migrate` runs before `pnpm test`. It has never run on GitHub. |
| AC9 | Pass by inspection / Not run | `.github/workflows/main.yml`: checks → e2e → migrate → deploy (`needs` chain), with `vercel.json` disabling Git auto-deploy. Not run. |
| AC10 | Pass by inspection / Not run | `.github/workflows/keepalive.yml`; needs the `PROD_URL` variable. |
| AC11 | Pass | `README.md` "Running locally": prerequisites, env from the Supabase Connect dialog incl. password encoding, commands, migrations, secrets and Vercel env. Followed in this session on the lead's machine. |

### Findings

1. [major] The CI/CD half of the spec (AC2 in CI, AC5, AC8–AC10) is unverified. It needs the GitHub secrets (`DATABASE_URL`, `DATABASE_MIGRATION_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), the `PROD_URL` variable, the Vercel project with env vars, and a first PR plus a push to `main`. Until then every workflow will fail at `db:migrate`, at the build, or at the env check.
2. [minor] `pnpm typecheck` needs `DATABASE_URL`, because `next typegen` loads `next.config.ts`, which validates env (`next.config.ts:5`, `package.json:17`). A fresh clone without `.env.local` cannot typecheck. The README should say so, or `next.config.ts` could skip validation for `typegen`.
3. [minor] `src/instrumentation.ts` validates env a second time. Since `next.config.ts` now fails fast, it is redundant but harmless. Keep it or drop it; either way it is a one-line decision.
4. [minor] The health node test talks to the production database. That is by design (one database, `select 1` only), but every CI run depends on Supabase being awake.

### Checks

- lint: pass (`pnpm lint`, 0 problems); `pnpm format:check` pass.
- typecheck: pass (`next typegen && tsc --noEmit`).
- tests: pass — `pnpm test` 16 files, 64 tests (node + browser); `pnpm i18n:check` pass.
- e2e: pass — `CI=1 pnpm test:e2e` against `pnpm start`: 42 passed, 2 skipped (viewport-specific tests).
- build: pass (`pnpm build`).

### Out of scope

- Spec 03: the rolled-back-transaction test helper and `withHandler({ auth: 'required' })`.
- ADR 0008 (migrate → deploy pipeline) was proposed and not written yet.

### Follow-up — 2026-11-08

- Finding 2 addressed in docs: README "Environment" now says `pnpm build` and `pnpm typecheck` need `DATABASE_URL`. Code unchanged. Findings 1, 3 and 4 remain open.
