# 0001. PWA instead of native apps

Date: 2026-11-08

## Context

The app must run on Android, iPhone and laptops, and work offline in gyms. A trainer edits on a laptop; trainees use phones. Budget and time are a single developer's.

## Decision

Build one mobile-first Progressive Web App, offline-first. Keep Capacitor as the migration path if store presence or native features become necessary.

## Consequences

- One codebase and instant updates without store review.
- Offline works on both platforms through a service worker and IndexedDB.
- iOS limits: install is manual (Share → Add to Home Screen), no Background Sync, storage can be evicted for non-installed sites, no reliable sound or notification for the rest timer when the screen is locked, push needs an installed app and is restricted in the EU. Design around them (see `docs/tech/OFFLINE.md`).
- If these limits block a core job later, wrap the same code with Capacitor rather than rewriting.
