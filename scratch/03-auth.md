# 03-auth — technical plan

Spec: `docs/specs/03-auth.md`

## 1. Summary

Add accounts with Better Auth.

- **What users get:** email + password sign-up and log-in, Google sign-in (localhost and production only), database sessions with a 30-day sliding expiry, and a database-backed rate limiter.
- **Pages:** `/login` and `/signup` (one card with tabs; brand panel on desktop) and a protected `/today` placeholder with Log out.
- **Routing:** the proxy redirects `/` to `/today` when a session cookie exists, and `/today` to `/login?next=…` when none exists. The `(app)` layout does the real server-side check.
- **API layer:** `withHandler` gains `auth: 'required'`.
- **Not in this spec:** password reset, email verification and Google account linking (all spec 27).

Existing code this builds on:

- `src/proxy.ts`: locale rewrite to the hidden `[lang]` segment, a prefix redirect, and the matcher `/((?!api|_next|brand/|.*opengraph-image.*|.*\..*).*)`.
- `src/server/env-schema.ts` (Zod `envSchema`, `parseEnv`) and `src/server/env.ts` (`getEnv()`). `next.config.ts` also calls `parseEnv(process.env)` at load, so every required variable is needed for `dev`, `build`, `typecheck` and CI.
- `src/server/db/client.ts`: `getDb()` (postgres.js, `prepare: false`). `src/server/db/schema/index.ts` is empty (`export {}`). Migrations live in `src/server/db/migrations/` and the journal is currently empty.
- `src/server/http/handler.ts`: `withHandler({ auth: 'none', params?, query?, body? }, fn)`. It calls `await connection()`, maps `DomainError` through `ERROR_STATUS` (already has `UNAUTHORIZED: 401`) and logs and returns 500 `INTERNAL`.
- i18n:
  - server components use `getI18n()` (from `@/i18n/server`) to get `{ locale, t }`;
  - client components use `useTranslation()`, plus `useLocale()` and `useFormat()` from `@/i18n/client`;
  - catalogs are `src/i18n/locales/{en,uk}.json`. Run `pnpm i18n:extract`, fill `uk`, then `pnpm i18n:check`.
- UI:
  - shadcn components `button` (variants primary/accent/secondary/ghost; sizes sm/md/lg/xl/icon), `input` (pill), `label`, `field`, `tabs`, `card`, `sonner`;
  - app components `PageHeader` and `@/features/i18n/LanguageSwitcher`;
  - landing pieces: `src/features/landing/HeroPhone` (server component, `aria-hidden`), `Hero` (has a `Continue with Google` link to `/signup`), `MarketingHeader`;
  - the wordmark at `/brand/pampojo-wordmark.svg` (aspect 1930×418).
- Tests: Vitest projects `node` (`*.test.ts`, setup loads `.env.local` and mocks `connection` from `next/server`) and `browser` (`*.test.tsx`); `src/test/render.tsx` provides `render(ui, { locale })`. Playwright projects `mobile` and `desktop`; CI uses `pnpm start`.
- CI: `.github/workflows/ci.yml` and `main.yml` take `DATABASE_URL` and `DATABASE_MIGRATION_URL` from secrets at workflow level.

## 2. Acceptance criteria

- AC1: Submitting `/signup` with a new email and a valid password creates a `user` row and a `session` row, sets the session cookie and lands on `/today`. The page shows `Signed in as <email>`.
- AC2: Submitting `/login` with valid credentials lands on `/today`, or on `next` when it is a safe relative path. A wrong password and an unknown email both show `Wrong email or password`. The `POST /api/auth/sign-in/email` responses for the two cases have the same status (401) and the same JSON body.
- AC3: Google sign-in:
  - a new email creates `user` + `account(providerId=google)` and lands on `/today`;
  - a returning Google user signs in;
  - an email that already has a password (`credential`) account is refused: no new user or account row is created, and `/login` shows `This email is registered with a password. Log in with your password.`

  The OAuth round trip is checked manually on localhost and production. Automated tests cover the error display (`/login?error=account_not_linked`) and the "linking disabled" config.
- AC4: Email sign-up with an email that already exists (from a password or a Google account) shows `An account with this email already exists. Log in instead.`, and the `user` count does not change.
- AC5: `GET /today` without a session cookie redirects (307) to `/login?next=%2Ftoday`. Logging in from there lands on `/today`. `next` values `https://evil.example`, `//evil.example`, `/api/v1/health` and `javascript:alert(1)` are ignored, and the user lands on `/today`.
- AC6: A handler built with `withHandler({ auth: 'required' }, fn)` returns 401 `{ error: { code: 'UNAUTHORIZED' } }` without a session. With a valid session cookie it calls `fn` with that user's `userId`. `/api/v1/health` stays public.
- AC7: The session cookie is `HttpOnly` and `SameSite=Lax`, with `Max-Age` ≈ 30 days (2 592 000 s ± 60) and `Secure` when `NODE_ENV=production`. After a session's `updatedAt` is moved 2 days into the past, `getSession` extends `expiresAt` to about now + 30 days.
- AC8:
  - The log-in and sign-up forms validate with `logInInputSchema` and `signUpInputSchema` after submit (then on change), showing `Enter a valid email`, `Password must be at least 8 characters` or `Password must be at most 128 characters` under the field.
  - While pending, the submit and the Google button are disabled and show the pending label.
  - A double click sends one request.
- AC9: With a session cookie, `GET /` redirects to `/today`. Without one, `/` renders the landing page (static, unchanged).
- AC10: With a valid session, `GET /login` and `GET /signup` redirect to `/today`, or to a safe `next`.
- AC11: Log out ends the session server-side (the `session` row is deleted), clears the cookie and lands on `/`. Reusing the old cookie value on `/today` redirects to `/login`.
- AC12: For one IP, the 11th `POST /api/auth/sign-in/email` within 60 s returns 429, and the form shows `Too many attempts. Try again in a minute.`
- AC13: With the browser offline, `/login` and `/signup` show `You're offline. Connect to the internet to log in.`, and the submit and Google buttons are disabled. Going back online clears it.
- AC14: When `VERCEL_ENV=preview`, or when either Google env var is missing, no Google button renders on `/login`, `/signup` or the landing hero. The hero keeps its `/signup` link.
- AC15: `/login`, `/signup` and `/today` at 390×844 and 1440×900 in `en` and `uk` show the section 7 copy, and `scrollWidth <= innerWidth`.

