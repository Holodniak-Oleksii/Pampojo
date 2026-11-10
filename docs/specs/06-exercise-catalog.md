# 06. Exercise catalog

## Goal

A browsable catalog of system exercises with rich metadata, which every later feature (builder, substitution, AI) relies on. Content is in English and Ukrainian, like the UI.

## User stories

- As a user, I want to find an exercise by name in my language or in English, so I can learn it or add it to a workout later.
- As a user, I want to narrow the catalog by muscle and by the equipment I have, so I only see what I can do.
- As a user, I want to see how an exercise is done (start and end position, steps, common mistakes), so I do it safely.

## Scope

### Constants

In `src/shared/constants`, as `as const` arrays (order matters, it is the display order):

- `MUSCLE_GROUPS` (17, the free-exercise-db muscles): `chest`, `shoulders`, `triceps`, `biceps`, `forearms`, `lats`, `middle_back`, `traps`, `lower_back`, `abdominals`, `glutes`, `quadriceps`, `hamstrings`, `adductors`, `abductors`, `calves`, `neck`.
- `EQUIPMENT`: `barbell`, `ez_bar`, `dumbbell`, `kettlebell`, `cable`, `machine`, `bodyweight`, `band`, `other`.
- `MOVEMENT_PATTERN`: `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `squat`, `hinge`, `lunge`, `carry`, `core`, `isolation`.
- `MECHANIC`: `compound`, `isolation`.
- `LATERALITY`: `bilateral`, `unilateral`.
- `TRACKING_TYPE`: `weight_reps`, `reps`, `time`, `distance`.

### Seed

- Source: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense). Before seeding, check where its images come from and record the result with the license in `src/server/db/seed/README.md`. If the image origin is doubtful, stop and ask the lead.
- About 200 strength exercises for a gym: barbell, dumbbell, cable, machine, bodyweight, kettlebell, band. No stretching, olympic lifts, strongman or cardio machines.
- The dataset has no description, common mistakes, aliases, movement pattern or laterality. The agent writes them into the seed data. It also maps muscles and equipment to our constants and sets `popularity` (1–100, staples like bench press, squat and deadlift highest).
- Every text field exists in `en` and `uk`. The agent translates; the lead reviews the seed data in the PR.
- Images: the two frames per exercise (start and end position), converted to WebP in two sizes, thumbnail 160px and full 800px wide, uploaded to the public Storage bucket `exercise-media`.
- `pnpm db:seed` is repeatable: upsert by `slug`, translations by `(exerciseId, locale)`, images overwritten by key.

### API

- `GET /api/v1/exercises`: system exercises plus the caller's own (none exist before spec 07). Parameters: `q`, `muscle` (repeatable), `equipment` (repeatable), `pattern`, `cursor`. Page size 30. Text in the request locale (the `lang` cookie).
- `GET /api/v1/exercises/{id}`: details in the request locale. An unknown id, or another user's exercise, is a 404.

### Filtering, search and order

- Muscle chips: several can be on. An exercise matches if any selected muscle is among its primary muscles. Secondary muscles do not count.
- Equipment: several can be on. An exercise matches if any of its equipment is selected.
- Muscles, equipment and search combine with AND.
- Search matches name and aliases in both languages (so «жим» works in the English UI), ignoring case and diacritics. It starts 300ms after the last keystroke.
- Without search the list is grouped by muscle in `MUSCLE_GROUPS` order. An exercise appears once, in the section of its first primary muscle; with muscle chips on, in the section of its first primary muscle that is selected. Inside a section: `popularity` descending, then name.
- With search the list is flat, ordered: name starts with the query, then name contains it, then alias match; ties by `popularity`, then name.
- Search and filters live in the URL (`?q=&muscle=&equipment=`), so Back from the details page restores the list.

### `/library/exercises`

- Replaces the spec 05 placeholder; the Workouts / Exercises tabs stay.
- Search field, a horizontally scrolling row of muscle chips, and an Equipment button that opens a checkbox list; the button shows the number selected.
- List item: thumbnail (first frame), name, primary muscles, equipment badges. Section headers show the muscle name.
- Infinite scroll loads the next 30; a "Show more" button under the list does the same, as a fallback.

### `/library/exercises/[id]`

- Frames: the start and end frames alternate every second. With `prefers-reduced-motion` the start frame stays, and a tap switches start and end.
- Name, description, numbered instruction steps, common mistakes.
- Metadata: primary and secondary muscles, equipment, movement pattern, mechanic, laterality, tracking type, level (1–3).
- Back link to the list.

### Also in this spec

- `/today` and `/profile` no longer throw `PROFILE_NOT_FOUND` when the layout gate is redirecting a user without a profile. The pages call `redirect('/onboarding')` themselves when the profile is missing. Next.js renders layout and page in parallel, so the throw was logged as a server error on every visit before onboarding.

## Out of scope

- Custom exercises, the "Mine" badge and filter (07).
- Offline catalog and image caching (15, 16).
- Favourites, videos, a pattern filter in the UI (the API supports it for later specs).

## UX

- **Mobile:** one column. Search, chip row, Equipment button, then the list. List items at least 56px tall.
- **Desktop (≥ 1024px):** filters in a side column (search, muscle chips wrapped, equipment checkboxes) and a grid of cards on the right.
- **Details, mobile:** one column, frames on top. **Desktop:** two columns, frames left, information right.
- **Loading:** skeleton rows or cards; the details page has a skeleton too.
- **Error:** inline message with Retry.
- **No results:** message with a Clear filters button that clears search, chips and equipment.
- **Missing image:** a placeholder tile with the exercise name, in the list and in details.
- **Offline (before spec 16):** data already on screen stays. A new request shows the existing `OfflineNotice`.
- **Not found:** `/library/exercises/<unknown or foreign id>` shows the not-found state with a link back to the catalog.

## Data and API

Changes to `docs/tech/DATA_MODEL.md`, approved by the lead:

- `exercise` loses `name`, `aliases`, `description`, `instructions`, `commonMistakes`; they move to `exercise_translation`.
- `exercise` gains `popularity` (smallint, null for own exercises).
- New `exercise_translation`: `exerciseId`, `locale` (`en`, `uk`), `name`, `aliases`, `description`, `instructions`, `commonMistakes`; primary key `(exerciseId, locale)`.
- When a row for the request locale is missing, the other locale is used. Own exercises (07) have one row, shown in every locale.
- `media` holds the two frames, each in two sizes. Scratch sets the exact shape.

API: `docs/tech/API.md`, rows for spec 06. The list endpoint returns the section muscle for each item when there is no `q`.

## Copy

| Where | en | uk |
| --- | --- | --- |
| Meta titles | Exercises · Pampojo / {{name}} · Pampojo | Вправи · Pampojo / {{name}} · Pampojo |
| Search placeholder | Search exercises | Пошук вправ |
| Equipment button | Equipment / Equipment ({{count}}) | Обладнання / Обладнання ({{count}}) |
| Show more | Show more | Показати ще |
| No results | No exercises found / Try another search or clear the filters. / Clear filters | Вправ не знайдено / Спробуй інший запит або скинь фільтри. / Скинути фільтри |
| Error | Couldn't load exercises. / Retry | Не вдалося завантажити вправи. / Спробувати ще |
| Not found | Exercise not found / Back to exercises | Вправу не знайдено / Назад до вправ |
| Details back link | Exercises | Вправи |
| Details sections | How to do it / Common mistakes / Muscles / Primary / Secondary / Equipment / Movement / Type / Sides / Tracking / Level | Як виконувати / Типові помилки / М'язи / Основні / Допоміжні / Обладнання / Рух / Тип / Сторони / Запис / Рівень |
| Frame labels (accessible) | Start position / End position | Початкова позиція / Кінцева позиція |
| Muscles | Chest / Shoulders / Triceps / Biceps / Forearms / Lats / Middle back / Traps / Lower back / Abs / Glutes / Quads / Hamstrings / Adductors / Abductors / Calves / Neck | Груди / Плечі / Трицепс / Біцепс / Передпліччя / Широкі м'язи спини / Середина спини / Трапеції / Поперек / Прес / Сідниці / Квадрицепс / Задня поверхня стегна / Привідні / Відвідні / Ікри / Шия |
| Equipment | Barbell / EZ bar / Dumbbell / Kettlebell / Cable / Machine / Bodyweight / Band / Other | Штанга / EZ-гриф / Гантелі / Гиря / Блок / Тренажер / Власна вага / Резина / Інше |
| Movement | Horizontal push / Vertical push / Horizontal pull / Vertical pull / Squat / Hinge / Lunge / Carry / Core / Isolation | Горизонтальний жим / Вертикальний жим / Горизонтальна тяга / Вертикальна тяга / Присід / Нахил / Випад / Перенесення / Кор / Ізоляція |
| Mechanic | Compound / Isolation | Базова / Ізолююча |
| Laterality | Both sides / One side at a time | Дві сторони / По одній стороні |
| Tracking | Weight × reps / Reps / Time / Distance | Вага × повтори / Повтори / Час / Дистанція |
| Level | Beginner / Intermediate / Advanced | Початковий / Середній / Просунутий |

## Acceptance criteria

- [ ] AC1: Seeding twice leaves the same number of `exercise` and `exercise_translation` rows. Every seeded exercise has at least one primary muscle, a pattern, equipment, a tracking type, a popularity, two frames, and an `en` and a `uk` translation with name, description, at least one step and at least one common mistake.
- [ ] AC2: Searching "bench" lists Bench Press first; searching an alias finds the exercise; «жим» finds Bench Press in the English UI; case and diacritics do not matter.
- [ ] AC3: Two muscle chips show exercises whose primary muscles include either one; secondary muscles do not count. Equipment combines with muscles and search by AND. Clear filters restores the full list.
- [ ] AC4: The list endpoint runs a constant number of queries regardless of page size.
- [ ] AC5: Without search, the list is grouped by muscle in `MUSCLE_GROUPS` order, each exercise once, sorted by popularity inside a section. With search, the list is flat and ordered by relevance.
- [ ] AC6: Scrolling to the end loads the next 30 until the catalog ends; "Show more" does the same.
- [ ] AC7: Reloading a filtered URL, or going Back from details, shows the same search and filters.
- [ ] AC8: Details show the alternating frames (static with reduced motion, tap switches), steps, mistakes and all metadata from Scope. A missing image shows a placeholder with the name.
- [ ] AC9: In the Ukrainian UI all catalog text is Ukrainian; in English, English.
- [ ] AC10: An unknown id, or another user's exercise, returns 404 from the API and shows the not-found state.
- [ ] AC11: Mobile list items are at least 56px tall; desktop shows a grid with the filters in a side column. Both work at 390px and 1440px without horizontal scroll.
- [ ] AC12: Loading, error with Retry, no results and offline states render as described in UX.
- [ ] AC13: The data license and image origin are recorded in `src/server/db/seed/README.md`.
- [ ] AC14: A signed-in user without a profile who opens `/today` or `/profile` lands on `/onboarding`, and the server logs no `PROFILE_NOT_FOUND` error.

## Depends on

05.

## Open questions

None.
