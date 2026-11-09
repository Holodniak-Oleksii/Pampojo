# 03. Authentication

## Goal

Users can create an account and sign in with email and password or Google, and stay signed in on their phone.

## Scope

### Auth core

- Better Auth with the Drizzle adapter (ADR 0003). The generated tables `user`, `session`, `account`, `verification` plus `rate_limit` come with one reviewed, additive migration.
- **Email + password**: sign up and log in. Password 8–128 characters, no other rules. On sign-up, `user.name` (required by Better Auth) is set to the email's local part as a placeholder; spec 04 replaces it in onboarding.
- **Google OAuth.** The lead provides the client id and secret.
  - Redirect URIs are `http://localhost:3000/api/auth/callback/google` and the production URL. Google sign-in does not run on Vercel previews: there the Google buttons are hidden and only email + password works.
  - **No account linking.** If a Google sign-in brings an email that already has a password account, it fails with the "registered with a password" error. Email sign-up with an email that already has a Google account fails with "account already exists". Linking comes with email verification in spec 27.
- **Sessions**: database sessions in an HTTP-only cookie, `Secure` in production, `SameSite=Lax`. They expire after 30 days of inactivity (sliding; refreshed at most once a day).
- **Rate limiting**: Better Auth's limiter with `storage: 'database'` (`rate_limit` table). Sign-in and sign-up: 10 requests per 60 s per IP. Other auth endpoints: Better Auth defaults.
- **Env** (validated in `src/server/env.ts`, listed in `.env.example`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. On previews the base URL comes from `VERCEL_URL`, and the Google variables may be absent.

### Pages

All pages live under `src/app/[lang]/`, are translated through i18n, and are dynamic, because they read the session.

- **`/login` and `/signup`.** One card with tabs Log in / Sign up. The tabs are links between the two routes. The card holds a title, a subtitle, the Google button (hidden on previews), the "or" divider, the email and password fields (with a show/hide toggle on the password), and submit.
  - Sign-up also shows the terms note, with links to `/terms` and `/privacy`. There is no password hint; the length rule shows as a field error after submit.
  - **Mobile**: the card spans the width with a 16px gutter, and the header shows only the wordmark linking to `/`.
  - **Desktop (≥ 1024px)**: two columns that fit one screen without scrolling (the brand panel clips the mockup on short screens). Left is a brand panel (peach gradient, wordmark, the landing headline, the `HeroPhone` mockup from spec 02). Right is the form card, vertically centered.
- **`/today` placeholder**, protected. It shows "You're signed in", "Signed in as {email}" and a Log out button. Spec 05 replaces it with the real Today screen.

### Redirects and protection

- After sign-up, log in or Google sign-in, the user goes to `next` (when valid) or `/today`. Spec 04 adds the `/onboarding` redirect for users who have not finished onboarding.
- `next` is accepted only as a same-origin relative path (it starts with `/`, not `//`, and not `/api`). Anything else is ignored, which prevents open redirects.
- **Protected routes**: the `(app)` route group (now only `/today`), `/onboarding` and `/session/*` once they exist. Without a valid session they redirect to `/login?next=<original path>`. The real check is server-side in the `(app)` layout. The proxy only adds an optimistic redirect when no session cookie is present.
- **`/login` and `/signup`** check the session on the server. A signed-in user goes to `/today`.
- **`/`**: `src/proxy.ts` redirects to `/today` when the session cookie is present (presence only), so the landing stays static. A stale cookie ends at `/login` through the `/today` guard, with no loop.
- **Log out** ends the session on the server, clears the cookie and goes to `/`. The button lives on the `/today` placeholder now and moves to Profile in spec 04. The offline guard comes in spec 17.

### API

- `/api/auth/*`: the Better Auth handler.
- `getSession()` server helper, plus `withHandler({ auth: 'required' })`, which returns 401 `UNAUTHORIZED` without a session and passes `userId` to the handler. Every `/api/v1` route except health and the share preview (spec 19) uses `auth: 'required'`.
- Test support: a rolled-back-transaction helper for DB tests (deferred from spec 00).

### Landing

The hero's "Continue with Google" starts Google sign-in. On previews it stays a link to `/signup`.

## Out of scope

- Forgot / reset password, email verification, Google account linking: spec 27.
- Magic links, other OAuth providers, 2FA, account deletion (later).
- Onboarding gating (04), profile and log out in Profile (04), the offline log-out guard (17).

## UX

- **Validation**: client-side with the shared Zod schemas. Field errors appear only after the first submit, then update as the user types. Field errors go under the field, linked by `aria-describedby`. Server errors go in an alert above the submit.
- **Pending**: the submit and the Google button are disabled, and the submit shows the pending label.
- **Offline** (`navigator.onLine === false`): an inline notice above the form. Submit and Google are disabled.
- **Focus**: the first field is focused on load on desktop only, to avoid popping the keyboard on phones. After an error, focus moves to the alert.
- Touch targets are at least 44px. The password toggle is an icon button with an accessible name.

## Data and API

- Tables: Better Auth's generated `user`, `session`, `account`, `verification`, `rate_limit` (`docs/tech/DATA_MODEL.md` "Auth"). No profile yet (spec 04).
- Endpoints: `/api/auth/*` (Better Auth). There are no new `/api/v1` routes.
- Shared Zod schemas in `src/shared/schemas/auth.ts`: `emailSchema` (trimmed, lower-cased, valid email, ≤ 254), `passwordSchema` (8–128), `signUpInputSchema`, `logInInputSchema`.

## Copy

| Where | en | uk |
| --- | --- | --- |
| Tabs | Log in / Sign up | Увійти / Реєстрація |
| Login title | Welcome back | З поверненням |
| Login subtitle | Log in to continue your training. | Увійди, щоб продовжити тренування. |
| Sign-up title | Create your account | Створи акаунт |
| Sign-up subtitle | Free. Takes less than a minute. | Безкоштовно. Займе менше хвилини. |
| Google button | Continue with Google | Продовжити з Google |
| Divider | or | або |
| Email label / placeholder | Email / you@example.com | Email / you@example.com |
| Password label | Password | Пароль |
| Password placeholder | •••••••• | •••••••• |
| Password toggle (accessible name) | Show password / Hide password | Показати пароль / Сховати пароль |
| Submit (login) / pending | Log in / Logging in… | Увійти / Входимо… |
| Submit (sign-up) / pending | Create account / Creating account… | Створити акаунт / Створюємо акаунт… |
| Error: invalid email | Enter a valid email | Введи коректний email |
| Error: password too short | Password must be at least 8 characters | Пароль має містити щонайменше 8 символів |
| Error: password too long | Password must be at most 128 characters | Пароль має містити не більше 128 символів |
| Error: wrong credentials | Wrong email or password | Неправильний email або пароль |
| Error: email taken | An account with this email already exists. Log in instead. | Акаунт із цим email уже існує. Увійди. |
| Error: Google vs password account | This email is registered with a password. Log in with your password. | Цей email зареєстровано з паролем. Увійди з паролем. |
| Error: rate limited | Too many attempts. Try again in a minute. | Забагато спроб. Спробуй за хвилину. |
| Error: generic | Something went wrong. Try again. | Щось пішло не так. Спробуй ще раз. |
| Offline notice | You're offline. Connect to the internet to log in. | Ти офлайн. Під'єднайся до інтернету, щоб увійти. |
| Terms note | By signing up you agree to the Terms and Privacy policy. ("Terms" and "Privacy policy" are links) | Реєструючись, ти погоджуєшся з Умовами та Політикою конфіденційності. |
| Meta titles | Log in · Pampojo / Sign up · Pampojo | Вхід · Pampojo / Реєстрація · Pampojo |
| `/today` placeholder | You're signed in / Signed in as {{email}} / Log out | Ти в акаунті / Акаунт: {{email}} / Вийти |

## Acceptance criteria

- [ ] AC1: Signing up with a new email and a valid password creates a user and a session, sets the session cookie and lands on `/today`, which shows "Signed in as {email}".
- [ ] AC2: Logging in with valid credentials lands on `/today` (or on a valid `next`). Wrong password and unknown email show the same "Wrong email or password" error, with the same HTTP status and no difference in the response body.
- [ ] AC3: Google sign-in for a new email creates an account and lands on `/today`. For a returning Google user it signs in. For an email that has a password account it shows the "registered with a password" error and creates nothing. Checked manually on localhost and production; the e2e mocks the OAuth step or skips it.
- [ ] AC4: Email sign-up with an email that already exists (password or Google) shows "An account with this email already exists. Log in instead." and creates nothing.
- [ ] AC5: Opening `/today` without a session redirects to `/login?next=%2Ftoday`. After logging in, the user lands on `/today`. A `next` of `https://evil.example`, `//evil.example` or `/api/...` is ignored and the user lands on `/today`.
- [ ] AC6: A `/api/v1` route declared with `auth: 'required'` returns 401 `UNAUTHORIZED` without a session and receives the right `userId` with one (handler test). `/api/v1/health` stays public.
- [ ] AC7: The session cookie has `HttpOnly`, `SameSite=Lax`, `Secure` (production) and an expiry about 30 days ahead. A session used again after 2 days gets its expiry extended.
- [ ] AC8: The forms validate with the shared Zod schemas. Invalid email, short and long passwords show the field errors from Copy. Submit is disabled while pending, and a double click sends one request.
- [ ] AC9: A signed-in user opening `/` lands on `/today`. A visitor without a session cookie sees the landing page.
- [ ] AC10: Signed-in users opening `/login` or `/signup` land on `/today`.
- [ ] AC11: Log out ends the session (the old cookie no longer opens `/today`) and lands on `/`.
- [ ] AC12: The 11th sign-in attempt within 60 s from the same IP gets the "Too many attempts" error.
- [ ] AC13: With the browser offline, `/login` shows the offline notice, and submit and Google are disabled.
- [ ] AC14: On a Vercel preview, the Google buttons are hidden on `/login`, `/signup` and the landing hero.
- [ ] AC15: `/login`, `/signup` and `/today` work at 390px and 1440px in `en` and `uk` with the copy above, and there is no horizontal scroll.

## Depends on

01, 02. The lead creates the Google OAuth client (Web application) with the redirect URIs above.

## Open questions