## 3. Data

### Tables (Better Auth, generated)

- Generate the Drizzle schema with the Better Auth CLI into `src/server/db/schema/auth.ts`: `user`, `session`, `account`, `verification`, `rateLimit` (table `rate_limit`). Re-export it from `schema/index.ts`.
- **IDs are UUIDs** (`DATA_MODEL.md`: other tables reference `user.id` as uuid). Configure `advanced.database.generateId: 'uuid'` before generating, so the CLI emits `uuid` columns with `defaultRandom()` where Better Auth supports it. If the CLI still emits `text` ids, stop and report (see Risks); do not hand-edit types silently.
- Table names follow the database guide (snake_case singular). Better Auth's defaults `user`, `session`, `account`, `verification` already comply; `rate_limit` via `rateLimit.modelName` if needed.
- Foreign keys from the generated schema (`session.userId`, `account.userId` → `user.id`, `onDelete: cascade`). Add indexes on `session.userId`, `account.userId` and `session.token` (unique) if the CLI does not emit them.
- `pnpm db:generate` produces one migration, `src/server/db/migrations/0000_*.sql`. Review it: only `CREATE TABLE`, `CREATE INDEX` and FKs, nothing dropped or renamed (additive rule).

### Zod — `src/shared/schemas/auth.ts`

- `emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email())`.
- `passwordSchema = z.string().min(8).max(128)`.
- `logInInputSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) })`. Log-in does not enforce the minimum length, because the server answers with the generic error.
- `signUpInputSchema = z.object({ email: emailSchema, password: passwordSchema })`.
- The error messages are i18n keys resolved in the form (section 6). Schemas carry codes via `error: () => ({ message: 'invalid_email' })`, and the form maps the code to `t(...)`.

## 4. API

- **`/api/auth/[...all]`**: `src/app/api/auth/[...all]/route.ts`, `export const { GET, POST } = toNextJsHandler(auth)`. Outside `[lang]`; the proxy matcher already skips `api`.
- **Endpoints used by the client:** `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-in/social` (Google), `GET /api/auth/callback/google`, `POST /api/auth/sign-out`, `GET /api/auth/get-session`.
- **Error codes mapped to copy:**

  | Status / code | Copy |
  | --- | --- |
  | 401 `INVALID_EMAIL_OR_PASSWORD` | `Wrong email or password` |
  | 422 `USER_ALREADY_EXISTS*` (prefix match) | `An account with this email already exists. Log in instead.` |
  | 429 | `Too many attempts. Try again in a minute.` |
  | Google callback `?error=account_not_linked` on `/login` | `This email is registered with a password. Log in with your password.` |
  | Anything else | `Something went wrong. Try again.` |

- **Idempotency.** Sign-up is protected by the unique email: a double submit yields one user, and the second call gets `USER_ALREADY_EXISTS`, which the form ignores if the first succeeded. Sign-in and sign-out are idempotent by nature. The pending flag makes the client send once (AC8). No `Idempotency-Key` is needed, because these are Better Auth endpoints, not `/api/v1`.
- **`withHandler`.** Options become `auth: 'none' | 'required'`.
  - With `'required'`: `const session = await getSession(request.headers)`. If there is none, return 401 `UNAUTHORIZED` (`message: 'Authentication required'`).
  - Otherwise the handler context includes `userId: string`. Use a type overload, so `userId` exists only when `auth: 'required'`.
  - All responses keep `Cache-Control: private, no-store`.

## 5. Server

```text
src/server/auth/
├── auth.ts          # betterAuth(...) config, import 'server-only'
├── session.ts       # getSession(headers), requireSession()
├── google.ts        # isGoogleEnabled(env)
└── __tests__/
src/server/db/schema/auth.ts   # generated
src/test/db.ts                 # withRollback + deleteUsersByEmail
src/app/api/auth/[...all]/route.ts
```

### `auth.ts`

```ts
betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl(env),            // see below
  trustedOrigins: [authBaseUrl(env)],
  database: drizzleAdapter(getDb(), { provider: 'pg', schema: authSchema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true, requireEmailVerification: false },
  socialProviders: isGoogleEnabled(env) ? { google: { clientId, clientSecret } } : {},
  account: { accountLinking: { enabled: false } },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true, storage: 'database', window: 60, max: 100,
    customRules: { '/sign-in/email': { window: 60, max: 10 }, '/sign-up/email': { window: 60, max: 10 } },
  },
  advanced: { database: { generateId: 'uuid' }, useSecureCookies: env.NODE_ENV === 'production' },
})
```

- `authBaseUrl(env)`, in order:
  1. `BETTER_AUTH_URL` if set;
  2. otherwise `https://${VERCEL_URL}` on Vercel previews;
  3. otherwise `http://localhost:3000`.
- The `auth` instance is created lazily (`getAuth()`), like `getDb()`, so imports never connect during build.
- Option names must be checked against the installed Better Auth version's docs/types (`node_modules/better-auth`). If an option moved, use the current equivalent and record it.

### Other server modules

- **`session.ts`.** `getSession(headers: Headers)` returns `{ user, session } | null` via `getAuth().api.getSession({ headers })`. It is used by `withHandler`, the `(app)` layout and the auth pages (with `await headers()` from `next/headers`).
- **`google.ts`.** `isGoogleEnabled(env)` = `Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) && env.VERCEL_ENV !== 'preview'`. It is a pure function, read by the server and passed to the client as a prop.

### Env (`env-schema.ts` + `.env.example`)

| Variable | Rule | Where it comes from |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | required, `min(32)` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | optional `z.url()` | set in Vercel Production to the prod URL; unset locally and on previews |
| `GOOGLE_CLIENT_ID` | optional | Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | optional | Google Cloud OAuth client |
| `VERCEL_ENV`, `VERCEL_URL` | optional, read-only | set by Vercel |

