# Exercise catalog seed

`exercises.json` holds the system exercise catalog: 210 gym strength exercises with English and Ukrainian text.

## Source and license

- **Dataset:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db), pinned at commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` (2026-09-27).
- **License:** The Unlicense (public domain), for the JSON data.
- **What we take:** the list of exercises, their muscles, equipment, level and mechanic, and the folder name (`sourceId`) used to find the photos.
- **What we write ourselves:** every name, alias, description, instruction step and common mistake, in both languages, plus `movementPattern`, `laterality`, `popularity` and the tracking type. Nothing of the dataset's English text is copied.

## Images: rights are unclear

free-exercise-db took its photos from [wrkout/exercises.json](https://github.com/wrkout/exercises.json). Its `CONTRIBUTING.md` says the images "have been scraped off the internet", the author does "not own the copyright", and he advises "against using them in commercial projects". A reverse image search in that repository's issue #305 traced part of them to bodybuilding.com, whose terms reserve copyright.

The lead decided on 2026-11-10 to use the photos anyway (`DECISIONS.md`, "Catalog photos with unclear rights"). Revisit before a public launch. Replacing them means uploading other files to the same Storage keys; no code changes.

## Mapping

| Dataset | Ours |
| --- | --- |
| `category` `strength`, `powerlifting` | included; other categories excluded |
| `equipment` `barbell`, `dumbbell`, `cable`, `machine`, `kettlebells`, `bands`, `e-z curl bar`, `body only` | `barbell`, `dumbbell`, `cable`, `machine`, `kettlebell`, `band`, `ez_bar`, `bodyweight` |
| `equipment` `medicine ball`, `exercise ball`, `other` | `other` |
| `lower back`, `middle back` | `lower_back`, `middle_back`; other muscles keep their names |
| `level` `beginner` / `intermediate` / `expert` | `difficulty` 1 / 2 / 3 |

Some entries override the dataset where it is wrong or too coarse (for example dips are `bodyweight`, the deadlift lists hamstrings and glutes as primary).

## Scripts

```bash
pnpm db:seed        # upsert exercises and translations; safe to run any number of times
pnpm db:seed:media  # download, convert and upload the photos to Storage (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
```

- `db:seed` upserts by `slug` and `(exercise_id, locale)`. CI runs it after `db:migrate`.
- `db:seed:media` skips frames already in Storage; `--force` uploads them again. Each frame is stored as `system/<slug>/<0|1>-<thumb|full>.webp`, 160px and 800px wide.
- Removing or renaming an exercise in `exercises.json` does not delete the old row, because workouts may reference it. That needs a soft delete step, which no spec asks for yet.
