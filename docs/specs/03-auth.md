# 03. Authentication

## Goal

Users can create an account and sign in with email and password or Google, and stay signed in on their phone.

## Scope

- Better Auth with the Drizzle adapter; generated auth tables and migration.
- Email + password sign up and log in; password rules: minimum 8 characters.
- Google OAuth (lead provides client id and secret).
- Forgot password: email with reset link (email provider decided below); reset page.
- Email verification: decide in drill (see open questions).
- Pages `/login`, `/signup`, `/forgot-password`, `/reset-password` with the design from the auth prompt: form card, tabs Log in / Sign up, Google button, divider, fields, links. Desktop: two columns with a brand panel.
- Route protection: `(app)`, `/onboarding` and `/session/*` require a session; `/login` and `/signup` redirect a signed-in user to `/today` (or `/onboarding` if not completed).
- `/` redirects a signed-in user to `/today`. The check runs in `src/proxy.ts` on the session cookie, so the landing page stays statically prerendered (moved here from spec 02).
- Replace the landing's "Continue with Google" link (`/signup` placeholder) with Google sign-in.
- Log out action (button lands in Profile in spec 04; the offline guard comes in spec 17).
- `getSession()` server helper used by `withHandler`.

## Out of scope

Magic links, other OAuth providers, 2FA, account deletion (later).

## Acceptance criteria

- [ ] AC1: Sign up with email creates a user and a session and redirects to `/onboarding`.
- [ ] AC2: Log in with valid credentials redirects to `/today` (or `/onboarding` when not completed); invalid credentials show one generic error without revealing whether the email exists.
- [ ] AC3: Google sign-in creates or links the account and follows the same redirects.
- [ ] AC4: Forgot password sends a reset email; the link sets a new password once and then expires.
- [ ] AC5: Visiting a protected route without a session redirects to `/login` and returns to the original route after login.
- [ ] AC6: API routes under `/api/v1` (except health and share preview) return 401 without a session.
- [ ] AC7: The session survives closing and reopening the browser for at least 30 days.
- [ ] AC8: Forms validate with the shared Zod schemas and show field errors; submit is disabled while pending.
- [ ] AC9: A signed-in user opening `/` lands on `/today`; a visitor without a session sees the landing page.

## Depends on

01, 02.

## Open questions

- Email provider for reset and verification emails (Resend free tier or similar)?
- Require email verification before using the app, or only before sharing?