### User scoping

- Better Auth scopes its own queries by session.
- Our code reads only `session.user.id` and `session.user.email`.
- No `/api/v1` data routes exist yet.

### Test helpers — `src/test/db.ts`

- `withRollback(fn)` runs `fn(tx)` inside `getDb().transaction` and throws a sentinel to roll back (deferred from spec 00).
- `deleteUsersByEmail(pattern)` runs `DELETE FROM "user" WHERE email LIKE $1`, with a cascade to sessions and accounts. Tests use the email pattern `test-%@example.com` and the e2e pattern `e2e-%@example.com`. These are the only deletes tests make in the shared database.

## 6. Client

### Routes (all under `src/app/[lang]/`)

| File | Kind | Notes |
| --- | --- | --- |
| `(auth)/layout.tsx` | server | `<AuthShell>`. Mobile: a top bar with the wordmark link to `/` (no nav). Desktop `lg:grid-cols-2`: left `<AuthBrandPanel />`, right a centered column (`max-w-[440px]`) with `{children}`. |
| `(auth)/login/page.tsx` | server | `generateMetadata` title `Log in · Pampojo`. Body: `<Suspense fallback={<AuthCardSkeleton />}><LoginGate searchParams={props.searchParams} /></Suspense>`. Inside the gate: `getSession(await headers())`. With a session, `redirect(safeNext(next) ?? '/today')`. Otherwise render `<AuthCard mode="login" next={…} googleEnabled={isGoogleEnabled(process.env)} initialError={searchParams.error} />`. |
| `(auth)/signup/page.tsx` | server | Same, with `mode="signup"` and title `Sign up · Pampojo`. |
| `(app)/layout.tsx` | server | `<Suspense fallback={null}><SessionGate>{children}</SessionGate></Suspense>`. The gate reads the session; without one it `redirect('/login?next=' + encodeURIComponent(path))`. `path` comes from the request header `x-pampojo-path`, which the proxy sets; fall back to `/today`. |
| `(app)/today/page.tsx` | server | Placeholder: `PageHeader title={t("You're signed in")}`, `<p>{t('Signed in as {{email}}', { email })}</p>`, `<LogOutButton />`. The session comes from a shared cached helper (`cache()` from React) so the layout and the page query once. |

Under Cache Components, pages that read `headers()` or `searchParams` must render request-time parts inside `<Suspense>`. Otherwise the build fails with "uncached data outside Suspense". The gates above follow that.

### Proxy (`src/proxy.ts`) additions, before the locale rewrite

- **Session cookie check.** `const hasSession = Boolean(getSessionCookie(request))` (from `better-auth/cookies`; it only checks that the cookie is present).
- **`/` with a session.** If `pathname === '/'` and `hasSession`, `NextResponse.redirect(new URL('/today', request.url))`.
- **Protected paths without a session.** If `pathname` is `/today`, `/onboarding`, or starts with `/session/`, and there is no session, redirect to `/login?next=<encoded pathname+search>`.
- **Rewrite header.** On the locale rewrite, forward the request header `x-pampojo-path: pathname + search`, with `NextResponse.rewrite(url, { request: { headers } })`.
- **Proxy is optimistic only.** The real check stays in `SessionGate` and the auth pages.

### Feature `src/features/auth/`

