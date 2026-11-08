# 07. Custom exercises

## Goal

Users can add exercises the catalog lacks, with the same metadata, so they work in workouts, substitution and AI later.

## Scope

- Create, edit and delete own exercises (`ownerId = user`), `PUT/PATCH/DELETE /api/v1/exercises/{id}`.
- Form: name (required), primary muscles (required, 1+), secondary muscles, equipment (1+, `bodyweight` allowed), movement pattern, mechanic, tracking type (required), description, instruction steps (add/remove/reorder), optional image upload (private bucket, resized to WebP on the server).
- "Duplicate as my own" on a system exercise prefills the form.
- Own exercises appear in the catalog list with a "Mine" badge and a "Mine" filter chip.
- Delete: soft delete; an exercise used in a workout cannot be deleted without confirmation listing the workouts (decide behavior in drill).
- Creating and editing require online (offline rules arrive in spec 17).

## Out of scope

AI tagging (23), voice creation (24).

## Acceptance criteria

- [ ] AC1: A user creates an exercise with the required fields and finds it in the catalog under "Mine".
- [ ] AC2: Another user never sees it in lists, search or by id (404).
- [ ] AC3: Editing changes only the fields edited; system exercises cannot be edited.
- [ ] AC4: Uploading an image over 5 MB or not an image is rejected with a clear error; a valid one is shown in details.
- [ ] AC5: Deleting an unused exercise removes it from the catalog; deleting a used one follows the decided behavior.
- [ ] AC6: Duplicate as my own creates a separate copy with `sourceExerciseId` set.

## Depends on

06.

## Open questions

- Deleting an exercise used in workouts: block, or remove it from those workouts, or keep it hidden but resolvable for history?
