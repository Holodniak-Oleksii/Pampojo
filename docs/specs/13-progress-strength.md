# 13. Strength progress

## Goal

Users see whether they are getting stronger: per-exercise trends and personal records.

## Scope

- `GET /api/v1/progress/exercises/{id}?range=` returns points per session: top set weight, estimated 1RM (Epley, 1–12 reps), volume, best reps at bodyweight for `reps` tracking, best time for `time`.
- `/progress`:
  - exercise selector (recently trained first, search);
  - range: 1M / 3M / 6M / 1Y / All;
  - line chart (Recharts via shadcn chart) of the chosen metric with metric switch;
  - personal records: heaviest weight, best e1RM, most reps at a weight, best volume session, with dates;
  - stat cards: workouts this month, total volume this month.
- Session summary (spec 10) shows new records achieved in the session.

## Out of scope

Body metrics (14), muscle-group volume heatmap (later).

## Acceptance criteria

- [ ] AC1: For a fixture of sessions, the chart points and e1RM values match hand-computed values.
- [ ] AC2: A new heaviest set appears as a record with its date; the session summary lists it.
- [ ] AC3: An exercise with no history shows an empty state with Start.
- [ ] AC4: Charts have accessible summaries (latest value, change over the range).
- [ ] AC5: Range switching does not refetch more than needed (cached per range).

## Depends on

12.