| Item | Kind | Notes |
| --- | --- | --- |
| `utils.ts` | pure | `safeNext(value: unknown): string \| null`: accepts only a string that starts with `/`, not `//`, not `/\`, not `/api`, contains no `:` before the first `/`, and is at most 512 chars. `nameFromEmail(email)`: the local part, at most 64 chars, used as the placeholder `user.name`. |
| `useAuthErrorMessage.ts` | hook | Maps `{ status, code }` or a callback `error` string to the translated copy (section 4 table). |
| `AuthCard/` | client | Props `{ mode: 'login' \| 'signup'; next: string \| null; googleEnabled: boolean; initialError?: string }`. Layout: `Tabs` rendered as two links (`Log in` → `/login`, `Sign up` → `/signup`, preserving `?next`), with `aria-current="page"` on the active one; the title (`<h1>`) and subtitle; `<GoogleSignInButton>` + divider (only when `googleEnabled`); the offline notice; the alert for server errors (`role="alert"`, `tabIndex={-1}`, focused on error); then `<LogInForm>` or `<SignUpForm>`. The card is `rounded-[24px] bg-card p-6 shadow-soft md:p-8`. |
| `LogInForm/`, `SignUpForm/` | client | React Hook Form + `zodResolver(schema)`, `mode: 'onTouched'`. Fields use shadcn `Field`, `Label`, `Input` (`type="email"`, `autoComplete="email"`, `inputMode="email"`) and `PasswordInput` (`autoComplete="current-password"` or `"new-password"`). Submit is `Button size="lg" className="w-full"`. On submit: if `isSubmitting`, return. Then call `authClient.signIn.email({ email, password })`, or `authClient.signUp.email({ email, password, name: nameFromEmail(email) })`. On success: `window.location.assign(safeNext(next) ?? '/today')` (a hard navigation, so server gates see the new cookie). On error: set the alert via `useAuthErrorMessage`. Sign-up also shows the password hint under the field and the terms note under the submit (links `/terms`, `/privacy`, built with `<Trans>`-free string splitting: `t('By signing up you agree to the')`… see Copy). |
| `GoogleSignInButton/` | client | `Button variant="secondary" size="lg" className="w-full"` with the `@/assets/google-g.svg` mark. On click: `authClient.signIn.social({ provider: 'google', callbackURL: safeNext(next) ?? '/today', errorCallbackURL: '/login' })`. Disabled while pending or offline. |
| `AuthBrandPanel/` | server | `hidden lg:flex` column: `rounded-[32px] bg-gradient-to-br from-accent-soft to-background p-10` with the wordmark (`next/image`, h-10), the `<h2>` "Your workouts. Even offline." (existing key) and `<HeroPhone />`. |
| `AuthCardSkeleton/` | server | `Skeleton` blocks with the card's shape. |
| `LogOutButton/` | client | `Button variant="secondary"`, label `Log out`. On click: `await authClient.signOut()`, then `window.location.assign('/')`. Disabled while pending. |
| `SessionGate`, `LoginGate` | server | These live next to the route files that use them (`(app)/session-gate.tsx`, `(auth)/auth-gate.tsx`), because they are routing concerns. |

### Other client pieces

| Item | Notes |
| --- | --- |
| `src/components/PasswordInput/` | Wraps `Input` with a trailing icon button (`Eye` / `EyeOff`, `aria-label` `Show password` / `Hide password`, `aria-pressed`). Presentation only: the labels come in as props. |
| `src/hooks/useIsOnline.ts` | `useSyncExternalStore` on `online`/`offline` events with `navigator.onLine`. Server snapshot `true`. Spec 05/17 reuse it. |
| `src/api/auth.ts` | `export const authClient = createAuthClient()` from `better-auth/react`, same-origin. The only import point for the client. |
| Landing `Hero` | It takes `googleEnabled` (computed in the server component from `process.env` at build). When true, it renders `<GoogleSignInButton next={null} size="lg" />`; otherwise it keeps the `/signup` link. |

### State and data

- No TanStack Query yet; the auth client holds its own state.
- Forms use RHF.
- Offline state comes from `useIsOnline`.

### Layout

- **Mobile (390):**
  - the top bar is 64px high with the wordmark;
  - the card is full width with a 16px gutter, the tabs full width, the fields 48px high and the buttons 56px;
  - no brand panel.
- **Desktop (1440):**
  - two columns in `max-w-[1200px]`, with `gap-12`;
  - the left panel fills the viewport height (`min-h-[calc(100dvh-4rem)]`);
  - the form column is vertically centered.
- **`/today` placeholder:** a centered column `max-w-[600px]`.

## 7. Copy

Keys (en) → uk. All of them go through `t()` as literals.

| Key | uk |
| --- | --- |
| `Log in` | `Увійти` (exists) |
| `Sign up` | `Реєстрація` |
| `Welcome back` | `З поверненням` |
| `Log in to continue your training.` | `Увійди, щоб продовжити тренування.` |
| `Create your account` | `Створи акаунт` |
| `Free. Takes less than a minute.` | `Безкоштовно. Займе менше хвилини.` |
| `Continue with Google` | `Продовжити з Google` (exists) |
| `or` | `або` |
| `Email` | `Email` |
| `you@example.com` | `you@example.com` |
| `Password` | `Пароль` |
| `Show password` | `Показати пароль` |
| `Hide password` | `Сховати пароль` |
| `At least 8 characters` | `Щонайменше 8 символів` |
| `Logging in…` | `Входимо…` |
| `Create account` | `Створити акаунт` |
| `Creating account…` | `Створюємо акаунт…` |
| `Enter a valid email` | `Введи коректний email` |
| `Password must be at least 8 characters` | `Пароль має містити щонайменше 8 символів` |
| `Password must be at most 128 characters` | `Пароль має містити не більше 128 символів` |
| `Wrong email or password` | `Неправильний email або пароль` |
| `An account with this email already exists. Log in instead.` | `Акаунт із цим email уже існує. Увійди.` |
| `This email is registered with a password. Log in with your password.` | `Цей email зареєстровано з паролем. Увійди з паролем.` |
| `Too many attempts. Try again in a minute.` | `Забагато спроб. Спробуй за хвилину.` |
| `Something went wrong. Try again.` | `Щось пішло не так. Спробуй ще раз.` |
| `You're offline. Connect to the internet to log in.` | `Ти офлайн. Під'єднайся до інтернету, щоб увійти.` |
| `By signing up you agree to the` | `Реєструючись, ти погоджуєшся з` |
| `Terms` | `Умови` (exists; uk sentence uses `Умовами`, see below) |
| `and` | `та` |
| `Privacy policy` | `Політика конфіденційності` (exists) |
| `Log in · Pampojo` | `Вхід · Pampojo` |
| `Sign up · Pampojo` | `Реєстрація · Pampojo` |
| `You're signed in` | `Ти в акаунті` |
| `Signed in as {{email}}` | `Акаунт: {{email}}` |
| `Log out` | `Вийти` |

**Terms note.** It is rendered as `{before} <Link>{terms}</Link> {and} <Link>{privacy}</Link>.`, but Ukrainian needs instrumental case. Use dedicated link-text keys `Terms (in the signup note)` = `Terms` / `Умовами` and `Privacy policy (in the signup note)` = `Privacy policy` / `Політикою конфіденційності`. The English values equal the visible text: set the `en` catalog values to `Terms` and `Privacy policy` by hand; extraction keeps hand-edited values.

## 8. Steps

1. **Dependencies.** `pnpm add better-auth react-hook-form @hookform/resolvers`. Use the exact versions available at implement time; `better-auth` was 1.7.x when this was planned. No other packages; the CLI runs via `pnpm dlx @better-auth/cli@<matching>`.
2. **Env.**
   - Extend `envSchema` (section 5) and `.env.example`, with comments on how to create each value.
   - Add `BETTER_AUTH_SECRET` to the lead's `.env.local`: generate it with `openssl rand -base64 32` and append it, never print it.
   - Add `BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}` to the workflow-level `env` in `ci.yml` and `main.yml`.
   - The README "Deploy setup" lists the new GitHub secret and the Vercel env vars: `BETTER_AUTH_SECRET` (all), `BETTER_AUTH_URL` (Production), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Production + Development).
3. **Auth config.** `src/server/auth/google.ts`, `auth.ts` (lazy `getAuth()`), `session.ts`.
4. **Schema and migration.**
   - Generate `src/server/db/schema/auth.ts` with the Better Auth CLI and re-export it from `schema/index.ts`.
   - Check that the ids are uuid and the indexes are present.
   - `pnpm db:generate`, then review the SQL (additive only), then `pnpm db:migrate` (the shared database).
