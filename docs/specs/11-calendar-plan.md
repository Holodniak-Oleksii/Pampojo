# 11. Calendar plan

## Goal

Users place workouts on the calendar once, including weekly repeats, instead of tapping every day.

## Scope

- `schedule_rule` table and endpoints.
- `/calendar` month view (mobile compact grid, desktop large grid with a side panel): planned occurrences as outline markers with the workout name on desktop.
- "Schedule workout" dialog: workout, start date, repeat: once / weekly on selected weekdays / every N weeks, end: never / on date / after N times.
- Occurrence expansion is a pure function shared by client and server (`src/shared/plan/occurrences.ts`), tested with time zones and DST.
- Day panel: planned workouts for the selected day with Start (starts the session with `scheduledFor` = that date).
- Edit a rule: change applies to future occurrences only; past ones stay as they were (decide exact behavior in drill). Delete a rule (future occurrences disappear).
- Today shows today's planned workouts with Start.

## Out of scope

Statuses and adherence (12), skipping or moving a single occurrence (12 if needed), reminders.

## Acceptance criteria

- [ ] AC1: Scheduling "Push Day every Monday and Thursday until 2027-03-01" shows exactly those dates and none after.
- [ ] AC2: A one-off schedule shows on one date only.
- [ ] AC3: Occurrences are correct across a DST change in the user's time zone.
- [ ] AC4: Starting from the calendar day creates a session with `scheduledFor` set to that date.
- [ ] AC5: Editing a rule does not change occurrences before today; deleting removes future ones.
- [ ] AC6: Today lists today's planned workouts; with none, it shows the next planned date.

## Depends on

10.

## Open questions

- Edit semantics: split the rule at today, or edit in place for future dates?
- Allow two workouts on the same day?
