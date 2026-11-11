# 07. Custom exercises

## Goal

Users can add exercises the catalog lacks, with the same metadata and photos, so they work in workouts, substitution and AI later.

## User stories

- As a user, I want to add an exercise my gym has but the catalog lacks, so I can log it like any other.
- As a user, I want to start from a catalog exercise and adjust it, so I do not type everything again.
- As a user, I want to add photos of the movement, so I remember how my variant looks.
- As a user, I want to edit or delete my exercises, and never see other people's.

## Scope

### Own exercises

- An own exercise has `ownerId = user`. Only its owner sees it: in lists, in search and by id.
- A user has at most 300 own exercises (deleted ones do not count).
- The name is unique among the user's own non-deleted exercises, ignoring case and diacritics (`normalizeSearch`). It may match a system exercise.
- The text (name, description, steps, mistakes) is stored in one translation row, in the UI language at creation. It is shown in both languages. Editing updates that row.
- System exercises cannot be edited or deleted.

### Form

Fields (`*` required):

| Field | Rule |
| --- | --- |
| Name* | 1–80 characters |
| Primary muscles* | 1 or more, from `MUSCLE_GROUPS` |
| Secondary muscles | any, from `MUSCLE_GROUPS`, not repeating a primary one |
| Equipment* | 1 or more, from `EQUIPMENT` (`bodyweight` allowed) |
| Tracking type* | from `TRACKING_TYPE`; default `weight_reps` |
| Movement pattern | optional, from `MOVEMENT_PATTERN` |
| Type (mechanic) | optional |
| Sides (laterality) | optional |
| Description | optional, up to 500 characters |
| Steps | 0–10 items, each 1–200 characters; add, remove, move up and down |
| Common mistakes | 0–5 items, each 1–200 characters; add, remove |
| Photos | 0–4 frames (see below) |

No aliases, level or popularity for own exercises.

### Photos

- Up to 4 frames. The form shows two empty slots, "Start position" and "End position"; "Add frame" adds a slot up to 4.
- JPEG, PNG or WebP; the original file is at most 5 MB. A bigger or other file is rejected in the browser before upload and again on the server.
- The browser scales the image down to 1600px on the long side and compresses it before upload, so requests stay under the hosting limit.
- The server converts each frame to WebP at 160px and 800px wide, like the catalog.
- Frames can be moved up and down and deleted.
- Files live in a private Storage bucket. The API returns signed URLs valid for 1 hour.
- A file is removed from Storage when its frame or its exercise is deleted.
- Display uses the spec 06 behaviour, generalised to any number of frames: frames cycle in order every second on the details page and on card hover. With reduced motion a tap shows the next frame. One frame is static; no frames shows the placeholder.

### Duplicate as my own

- A "Duplicate as my own" button on a system exercise's details page opens the create form, prefilled with all its fields and photos. The text is in the current UI language.
- Saving creates a separate own exercise with `sourceExerciseId` set to the system exercise, and copies the photos into the private bucket.

### Catalog changes (spec 06)

- A "Create exercise" button next to the filters.
- A "Mine" chip, first in the chip row. It shows own exercises only and combines with the other filters (AND). In the URL it is `?mine=1`.
- Own exercises sort together with system ones (own have no popularity, so they come after system exercises in a section, then by name). Cards and rows show a "Mine" badge.
- With "Mine" on and no own exercises: an empty state with "Create exercise".

### Details page (spec 06)

- Own exercise: "Edit" and "Delete" buttons.
- System exercise: "Duplicate as my own".

### Delete

- Delete asks for confirmation in a dialog.
- After confirmation the exercise is soft deleted (`deletedAt`, so offline sync gets a tombstone later). It disappears from the catalog, search and by id (404), and its photo files are removed.
- Rule for later specs: when the exercise is used, the dialog lists the workouts and the sessions in history that use it, with links. After confirmation it is removed from them too. Specs 09 and 10 add these lists and the removal; spec 07 has no workouts or sessions yet.

### Online only

Creating, editing, duplicating and deleting need a connection. Offline, these buttons are disabled with the hint "Needs internet", following `docs/tech/OFFLINE.md`. Offline editing rules for later belong to spec 17.

