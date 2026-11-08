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

## Open questions

Raise these during `/drill` of the listed spec.

- UI language: English only first, or Ukrainian from day one? (spec 01)
- Data layer before spec 15: write sessions straight to the server, or build the local Dexie layer from spec 10? (spec 10)
- Exercise dataset source and its license. (spec 06)
- Speech-to-text and image generation providers. (specs 20, 24)
