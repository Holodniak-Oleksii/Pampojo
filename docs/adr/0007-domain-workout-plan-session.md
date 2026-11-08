# 0007. Workouts, plans and sessions as separate concepts

Date: 2026-11-08

## Context

The first idea was "plan → days → exercises". People who train alone think in reusable workouts ("Push Day") and decide when to do them.

## Decision

- **Workout**: a reusable, shareable set of exercises with targets.
- **Plan**: calendar rules that place workouts on dates, including weekly recurrence with an end date.
- **Session**: what actually happened, with a snapshot of the workout at start.
- **Sharing** works on workouts. Import creates a copy (with custom exercises); history is never shared.

## Consequences

- The calendar can compare planned occurrences with sessions: done on time, done late, missed.
- Editing a workout does not rewrite past sessions.
- A trainer mode later assigns workouts and plan rules to clients without changing these concepts.
