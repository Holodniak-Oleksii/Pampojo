# Roadmap

Each line is a spec in `docs/specs/`. Specs are delivered in order; a milestone ends with a deploy.

## M0 — Foundation

- `00-project-setup` — Next.js app, tooling, database, CI, deploy.
- `01-design-system` — tokens, shadcn theme, brand assets, base components, i18n setup.
- `02-landing` — public landing page.
- `03-auth` — email and Google sign in.
- `04-onboarding-profile` — onboarding steps and profile basics.
- `05-app-shell` — navigation, top bar, Today skeleton, status pill placeholder.

## M1 — Catalog and workouts

- `06-exercise-catalog` — seeded catalog, browse, filters, details.
- `07-custom-exercises` — create and edit own exercises.
- `08-gym-profile` — equipment available in the user's gym.
- `09-workout-builder` — create, edit, reorder, delete workouts.

## M2 — Training

- `10-workout-session` — session mode, set logging, rest timer.
- `11-calendar-plan` — scheduling with recurring rules.
- `12-history-adherence` — calendar history, statuses, adherence, Today data.

## M3 — Progress

- `13-progress-strength` — charts, records, estimated 1RM.
- `14-body-measurements-bmi` — measurements, weight trend, BMI.

## M4 — Offline and sharing

- `15-pwa-shell` — manifest, icons, service worker, install guide.
- `16-offline-data-sync` — local database, outbox, sync API.
- `17-offline-ux` — status pill, offline restrictions, logout guard, image caching.
- `18-exercise-substitution` — deterministic swap suggestions.
- `19-share-import` — share links, file export, import as copy.

## M5 — AI

- `20-ai-foundation` — provider client, prompts, evals, cost log, limits.
- `21-ai-workout-generation` — generate a workout draft from a prompt.
- `22-ai-substitution` — AI re-ranking with reasons.
- `23-ai-exercise-tagging` — suggest tags for custom exercises.
- `24-ai-exercise-from-voice` — voice → exercise card → visuals.
- `25-muscle-map-picker` — pick muscles on a body map, get suggestions.

## M6 — Later

- `26-trainer-mode` — clients, assigning workouts and plans.
- Ukrainian locale, Capacitor wrapper, push reminders.
