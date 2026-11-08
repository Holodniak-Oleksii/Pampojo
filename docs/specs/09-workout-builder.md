# 09. Workout builder

## Goal

Users create reusable workouts: an ordered set of exercises with targets.

## Scope

- `workout`, `workout_exercise` tables. `GET /api/v1/workouts`, `GET/PUT/PATCH/DELETE /api/v1/workouts/{id}`; the workout and its exercises are saved together in one transaction.
- `/library/workouts`: list with name, exercise count, estimated duration, primary muscles; Create; empty state.
- `/library/workouts/[id]` editor:
  - name, optional description;
  - add exercises through a picker (catalog search and filters, multi-select);
  - per exercise: target sets, reps range or duration (by tracking type), weight, rest; notes;
  - reorder (drag handle on desktop and mobile, plus move up/down buttons for accessibility), remove;
  - desktop: catalog column on the left, workout on the right, drag from catalog into the workout;
  - unsaved changes warning on leave.
- Estimated duration: Σ (sets × (work time estimate + rest)), constants in one place.
- Duplicate workout. Delete workout (soft; past sessions keep their snapshot).

## Out of scope

Supersets and circuits (later), sharing (19), AI generation (21).

## Acceptance criteria

- [ ] AC1: Create a workout with three exercises, save, reopen: order and targets are preserved.
- [ ] AC2: Reorder by drag and by move buttons; saved order matches.
- [ ] AC3: Target fields match the exercise tracking type (no weight field for a time exercise).
- [ ] AC4: Saving the same request twice creates one workout (client id + PUT).
- [ ] AC5: Another user's workout id returns 404.
- [ ] AC6: List shows exercise count and estimated duration; empty state leads to Create.
- [ ] AC7: Leaving with unsaved changes asks for confirmation.
- [ ] AC8: Desktop drag from catalog adds the exercise at the drop position.

## Depends on

06, 07.

## Open questions

- Default targets for a newly added exercise (3×8–12, 90s rest)?
- Weight target: absolute only, or also "same as last time"?