## Out of scope

- The "used in" lists and removal from workouts (09) and sessions (10).
- Offline create and edit (17).
- Sharing own exercises with a workout (19).
- AI tagging (23), voice creation and generated frames (24).
- Translating own exercises into the other language.

## UX

- **Routes:** `/library/exercises/new` (with `?from=<system exercise id>` when duplicating) and `/library/exercises/[id]/edit`. Both are full pages inside the shell.
- **Form, mobile:** one column; the photo slots on top; the Save button stays at the bottom of the screen.
- **Form, desktop (≥ 1024px):** two columns, photos on the left and fields on the right; Save and Cancel under the fields.
- **Pickers:** muscles use the spec 06 chips (multi-select); equipment uses checkboxes.
- **Saving:** the Save button shows a spinner and is disabled. On success the app opens the exercise's details page and shows the toast "Exercise saved".
- **Field errors:** shown under the field; the page scrolls to the first one.
- **Upload state:** each slot shows the preview immediately, a spinner while it uploads, and an error with Retry if the upload fails.
- **Leaving with unsaved changes:** Cancel or Back asks "Discard changes?".
- **Loading:** the edit page shows a skeleton.
- **Not found:** edit of an unknown, foreign or system id shows the spec 06 not-found state.

## Data and API

`docs/tech/DATA_MODEL.md` and `docs/tech/API.md` are updated with this spec.

- **`exercise.media`.** For own exercises each frame also has an `id` (uuid). Own frames point to keys in the private bucket `exercise-user-media`, at `users/<userId>/<exerciseId>/<frameId>-<thumb|full>.webp`. System frames keep pointing to the public bucket.
- **`exercise_translation`.** One row per own exercise, in the creation locale.
- **API:**
  - `PUT /api/v1/exercises/{id}` creates an own exercise with a client-generated id. It is idempotent: the same request twice gives one row. The body may carry `sourceExerciseId` for a duplicate.
  - `PATCH /api/v1/exercises/{id}` updates only the given fields, including `frameOrder` (frame ids).
  - `DELETE /api/v1/exercises/{id}` soft deletes.
  - `PUT /api/v1/exercises/{id}/frames/{frameId}` uploads one frame (multipart, client-generated frame id, idempotent).
  - `DELETE /api/v1/exercises/{id}/frames/{frameId}` removes one frame.
  - `GET` endpoints return signed URLs for own frames.
- **Errors:**
  - 403 `EXERCISE_READ_ONLY` for a system exercise;
  - 404 for an unknown or foreign id;
  - 409 `EXERCISE_NAME_TAKEN`;
  - 422 `EXERCISE_LIMIT_REACHED` (300) and `FRAME_LIMIT_REACHED` (4);
  - 400 `IMAGE_INVALID` (type);
  - 413 `IMAGE_TOO_LARGE`.
- **Config:** the server writes to Storage with a dedicated Supabase secret key (`SUPABASE_SERVICE_ROLE_KEY`), set as a secret in Vercel (Production and Preview) and in GitHub Actions. It is read only under `src/server` (`server-only`).

## Copy

