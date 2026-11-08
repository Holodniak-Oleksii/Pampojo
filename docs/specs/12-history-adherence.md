# 12. History and adherence

## Goal

The calendar shows what really happened against the plan, so the user sees missed and late workouts and how well they follow the plan.

## Scope

- `GET /api/v1/calendar?from=&to=` returns days with occurrences, sessions and statuses.
- Status per occurrence:
  - **done on time** — a completed session with `scheduledFor` = date, finished that day;
  - **done late** — completed session for that occurrence on a later day, before the next occurrence of the same rule;
  - **missed** — date is past and no such session;
  - **planned** — today or future.
- Unplanned sessions show as "extra" on their day.
- Calendar markers with colors and labels from the design system; legend.
- Summary for the visible month: completed, missed, done late, adherence % = (on time + late) ÷ due occurrences.
- Day details: the session(s) with exercises, sets, duration; Start for planned.
- List view toggle: past sessions newest first, with infinite scroll.
- Today: week strip with statuses, adherence this month (`SegmentedGauge`), last session card.
- When starting a late workout, the user can link it to the missed occurrence ("Make up Monday's Push Day?").

## Out of scope

Streaks, notifications.

## Acceptance criteria

- [ ] AC1: Each status rule above is covered by unit tests of the pure status function, including time zones.
- [ ] AC2: The calendar shows the four statuses with distinct markers and text labels (not color alone).
- [ ] AC3: Adherence for a month with 8 due, 5 on time, 1 late is 75%.
- [ ] AC4: Tapping a past day shows that day's session details.
- [ ] AC5: List view loads older sessions on scroll.
- [ ] AC6: Starting a workout after a missed occurrence offers to link it; accepting marks the occurrence done late.
- [ ] AC7: The calendar endpoint runs a constant number of queries for a month.

## Depends on

11.

## Open questions

- Does a completed session on a non-planned day count toward adherence?
- Grace window for "done late": until the next occurrence, or a fixed number of days?