5. **Route handler.** `src/app/api/auth/[...all]/route.ts`. Smoke check: `curl -X POST localhost:3000/api/auth/sign-up/email` with a `test-…@example.com` user returns 200 and `set-cookie`. Then delete the user.
6. **`withHandler` auth.** Add the `'required'` overload and `userId` (section 4).
7. **Shared schemas.** `src/shared/schemas/auth.ts`.
8. **Client utilities.** `src/api/auth.ts`, `src/hooks/useIsOnline.ts`, `src/components/PasswordInput/`, and `src/features/auth/utils.ts` + `useAuthErrorMessage.ts`.
9. **Auth UI.** `AuthCard`, `LogInForm`, `SignUpForm`, `GoogleSignInButton`, `AuthBrandPanel`, `AuthCardSkeleton`, `LogOutButton`.
10. **Routes.** `(auth)/layout.tsx`, `(auth)/auth-gate.tsx`, `login/page.tsx`, `signup/page.tsx`, `(app)/layout.tsx`, `(app)/session-gate.tsx`, `(app)/today/page.tsx`.
11. **Proxy.** Session redirects and the `x-pampojo-path` header (section 6).
12. **Landing hero.** Wire in `GoogleSignInButton` behind `googleEnabled`.
13. **i18n.** `pnpm i18n:extract`, fill `uk` from section 7, `pnpm i18n:check`.
14. **Test helpers.** `src/test/db.ts`; `e2e/helpers/db.ts` (postgres.js with `DATABASE_URL`, `deleteUsersByEmail('e2e-%@example.com')`, used in `afterAll`).
15. **Tests** (section 9).
16. **Docs.**
    - `docs/tech/API.md`: the `/api/auth/*` row is already there; add the 401 behavior note.
    - README: local Google setup (redirect URI) and `BETTER_AUTH_SECRET` generation.
17. **Verify.** lint, typecheck, i18n:check, test, build, e2e; screenshots at 390 and 1440 in both locales; a manual Google round trip on localhost if the lead has provided the client id and secret.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `e2e/03-auth.spec.ts` "sign up": fill `/signup` with `e2e-<uuid>@example.com` / `Password123!`, submit, URL `/today`, text `Signed in as e2e-…`. `src/server/auth/__tests__/auth-api.test.ts`: `getAuth().handler(new Request('http://localhost:3000/api/auth/sign-up/email', …))` → 200, `set-cookie` present, a `user` row exists. |
| AC2 | `auth-api.test.ts`: sign in with a wrong password for an existing test user and with an unknown email; the statuses are both 401 and the JSON bodies are deep-equal. `e2e/03-auth.spec.ts` "log in": wrong password shows the copy; correct credentials → `/today`. |
| AC3 | `src/server/auth/__tests__/auth-config.test.ts`: the config has `account.accountLinking.enabled === false`. `e2e/03-auth.spec.ts`: `/login?error=account_not_linked` shows the Google-vs-password copy. Manual round trip in `/review` (localhost and production). |
| AC4 | `auth-api.test.ts`: the second sign-up with the same email returns 422 with a code starting `USER_ALREADY_EXISTS`, and the user count stays the same. `src/features/auth/SignUpForm/__tests__/SignUpForm.test.tsx`: the mocked `authClient.signUp.email` returns that error, and the alert shows the copy. |
| AC5 | `src/features/auth/__tests__/utils.test.ts`: `safeNext` accepts `/today`, `/today?x=1`; rejects `https://evil.example`, `//evil.example`, `/\evil`, `/api/v1/health`, `javascript:alert(1)`, non-strings, and over 512 chars. `e2e/03-auth.spec.ts`: `/today` with no cookie → URL `/login?next=%2Ftoday`, then log in → `/today`; `/login?next=https://evil.example` → log in → `/today`. |
| AC6 | `src/server/http/__tests__/handler.test.ts` (extend): `withHandler({ auth: 'required' })` without a cookie → 401 `UNAUTHORIZED`. With a cookie from a sign-up done through `getAuth().handler` → `fn` receives that user's id. The existing health test still passes without a cookie. |
| AC7 | `auth-api.test.ts`: parse `set-cookie` from sign-up; check `HttpOnly`, `SameSite=Lax`, and `Max-Age` within 2 592 000 ± 60. A second config instance with `NODE_ENV=production` gives `Secure` (unit check on the cookie options via `getAuth` built with production env). Sliding: update the test session's `updatedAt` and `expiresAt` to now − 2 days, then call `getSession`; `expiresAt` is now about now + 30 days (± 1 h). |
| AC8 | `LogInForm.test.tsx` and `SignUpForm.test.tsx` (browser, `vi.mock('@/api/auth')`): invalid email on blur → the error shows; a 7-char password → the min error; a 129-char password → the max error. Submit with a never-resolving promise → the button is disabled with the pending label; a second click → the mock is called once. `src/shared/schemas/__tests__/auth.test.ts`: trims and lower-cases the email; bounds hold. |
| AC9 | `e2e/03-auth.spec.ts`: after sign-up, `goto('/')` → `/today`. In a fresh context, `/` shows the landing h1. |
| AC10 | `e2e/03-auth.spec.ts`: signed in, `goto('/login')` and `goto('/signup')` → `/today`. |
| AC11 | `e2e/03-auth.spec.ts`: click `Log out` → URL `/`. Save the cookie beforehand, then add it to a new context and `goto('/today')` → `/login…`. |
| AC12 | `auth-api.test.ts`: 11 sign-in requests with header `x-forwarded-for: 203.0.113.<random>` → the first 10 are not 429 and the 11th is 429. Clean up the `rate_limit` rows for that key. `LogInForm.test.tsx`: a mocked 429 shows the copy. |
| AC13 | `LogInForm.test.tsx` (or `AuthCard.test.tsx`): `vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)` plus an `offline` event → the notice shows and the submit is disabled. `e2e/03-auth.spec.ts`: `context.setOffline(true)` → the notice is visible. |
| AC14 | `src/server/auth/__tests__/google.test.ts`: `isGoogleEnabled` is false for `VERCEL_ENV=preview` and for missing vars, true otherwise. `AuthCard.test.tsx`: `googleEnabled={false}` → no `Continue with Google` button. |
| AC15 | `e2e/03-auth.spec.ts`: `/login`, `/signup` and `/today` (signed in) in `en-US` and `uk-UA` check the h1 and the tab copy, plus no horizontal scroll; runs in both projects. |
| — | `e2e/00-project-setup.spec.ts`, `e2e/01-design-system.spec.ts` and `e2e/02-landing.spec.ts` still pass. The hero keeps a `Continue with Google` link or button with the same name. |

