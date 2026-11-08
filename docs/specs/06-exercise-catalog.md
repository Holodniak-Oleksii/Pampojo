# 06. Exercise catalog

## Goal

A browsable catalog of system exercises with rich metadata, which every later feature (builder, substitution, AI) relies on.

## Scope

- `exercise` table and constants: `MUSCLE_GROUPS`, `EQUIPMENT`, `MOVEMENT_PATTERN`, `MECHANIC`, `LATERALITY`, `TRACKING_TYPE`.
- Seed of 150–300 system exercises from an open dataset, mapped to our metadata, with images uploaded to the public Storage bucket as compressed WebP. Seed script is repeatable (upsert by `slug`).
- `GET /api/v1/exercises` with `q`, `muscle`, `equipment`, `pattern`, pagination; `GET /api/v1/exercises/{id}`.
- `/library/exercises`: search, muscle chips, equipment filter; list with image, name, primary muscles, equipment badges. Infinite scroll or "Load more".
- `/library/exercises/[id]`: image, description, instructions steps, common mistakes, muscles (primary/secondary), equipment, tracking type.
- Search matches name and aliases, case- and accent-insensitive.

## Out of scope

Custom exercises (07), favourites, videos.

## Acceptance criteria

- [ ] AC1: Seeding twice leaves the same number of rows; every seeded row has at least one primary muscle, a pattern, equipment and a tracking type.
- [ ] AC2: Searching "bench" finds Bench Press; searching an alias finds the exercise.
- [ ] AC3: Filtering by muscle and equipment combines with AND; clearing filters restores the list.
- [ ] AC4: The list endpoint does a constant number of queries regardless of page size.
- [ ] AC5: Exercise details show all metadata; a missing image shows a placeholder with the name.
- [ ] AC6: Mobile list items are at least 56px tall; desktop shows a grid with the filters in a side column.
- [ ] AC7: Data license of the source dataset is recorded in `src/server/db/seed/README.md`.

## Depends on

05.

## Open questions

- Which dataset (free-exercise-db, wger or another) and its license terms for images?
- Catalog language for names: English only now?
