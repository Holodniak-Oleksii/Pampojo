# 0003. Better Auth for authentication

Date: 2026-11-08

## Context

Auth must be free with no user limits, support email and Google, and keep users in our own database.

## Decision

Better Auth (MIT) inside the Next.js app, with the Drizzle adapter on our Postgres. Email + password and Google OAuth.

## Consequences

- No vendor lock-in and no per-user cost.
- We own security updates: keep the package current, follow its release notes.
- Sessions are cookies; offline the app keeps the last known session locally and does not log the user out.
- Supabase Auth was the alternative; it would tie auth to the database vendor.