E2e isolation from the rate limiter: every e2e test that hits auth endpoints sets `test.use({ extraHTTPHeaders: { 'x-forwarded-for': '198.51.100.<per-test number>' } })`, so the 10/60 s limit applies per test, not to the whole suite. `afterAll` deletes `e2e-%@example.com` users.

## 10. Risks and open questions

No blocking questions. Points to watch:

- **UUID ids.** If Better Auth or its CLI cannot generate `uuid` columns for `user.id` (only `text`), stop and ask the lead. The alternative is to keep `text` ids and change `DATA_MODEL.md` references to `text`, which is a data model change and needs approval.
- **Better Auth API drift.** Option names (`advanced.database.generateId`, `rateLimit.storage`, `customRules` keys, `accountLinking`, the callback error code `account_not_linked`, the `USER_ALREADY_EXISTS*` codes) must be checked against the installed version. Record the real names in Implementation notes.
- **Cache Components.** The auth pages and the `(app)` layout read `headers()` and `searchParams`. Their request-time parts must sit inside `<Suspense>`, or `next build` fails. Static pages (landing, legal, dev/ui) must stay static: check the build output keeps `/en`, `/uk` and so on as `○`.
- **Proxy cookie check.** It only checks presence. An expired cookie on `/` sends the user to `/today`, then the gate sends them to `/login`. This is accepted; no loop, because `/login` validates for real.
- **`x-forwarded-for`.** The rate limiter keys by `x-forwarded-for`. Vercel sets it from the real client IP. Self-hosting without a trusted proxy would let clients spoof it. That is out of scope; note it in the README.
- **Tests write to the shared (production) database.** Node tests create `test-…@example.com` users and e2e tests create `e2e-…@example.com` users, and both delete them afterwards. Rate-limit rows are keyed by test IPs. If a run crashes, leftovers stay; the next run's `afterAll` pattern delete removes them.
- **CI secret.** Add `BETTER_AUTH_SECRET` to the GitHub secrets and to Vercel (all environments) before pushing, or the env validation fails the build.
- **Google round trip** depends on the lead's OAuth client. Without it, AC3's happy path is verified only in `/review` once the credentials exist.
- **Later specs.** 04 adds the onboarding redirect, the real `user.name` and Log out in Profile. 05 replaces the `/today` placeholder. 17 adds the offline log-out guard. 27 adds reset, verification and linking.

## 11. Implementation notes

