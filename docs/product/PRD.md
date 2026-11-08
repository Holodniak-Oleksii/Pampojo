# Pampojo — Product Requirements

## Problem

People who train by their own program track it in notes, spreadsheets or memory. Existing apps are either cloud-only (they break in basement gyms with no signal) or rigid about how a program is structured. Sharing a program with a friend means screenshots.

## Users

- **Self-trainer** (primary). Trains 2–5 times a week, builds their own workouts, wants to see progress. Uses a phone in the gym and sometimes a laptop at home.
- **Friend / partner**. Receives a workout from someone and trains with it.
- **Trainer** (later). Builds workouts and plans for clients on a laptop.

## Jobs to be done

- When I am in the gym, I want to open today's workout and log sets in one or two taps, even with no signal.
- When equipment is busy, I want a fitting replacement for the exercise right now.
- When I plan my week, I want to put workouts on days once and have them repeat.
- When I look back, I want to see what I did, what I missed, and whether I am getting stronger.
- When I made a good workout for someone, I want to send it and have them import it in a tap.

## Product principles

1. **The gym comes first.** Session mode works offline, with big touch targets and no dead ends.
2. **Own your structure.** Workouts are free-form sets of exercises; the calendar is optional.
3. **Honest data.** Substitutions, late sessions and missed sessions are recorded as they happened.
4. **AI suggests, the user decides.** AI output is always a draft built from the user's own catalog.

## MVP scope

Specs `00`–`19` in `docs/specs/`:

- Landing page, sign up and log in (email, Google), short onboarding (name, emoji avatar, sex, age, height, weight).
- Exercise catalog with structured metadata, custom exercises, gym equipment profile.
- Workout builder (desktop drag and drop, mobile-friendly editing).
- Session mode: set logging, rest timer, previous values, session timer.
- Calendar plan with recurring rules; history with done / done late / missed and adherence.
- Progress: per-exercise charts, personal records, estimated 1RM.
- Body measurements and BMI with weight trend.
- PWA install, offline sessions, sync queue, online/offline status.
- Deterministic exercise substitution.
- Sharing workouts by link and file, import as a copy.

## After MVP

- AI: workout generation by prompt, AI substitution re-ranking, auto-tagging custom exercises, creating an exercise by voice with generated description and visuals, muscle-map picker (specs `20`–`25`).
- Trainer mode: clients, assigning workouts and plans (spec `26`).

## Non-goals

- Nutrition and calorie tracking.
- Social feed, likes, followers.
- Wearable integrations.
- Payments.
- Native store apps (possible later through Capacitor).

## Success metrics

- Activation: a new user finishes onboarding and logs a first session within 7 days.
- Retention: share of users with sessions in weeks 2 and 4.
- Plan adherence: median adherence of users who have a plan.
- Offline reliability: zero lost set logs (sessions with pending mutations that never sync).
- AI quality (later): eval pass rate per feature, share of generated drafts saved.
