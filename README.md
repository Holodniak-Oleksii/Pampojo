# Pampojo

Offline-first gym workout tracker. Build your own workouts, plan them in a calendar, log every set in the gym without a signal, and share workouts with friends.

> This README is a case-study skeleton. Fill each section as the project grows.

## Problem

People who train on their own plans juggle notes apps, spreadsheets and memory. Gyms are often in basements with no signal, so cloud-only apps fail exactly where they are needed.

## Solution

- Workouts built from a structured exercise catalog.
- A calendar plan with recurring sessions and adherence tracking.
- A fast session mode that works fully offline and syncs later.
- Progress charts, personal records, body measurements and BMI.
- Sharing workouts by secure link or file; import makes a copy.
- AI features on top of the same data: workout generation, smart substitutions, exercise creation by voice.

## Architecture

See `docs/tech/ARCHITECTURE.md`. Key decisions live in `docs/adr/`.

## AI approach

See `docs/tech/AI.md`: catalog-constrained generation, structured output, validation, evals in CI.

## How it was built

Spec-driven development with an AI agent: `docs/specs` → `/drill` → `/scratch` → `/implement` → `/review`. See `CLAUDE.md`.

## Running locally

Filled in by spec `00-project-setup`.

## What I would do next

-