- **Versions.** `better-auth` 1.7.18, `react-hook-form` 7.91, `@hookform/resolvers` 7.0. The Better Auth CLI is now the `auth` package (`pnpm dlx auth@1.7.18 generate`). `@better-auth/cli` stopped at 1.4. The schema was generated from a throwaway config with only the schema-relevant options, because the real config needs env and the database.
- **Config names** confirmed in the installed types: `advanced.database.generateId: 'uuid'` (ids are `uuid` with `gen_random_uuid()`), `rateLimit.storage: 'database'` with `customRules` keyed `/sign-in/email` and `/sign-up/email`, `account.accountLinking.enabled: false`, `advanced.useSecureCookies`.
- **Error codes:** `INVALID_EMAIL_OR_PASSWORD` (401); `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422, matched by the `USER_ALREADY_EXISTS` prefix); 429 for the limiter. The Google callback refusal arrives as `?error=account_not_linked`, because Better Auth joins `"account not linked"` with underscores.
- **Generated tables use `timestamp` (without time zone),** not `timestamptz` as `DATA_MODEL.md` prescribes for our own tables. Left as generated (the doc says do not hand-edit auth tables); reported to the lead.
- **Migration** `0000_silly_nightmare.sql`: 5 tables, 2 FKs (cascade), 3 indexes, no drops. Applied to the shared database with `pnpm db:migrate`.
- **`BETTER_AUTH_SECRET`** was generated and appended to the lead's `.env.local` without printing it. The workflows read it from the `BETTER_AUTH_SECRET` GitHub secret.
- **Structure:**
  - `authBaseUrl` lives in its own `src/server/auth/base-url.ts`, so it is testable without env.
  - `isGoogleEnabled()` defaults to the process env when called without an argument.
  - `src/server/auth/request-session.ts` holds `getRequestSession` (React `cache`) and the `x-pampojo-path` header name.
  - The two forms share `src/features/auth/CredentialsForm`; `LogInForm` and `SignUpForm` only supply the submit call.
- **Tabs** are a `nav` of two links with `aria-current`, not the shadcn `Tabs` primitive, because they switch routes.
- **Login with an empty password** shows a new string, `Enter your password` / `Введи пароль`, for the schema's `required` code. The plan's copy had no message for it.
- **Navigation after sign-in, sign-up and log-out** is a full page load (`navigateAfterAuth` → `window.location.assign`). With `router.replace` + `refresh`, the previous route stayed mounted next to the new one after log-out (two `<h1>`s).
- **`/login` and `/signup` with a session** redirect from inside a Suspense boundary under Cache Components. The response is 200 with the static shell, and the redirect follows as a streamed client navigation. The e2e tests wait for the URL.
- **Next's route announcer** also has `role="alert"`. Tests find the form alert by its text.
- **Landing performance.** `GoogleSignInButton` imports `@/api/auth` lazily, on click. A static import pulled the Better Auth client chunk onto the landing page even when the button was not rendered: Lighthouse performance dropped to about 0.65–0.94 (TBT up to 440 ms). After the change it is 1.0 (TBT 0–10 ms), and the auth chunk no longer loads on `/`.
- **Vitest browser project:** `define` for `process.env` (`next/link` and `next/image` read it) and an alias of `next/image` to `src/test/next-image-stub.tsx`. In Vite, `next/image`'s default export arrives as an object.
- **Test isolation:**
  - node test files own their email prefixes (`test-auth-`, `test-handler-`), because files run in parallel and clean up by pattern. A shared `test-%` pattern deleted another file's users mid-run.
  - e2e tests set a per-test `x-forwarded-for` (198.51.100.x) and delete `e2e-%@example.com` users and their rate-limit rows in `afterAll`.
- **`src/test/__tests__/lint-rules.test.ts`** has a 30 s test timeout. The first ESLint run now takes about 8 s.
- **The `Error: aborted` log line** from Better Auth during e2e is a client request cut off by the full-page navigation, and it is harmless.
- **Not verified:** the Google OAuth round trip (AC3 happy path), because no OAuth client exists yet. The config, the hidden-on-preview behavior and the conflict error display are covered by tests.

## 12. Review — 2026-11-09

**Verdict:** Fail. Two small fixes are needed: findings 1 and 2. Everything else passes or is minor.

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `e2e/03-auth.spec.ts` "sign up…"; `auth-api.test.ts` "creates a user and a session cookie"; `AC1-{mobile,desktop}-today.png` |
| AC2 | Pass | `auth-api.test.ts` "answers a wrong password and an unknown email identically"; e2e "wrong credentials…"; `AC2-*-wrong-credentials.png` (focus moves to the alert) |
| AC3 | Pass (error path) / Not testable (OAuth round trip) | `auth-api.test.ts` "account linking"; e2e "shows the Google conflict error"; `AC3-*-account-not-linked.png`. No OAuth client exists yet, so the new-user and returning-user round trips were not run. |
| AC4 | Pass | `auth-api.test.ts` "refuses an email that already exists"; `AuthCard.test.tsx`; `AC4-*-email-taken.png` |
| AC5 | Pass | `utils.test.ts`; e2e "protected routes…" and "ignores an unsafe next"; walk: `GET /today` → 307 `/login?next=%2Ftoday` |
| AC6 | Pass | `handler.test.ts` "withHandler auth" (401 without a session, the right `userId` with one); health is still public (e2e 00) |
| AC7 | Pass | `auth-api.test.ts` (HttpOnly, Lax, Max-Age, Secure in production, sliding extension); walk: cookie `HttpOnly`, `Lax`, 30.0 days |
| AC8 | Fail (partial) | Field errors, pending label and one request on a double click pass (`LogInForm.test.tsx`, `SignUpForm.test.tsx`, `AC8-*-field-errors.png`, `AC8-*-pending.png`). The Google button is not disabled while the credentials form is pending (finding 2). |
| AC9 | Pass | e2e "sign up lands on /today and / redirects there"; walk |
| AC10 | Pass | e2e "signed-in users are sent…"; walk |
| AC11 | Pass | e2e "log out ends the session"; walk: the old cookie on `/today` → `/login?next=%2Ftoday`; `AC11-*-after-logout.png` |
| AC12 | Pass | `auth-api.test.ts` "limits sign-in…" (real 429); `LogInForm.test.tsx`; `AC12-*-rate-limited.png` (mocked 429) |
| AC13 | Pass | `AuthCard.test.tsx`; e2e "offline shows a notice…"; `AC13-*-offline.png` (submit opacity 0.5, the notice clears when back online) |
| AC14 | Pass (local) | `google.test.ts`; `AuthCard.test.tsx` "hides Google…"; `AC14-*-landing-no-google.png` (the hero keeps the `/signup` link). Not checked on a real preview deployment. |
| AC15 | Pass | e2e "auth pages in en-US / uk-UA"; `AC15-{mobile,desktop}-{login,signup}-{en,uk}.png`, `AC15-*-today-uk.png`; `scrollWidth <= innerWidth` everywhere |

Screenshots: `scratch/review/03-auth/` (git-ignored).

### Findings

1. [major] A network failure during submit leaves the form stuck: `src/features/auth/CredentialsForm/CredentialsForm.tsx:42`.
   - `@better-fetch/fetch` does not catch a rejected `fetch` (`dist/index.js:514`), so `authClient.signIn.email` throws.
   - `inFlight` and `pending` are never reset. The button stays "Logging in…" and disabled, no alert appears, and Next reports an unhandled rejection.
   - Reproduced by aborting the request: `AC8-*-network-failure.png`.
   - Flaky gym Wi-Fi with `navigator.onLine === true` is the normal case for this app.
   - The same pattern is in `LogOutButton/LogOutButton.tsx:16` and `GoogleSignInButton/GoogleSignInButton.tsx:26-27`.
   - Fix: `try/finally` and show the generic error.
2. [major] The Google button stays enabled while email sign-in or sign-up is pending (AC8): `src/features/auth/AuthCard/AuthCard.tsx:92`.
   - `pending` lives inside `CredentialsForm`, and `AuthCard` passes no `disabled` to `GoogleSignInButton`.
   - The reverse also holds: a pending Google redirect does not disable the submit.
   - No test covers this. It is not visible locally, because Google is not configured.
3. [minor] A stale server error stays visible during the next attempt: `AuthCard.tsx:79`. The 429 alert is still shown while the next request is in flight (`AC8-*-network-failure.png`). Clear `message` when a submit starts.
4. [minor] The element order differs from the spec and the plan, and Implementation notes do not record it: `AuthCard.tsx:72-99`. The spec says server errors go "above the submit", and the plan orders Google → divider → offline notice → alert → form. The code renders the notice and the alert above the Google button.
5. [minor] The spec's UX rule "first field focused on load on desktop only" is not implemented, and Implementation notes do not record it: `CredentialsForm.tsx:58`.
6. [minor] Previews trust only the per-deployment URL: `src/server/auth/auth.ts:18`, `base-url.ts:9`. Opening a preview through its branch alias (`VERCEL_BRANCH_URL`) will likely fail Better Auth's origin check on sign-in. This is plausible but not verified, because no preview was deployed.
7. [minor] A production deploy without `BETTER_AUTH_URL` silently falls back to `http://localhost:3000`: `base-url.ts:10`. Consider failing env validation when `VERCEL_ENV=production` and the variable is missing.
8. [minor] `x-pampojo-path` is declared twice: `src/proxy.ts:7` and `src/server/auth/request-session.ts:9`. If one copy changes, the `next` round trip silently breaks. Move it to a constant shared by both files that is not `server-only`.
9. [minor] The README lacks the `x-forwarded-for` self-hosting note that plan section 10 asks for.
10. [minor, decision pending] The auth tables use `timestamp`, while `DATA_MODEL.md` says `timestamptz`. This was already reported in Implementation notes and still needs the lead's call. The migration has already run on the shared database, so any change would be a new migration.