| Where | en | uk |
| --- | --- | --- |
| Catalog button | Create exercise | Створити вправу |
| Mine chip / badge | Mine | Мої / Моя |
| Mine empty state | No exercises of your own yet / Create one for anything the catalog misses. / Create exercise | Власних вправ ще немає / Створи вправу, якої бракує в каталозі. / Створити вправу |
| Page titles | New exercise / Edit exercise | Нова вправа / Редагування вправи |
| Meta titles | New exercise · Pampojo / Edit exercise · Pampojo | Нова вправа · Pampojo / Редагування вправи · Pampojo |
| Field labels | Name / Primary muscles / Secondary muscles / Equipment / Tracking / Movement / Type / Sides / Description / Steps / Common mistakes / Photos | Назва / Основні м'язи / Допоміжні м'язи / Обладнання / Запис / Рух / Тип / Сторони / Опис / Кроки / Типові помилки / Фото |
| Optional select | Not set | Не вказано |
| Step / mistake buttons | Add step / Add mistake / Move up / Move down / Remove | Додати крок / Додати помилку / Вище / Нижче / Видалити |
| Photo slots | Start position / End position / Frame {{n}} / Add frame / Add photo / Replace photo / Remove photo | Початкова позиція / Кінцева позиція / Кадр {{n}} / Додати кадр / Додати фото / Замінити фото / Видалити фото |
| Photo errors | Use a JPEG, PNG or WebP image. / The image must be 5 MB or smaller. / Upload failed. / Retry | Використай зображення JPEG, PNG або WebP. / Зображення має бути не більше 5 MB. / Не вдалося завантажити. / Спробувати ще |
| Field errors | Enter a name. / Up to 80 characters. / Pick at least one primary muscle. / Pick at least one piece of equipment. / You already have an exercise with this name. / Up to {{max}} characters. | Введи назву. / Не більше 80 символів. / Обери хоча б один основний м'яз. / Обери хоча б одне обладнання. / У тебе вже є вправа з такою назвою. / Не більше {{max}} символів. |
| Limit error | You've reached 300 exercises of your own. | Ти досяг ліміту в 300 власних вправ. |
| Form buttons | Save / Cancel | Зберегти / Скасувати |
| Saved toast | Exercise saved | Вправу збережено |
| Discard dialog | Discard changes? / Your changes will be lost. / Discard / Keep editing | Скасувати зміни? / Зміни буде втрачено. / Скасувати зміни / Продовжити редагування |
| Details buttons | Edit / Delete / Duplicate as my own | Редагувати / Видалити / Дублювати як мою |
| Delete dialog | Delete this exercise? / It will be removed from your catalog. This can't be undone. / Delete / Cancel | Видалити цю вправу? / Її буде прибрано з твого каталогу. Цю дію не можна скасувати. / Видалити / Скасувати |
| Deleted toast | Exercise deleted | Вправу видалено |
| Offline hint | Needs internet | Потрібен інтернет |
| Frame alt (any count) | {{name}}, frame {{n}} of {{total}} | {{name}}, кадр {{n}} з {{total}} |

## Acceptance criteria

- [ ] AC1: A user creates an exercise with only the required fields and finds it in the catalog, in its muscle section and under "Mine", with the "Mine" badge.
- [ ] AC2: Another user never sees it: not in lists, not in search, and `GET`, `PATCH`, `DELETE` and the frame endpoints by its id return 404.
- [ ] AC3: Editing changes only the fields sent. `PATCH` or `DELETE` on a system exercise returns 403 `EXERCISE_READ_ONLY`, and its details page shows no Edit or Delete.
- [ ] AC4: Uploads are checked:
  - a file over 5 MB, or one that is not JPEG/PNG/WebP, is rejected with the matching error, in the browser and by the API (413 / 400);
  - a valid photo is stored as WebP in two sizes and shown in details through a signed URL.
- [ ] AC5: Frames: up to 4 can be added; a 5th returns 422 `FRAME_LIMIT_REACHED`. They can be reordered and removed, and the order is kept after reload. On the details page and on card hover they cycle in that order every second; with reduced motion a tap shows the next frame.
- [ ] AC6: Deleting an exercise after confirming removes it from the catalog and search, makes its id return 404, and removes its photo files from Storage.
- [ ] AC7: "Duplicate as my own" on a system exercise opens a prefilled form. Saving creates a separate own exercise with `sourceExerciseId` set and its own copy of the photos; the system exercise is unchanged.
- [ ] AC8: A second own exercise with the same name (any case or diacritics) is rejected with 409 and "You already have an exercise with this name."; the same name as a system exercise is accepted.
- [ ] AC9: Creating the 301st own exercise returns 422 `EXERCISE_LIMIT_REACHED` and the form shows the limit error.
- [ ] AC10: Sending the same `PUT` (create or frame upload) twice gives one exercise or one frame.
- [ ] AC11: Offline, Create, Edit, Delete and Duplicate are disabled with "Needs internet".
- [ ] AC12: An exercise created in Ukrainian shows its Ukrainian name and text in the English UI too, and the reverse.
- [ ] AC13: The form works at 390px and 1440px without horizontal scroll, shows field errors under the fields, and asks before discarding changes.

## Depends on

06.

## Open questions

None.
