# 18. Exercise substitution

## Goal

When equipment is busy or missing, the user gets a fitting replacement in seconds, offline too.

## Scope

- Pure ranking function in `src/shared/substitution/` used on the client (offline) and the server (`GET /api/v1/exercises/{id}/substitutes`):
  - candidates: same movement pattern or overlapping primary muscles;
  - exclude: the busy/missing equipment, equipment not in the gym profile;
  - score: primary muscle overlap, same pattern, same mechanic, similar difficulty, secondary overlap; weights as constants;
  - return top N with the matched muscles and needed equipment.
- In session: "Swap exercise" opens a sheet: reason chips (Equipment busy, No equipment, Discomfort), optional "Exclude equipment" chips prefilled from the exercise, 3 suggestions, "Show more".
- Choice: Replace today only (set logs carry `substitutedFromExerciseId`) or Replace in workout (online only: updates the workout).
- Progress counts the performed exercise; history shows "instead of Bench Press".

## Out of scope

AI re-ranking and free-text reasons (22).

## Acceptance criteria

- [ ] AC1: Bench Press with "barbell busy" suggests dumbbell or machine chest presses first; never an exercise needing a barbell.
- [ ] AC2: Suggestions respect the gym profile.
- [ ] AC3: Works offline from local data.
- [ ] AC4: Replace today only keeps the workout unchanged and records `substitutedFromExerciseId`.
- [ ] AC5: The ranking function has table-driven unit tests for at least 15 exercise/reason cases.

## Depends on

08, 10, 16.