### Checks

- lint: pass.
- typecheck: pass.
- i18n:check: pass (148 keys, catalogs complete).
- tests: `pnpm test`: 24 files, 116 tests passed.
- e2e: `pnpm test:e2e` (all specs, dev server): 64 passed, 2 skipped (viewport-specific tests in 02).
- build: `pnpm build` passes. `/en`, `/uk`, the legal pages and `/dev/ui` stay static (`○`). `/login`, `/signup` and `/today` are partially prerendered (`◐`).
- UI walk: Playwright script at 390×844 and 1440×900, in `en` and `uk`. It covered the default, field-error, server-error, pending, rate-limited, offline and network-failure states. Test users `e2e-review-%@example.com` and the `198.51.100.%` rate-limit rows were deleted afterwards.

### Out of scope

- `/today` renders nothing (`fallback={null}` in `(app)/layout.tsx:6`) for about 200 ms while the session loads. This is fine for the placeholder; spec 05 should give the app shell a skeleton.
- The `(app)` layout is the only gate. Later pages that read user data must still scope by the session in their own data access and must not rely on the layout check, because Next renders layouts and pages independently.
- The hero has no component test for the preview case. Only `isGoogleEnabled` is unit-tested.
- The pre-existing `docs/specs/27-account-email.md` outline and the doc edits (ROADMAP, SCREENS, spec 04) come from the drill. They are consistent with this spec.

## 13. Review fixes — 2026-11-09

The lead asked to fix findings 1–9 of section 12. Finding 10 (`timestamp` vs `timestamptz`) still waits for the lead's decision.

- **1. Network failures.**
  - `CredentialsForm` catches a rejected submit and reports `{}`, which shows the generic error, then re-enables the form.
  - `GoogleSignInButton` does the same for a failed chunk import or request.
  - `LogOutButton` stays on the page after a network failure and allows a retry. After any server response it still goes to `/`: Better Auth clears the cookie even when it answers an expired session with an error.
  - Logging out has no error copy yet, so a failed log-out only re-enables the button.
- **2. One sign-in at a time.** `AuthCard` keeps `busy: 'credentials' | 'google' | null`. While one is in flight, it disables the other.
- **3. Stale alert.** The alert clears when a new attempt starts.
- **4. Order.** The card renders tabs → title → Google + divider → offline notice → fields → alert → submit. The alert now sits inside the form above the submit, through `CredentialsForm`'s `alert` prop, as the spec says.
- **5. Desktop autofocus.** The email field is focused on load when `(min-width: 1024px)` matches. It is skipped when an alert exists on load (a Google callback error), so focus stays on the alert.
- **6. Preview branch alias.** New optional env `VERCEL_BRANCH_URL`. `authTrustedOrigins(env)` adds it on previews.
- **7. Production base URL.** `parseEnv` fails when `VERCEL_ENV=production` and `BETTER_AUTH_URL` is missing. The `main` workflow's `vercel build --prod` therefore fails until the variable is set in Vercel Production.
- **8. Shared constant.** `ORIGINAL_PATH_HEADER` moved to `src/constants/routing.ts`.
- **9. README.** Added the `x-forwarded-for` self-hosting note and the `BETTER_AUTH_URL` requirement.
- **Tests added:**
  - `LogInForm`: recovery after a network failure.
  - `AuthCard`: Google is disabled while email sign-in is pending, and the reverse; the generic error appears and clears on the next attempt; Google recovers from a failure.
  - `LogOutButton`: pending state and retry after a network failure.
  - `authTrustedOrigins`.
  - `parseEnv` production rule.
- **Checks:**
  - lint, typecheck, i18n:check: pass.
  - `pnpm test`: 25 files, 126 tests passed.
  - `pnpm test:e2e`: all 64 passed once mid-fix (2 viewport skips); after the final focus fix, `e2e/03-auth.spec.ts` (22 tests) passed again.
  - UI re-walk: an aborted request now shows "Something went wrong. Try again." and re-enables Log in (`AC8-*-network-failure.png`). The email field gets focus on desktop only. With a callback error, the alert gets focus on both viewports.

### Lead's changes after review — 2026-11-09

Decided by the lead, logged in `DECISIONS.md` ("Auth form validation and layout"). The spec and AC8 wording were updated to match.

- **Validation timing.** RHF `mode: 'onSubmit'`: field errors appear only after the first submit, then follow typing (`reValidateMode` onChange). There are no on-blur errors.
- **Password hint removed.** The `At least 8 characters` key was dropped from both catalogs.
- **Desktop fits one screen.**
  - The `(auth)` grid is `lg:h-dvh lg:min-h-[640px] lg:flex-none` with a `minmax(0,1fr)` row. `flex-none` is needed, because `flex-1` let content height override `h-dvh`.
  - The brand panel clips the `HeroPhone` mockup at its bottom edge (`overflow-hidden`, `pb-0`). `HeroPhone` itself is unchanged, so the landing is unaffected.
  - The form column uses `justify-center-safe`, so a card taller than the screen scrolls instead of losing its top.
  - Below 760px height, the grid padding and card gaps tighten.
  - Measured with the Google button rendered and both field errors shown: no vertical scroll at 1440×900, 1440×760 and 1280×720; at 1024×640 the sign-up card scrolls by 31px. Mobile 390×844 does not scroll.
  - Screenshots: `scratch/review/03-auth/fit-*.png` and `fit-google-*.png`.
- **Checks:**
  - lint, typecheck, i18n:check: pass.
  - `pnpm test`: 127 passed.
  - `pnpm test:e2e`: 64 passed, 2 skipped.
- **Password placeholder.** `••••••••` on both forms, a constant in `CredentialsForm` (not an i18n key), lead's choice.
