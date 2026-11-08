# 10. Workout session

## Goal

The core gym experience: start a workout, log every set in one or two taps, rest between sets, finish with a summary.

## Scope

- `workout_session`, `set_log` tables; endpoints from `API.md`. Writes go through a `SessionRepository` (see `state-and-data.md`), client-generated ids, idempotent `PUT`.
- Start from a workout (Start sheet, workout details, later the calendar). Snapshot of the workout stored on the session. One session in progress at a time; Start resumes it.
- `/session/[id]` full screen, no nav:
  - header: workout name, elapsed time, Finish;
  - current exercise card: name, image, "Last time: 80 kg × 8" from the previous session with this exercise;
  - set rows prefilled from targets (or last time — decide in drill): weight, reps (or time), check button;
  - checking a set logs it and starts the rest timer (`restEndsAt`); timer bar with -15s / +15s / Skip;
  - add set, remove last unlogged set, edit a logged set;
  - exercise list to jump between exercises; reorder for this session only;
  - notes per session.
- Finish: confirm if sets remain unlogged; summary with duration, volume, sets, new records count (records logic is spec 13, show it when available).
- Abandon session (discard) with confirmation.
- Wake Lock while the session screen is visible, where supported.
- Large tap targets (48px+), numbers 28px+, numeric keyboards.

## Out of scope

Swap exercise (18), offline storage (16), plan linking (`scheduledFor`, spec 11–12).

## Acceptance criteria

- [ ] AC1: Starting a workout creates a session with a snapshot; editing the workout later does not change the session.
- [ ] AC2: Logging a set takes one tap on the check when targets are prefilled; the set is saved and the rest timer starts with the exercise's rest time.
- [ ] AC3: The rest timer stays correct after the phone sleeps or the tab is backgrounded for longer than the rest (it computes from `restEndsAt`).
- [ ] AC4: "Last time" shows the most recent completed set values for this exercise, or nothing for a first time.
- [ ] AC5: Reloading the page during a session restores it with all logged sets.
- [ ] AC6: Sending the same set log twice results in one row.
- [ ] AC7: Finish shows the summary; the session appears as completed; Start no longer resumes it.
- [ ] AC8: Abandon removes the session from history after confirmation.
- [ ] AC9: The layout works one-handed at 390px; desktop shows exercise list, current exercise and timer side by side.

## Depends on

09.

## Open questions

- Prefill sets from targets or from last time's values?
- Should the repository write directly to the server now, or should spec 16's local layer be pulled forward into this spec? (Affects rework; see ADR 0005.)
- Max session length before auto-abandon (for forgotten sessions)?
