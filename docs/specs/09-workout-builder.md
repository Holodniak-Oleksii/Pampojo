# 09. Workout builder

## Goal

Users create reusable workouts: an ordered list of exercises with optional targets. Sessions (10), the plan (11) and sharing (19) build on them.

## User stories

- As a lifter, I want to save my "Push Day" with its exercises in order, so that I do not rebuild it every week.
- As a lifter, I want targets per exercise (sets, reps, weight), so that the session knows what I plan to do.
- As a runner or someone doing planks, I want time and distance targets, so that non-weight exercises fit too.
- As a user, I want to copy a workout and change it, so that variations are quick.

## Scope

### Workouts list (`/library/workouts`)

- Each card shows:
  - the name;
  - the meta line "5 вправ" (plural);
  - up to 3 primary muscle groups, the most frequent first, each with its family diamond.
- The list is sorted by `updatedAt`, newest first. There is no search; the limit is 200 workouts.
- A "Створити тренування" button. A "…" menu on each card holds "Дублювати" and "Видалити".
- The empty state leads to Create.
- A workout left with 0 exercises (its only own exercise was deleted, spec 07) shows "0 вправ" and the tag "Додай вправи".

### Editor (`/library/workouts/new` and `/library/workouts/[id]`)

- **Create** opens the editor with a new client UUID. Nothing reaches the server until "Зберегти" (`PUT /api/v1/workouts/{id}`). Leaving an unsaved new workout leaves nothing behind.
- **Fields:**
  - name: required, 1–80 characters, not unique;
  - description: optional, up to 500 characters.
- **Exercises:** 1–30 per workout. The same exercise may appear more than once.
- **Targets per exercise.** All targets are optional, and an exercise may carry only a note. The fields follow the exercise tracking type:

  | Tracking | Fields |
  | --- | --- |
  | `weight_reps` | sets, reps range, weight |
  | `reps` | sets, reps range |
  | `time` | sets, duration |
  | `distance` | sets, distance |

  - Every exercise also has a note, up to 300 characters.
  - For unilateral exercises, reps and duration are per side, with the hint "на кожну сторону".
- **Defaults** when an exercise is added. Weight is never prefilled. Every field can be cleared.
  - `weight_reps`: 3 × 8–12;
  - `reps`: 3 × 10–15;
  - `time`: 3 × 30 s;
  - `distance`: 1 set, no distance.
- **Ranges:**
  - sets 1–20;
  - reps 1–100, min ≤ max, and equal values mean a fixed target;
  - weight 0–500 kg in steps of 0.25;
  - duration 5 s–60 min;
  - distance 10 m–100 km, entered and shown in km or m.
- **No rest target.** A workout exercise has no rest field (lead, 2026-11-14). How the session rest timer gets its length is decided in spec 10.
- **Exercise row:**
  - each row shows a drag handle, the thumbnail, the name, the target summary (for example "3 × 8–12, 80 кг") and the note, if any, on a third line;
  - tapping the row opens the exercise sheet (bottom on mobile, right side on desktop) with the target fields, the note, "Прибрати з тренування" and "Готово";
  - rows carry no chevron and no move buttons. Reordering is by drag only: touch or mouse on the handle, and the keyboard on the focused handle (Space, arrows, Space) with screen-reader announcements from `@dnd-kit`.
- **Mobile picker:**
  - "Додати вправи" opens a full-screen sheet with the catalog search and the catalog filter sheet (spec 28 layout);
  - tapping a row selects it, showing a check and its pick number;
  - a sticky "Додати 3 вправи" button appends the picks in pick order.
- **Desktop:**
  - the catalog column (380px) is on the left, with search, the "Мої" and muscle chips and "Усі фільтри";
  - the workout is on the right: name and description side by side, then the exercise rows with the target on the right;
  - a "+" on a catalog row appends the exercise;
  - dragging a catalog row into the workout inserts it at the drop position, shown by an accent line with a diamond;
  - rows in the workout are reordered by drag.
- **Saving:**
  - "Зберегти" is disabled while the name is empty or there are no exercises, and a hint says why;
  - the whole workout and its exercises are saved in one transaction;
  - the last save wins: there is no conflict check between tabs or devices.
- **Unsaved changes:** apply the "Discard-changes prompt" decision (2026-11-11):
  - the dialog appears on the editor's Cancel and its back link;
  - reload and tab close use `beforeunload`.
- **Duplicate:**
  - creates "<name> (копія)" with a new client id through `PUT`;
  - opens the copy in the editor.
- **Delete:**
  - confirmation: «Видалити «Push Day»? Минулі тренування залишаться в історії.»;
  - the workout is soft deleted, and past sessions keep their snapshot.
- **Offline:** the list and the editor open from the TanStack Query cache, read-only. Create, Save, Duplicate and Delete are disabled with "Потрібен інтернет" (`OFFLINE.md`).
- **Drag and drop** uses `@dnd-kit/core` and `@dnd-kit/sortable` for touch, mouse, keyboard and screen-reader announcements.

### Today

Once the user has at least one workout, the spec 28 Today empty state changes:
- the first two steps show as done, with filled accent diamonds;
- the main button becomes "Твої тренування", linking to `/library/workouts`.

Specs 11 and 12 replace this with the plan.

### Own exercise deletion (spec 07 decision)

Deleting an own exercise removes it from every workout:
- the confirmation dialog lists those workouts with links;
- a workout that drops to 0 exercises stays, and can only be saved again with an exercise.

## Out of scope

- An estimated duration. The session timer (10) measures real time, and progress (13) reports it.
- Supersets and circuits (later).
- Sharing, export and import (19).
- AI generation (21).
- Starting a session from a workout (10).
- Scheduling (11).
- "Same as last time" weight. The session (10) shows the previous result from history.

## UX

- **States:**
  - loading: list and editor skeletons;
  - list empty: the empty state with Create;
  - error: "Не вдалося завантажити тренування." with Retry;
  - offline: read-only;
  - save failure: a toast, and the edits stay.
  - An unknown or another user's id shows "Тренування не знайдено" with a link back to the list.
- **Mobile (390px):** a single column. The editor's save bar sits at the end of the page, not sticky, as decided for `/profile/gym`.
- **Desktop (1440px):** two columns in the editor, and the list as a grid of cards.

## Design

Canvas: <https://claude.ai/artifact/Bjxi1PbaFZvPq1eeUGfjEp> (private), inside `docs/tech/VISUAL_LANGUAGE.md`. Every board uses real catalog photos and uk copy.

| Board | Screen and state |
| --- | --- |
| Редактор, моб | Editor, filled |
| Редактор, моб, аркуш вправи | Exercise sheet over the editor |
| Пікер вправ, моб | Full-screen picker with 3 picks |
| Редактор, моб, офлайн | Editor read-only offline |
| Незбережені зміни, моб | Discard dialog |
| Тренування не знайдено, моб | Unknown or another user's id |
| Список, моб | List, filled, including a "0 вправ" workout |
| Список, моб, порожній | List empty |
| Список, моб, завантаження | List loading |
| Список, моб, помилка | List error with retry |
| Видалення, моб | "…" menu and the delete dialog |
| Today з тренуваннями, моб | Today with a workout and no plan |
| Редактор, десктоп 1440 | Editor with the catalog column and a drag in progress |
| Список, десктоп 1440 | List as a 3-column card grid |

### Library tabs row

- **Mobile:** an accent "+" icon button opposite the tabs on the Workouts tab, "Створити тренування", the same pattern as "Створити вправу" on the Exercises tab (spec 28).
- **Desktop:** a dark "Створити тренування" button with a plus, right of the tabs.

### List

- **Mobile:** one 6px card with 1px dividers. Each row has:
  - the first exercise's thumbnail (52px, 3px radius);
  - the name (16/700) and "N вправ" (muted);
  - up to 3 muscle groups, each with a 7px family diamond;
  - a "…" button (44px).
- **"0 вправ" row:** a dashed `--planned` square instead of the thumbnail, and a dark 4px "Додай вправи" tag.
- **Desktop:** a 3-column grid of 6px cards. Each card shows the name (18/800), "N вправ", up to 4 exercise thumbnails (56px), the muscles and the "…" button.
- **"…" menu:** a dropdown with "Дублювати" and "Видалити" (destructive).
- **Delete:** an alert dialog with a destructive "Видалити" and a secondary "Скасувати".
- **Empty:** the spec 28 empty state pattern, with:
  - the workout icon headline "Тренувань ще немає" and its line;
  - three numbered diamond steps (the first accent);
  - "Створити тренування", full width on mobile.
- **Loading:** a skeleton of 3 rows in the list card. The "+" is shown at 45% opacity.
- **Error:** a card with "Не вдалося завантажити тренування." and a secondary "Спробувати ще раз".

### Editor

- **Top:** a back link "← Тренування", then the "Назва" and "Опис" fields. These are standard inputs (15px), not a headline.
- **Desktop:** the name and description sit side by side, under a section heading "Тренування". There is no headline repeating the name.
- **"Вправи":** a heading and the count on the right. Desktop adds "Перетягни з каталогу або натисни +".
- **Exercise rows** in one 6px card. Each row has:
  - a drag handle (6 dots, `--planned`, 28×44px);
  - a 52px thumbnail;
  - the name (16/700);
  - the target summary (15/600, tabular);
  - the note (14, muted) when it exists.
- **Desktop rows:** the target is in a right-aligned column instead of under the name.
- **Mobile actions:** a secondary "Додати вправи" with a plus, then "Зберегти" (full width) and "Скасувати" (ghost) at the end of the page.
- **Desktop actions:** "Скасувати" and "Зберегти" are right-aligned.
- **Drag:**
  - the dragged item floats as a card with the soft shadow, tilted 1.5°;
  - the drop position is a 3px accent line with an accent diamond at its start;
  - on desktop the source catalog row dims to 40%.
- **Offline:** the inputs are disabled on a darker fill (`#E6E2DC`), and the rows have no handles. "Зберегти" is disabled, with "Потрібен інтернет" under it. The top bar pill is dark "Офлайн".

### Exercise sheet

- **Layout:** a bottom sheet (8px top radius, a grab bar, the soft shadow) over a 45% scrim. On desktop it is the same content in a right-side sheet.
- **Header:** a 56px thumbnail, the name (20/800), a "Як виконувати" link to the exercise details, and a close button.
- **Fields:** a two-column grid. "Підходи" and "Вага, кг" (by tracking type) come first, then "Повтори" from–to across both columns with the exact-number hint, then "Нотатка". Under them sits "Усі поля необовʼязкові."
- **Bottom:** "Прибрати з тренування" (destructive ghost) above a divider, then "Готово" (primary, full width).
- **Behaviour:** edits apply to the draft. Nothing is saved until "Зберегти".

### Picker (mobile)

- **Layout:** a full-screen dialog with the title "Додати вправи" and a close button.
- **Search and filters:** the catalog search and the filter button with its count (spec 28 layout).
- **Rows:** catalog sections with family diamonds. Each row is a toggle button (`aria-pressed`).
  - Unpicked: a 20px `--planned` outline diamond.
  - Picked: a 24px dark diamond with the pick number.
- **Bottom:** a sticky "Додати N вправи" bar, primary, above a `--border-strong` divider.

### Today with a workout

- The spec 28 Today card with the workout icon headline "Тренування готове" and "Лишилося поставити його в календар.".
- **Steps 1 and 2:** done, shown as accent diamonds with a check and muted text, with visually hidden "Виконано:".
- **Step 3:** a dark numbered diamond.
- **Button:** "Твої тренування", primary.

### Not found

A card with an icon, "Тренування не знайдено" (24/800), the line "Можливо, його видалили або посилання неправильне." and a "До тренувань" button.

## Data and API

- `docs/tech/DATA_MODEL.md` `workout_exercise` changes:
  - `targetSets` becomes nullable;
  - `restSec` is removed;
  - new `targetDistanceM int null`.
- `docs/tech/API.md`:
  - `GET /api/v1/workouts`, `GET/PUT/DELETE /api/v1/workouts/{id}`, with no `PATCH`;
  - `PUT` creates or replaces the workout with its full exercise list (client id, idempotent);
  - `DELETE` soft deletes, and repeating it returns the same result;
  - errors: `WORKOUT_NOT_FOUND` (404, also for another user's id), `WORKOUT_LIMIT_REACHED` (422 at 200), validation 400.
- Every query is scoped to the current user. Exercises referenced by a workout must be system exercises or the user's own, non-deleted ones; otherwise 400.

## Copy

| Key (en) | uk |
| --- | --- |
| Create workout | Створити тренування |
| {{count}} exercises | {{count}} вправа / вправи / вправ |
| Add exercises | Додай вправи (tag) / Додати вправи (button) |
| Add {{count}} exercises | Додати {{count}} вправу / вправи / вправ |
| Name | Назва |
| Description | Опис |
| Note | Нотатка |
| Sets, Reps, Weight, kg, Duration, Distance | Підходи, Повтори, Вага, кг, Тривалість, Дистанція |
| per side | на кожну сторону |
| For an exact number, enter the same value twice. | Для точної кількості впиши однакові числа. |
| All fields are optional. | Усі поля необовʼязкові. |
| Remove from workout | Прибрати з тренування |
| Done | Готово |
| Drag {{name}} | Перетягнути {{name}} |
| Catalog | Каталог |
| All filters | Усі фільтри |
| Drag from the catalog or press +. | Перетягни з каталогу або натисни +. |
| Actions for {{name}} | Дії для {{name}} |
| Build a workout once and repeat it every week. | Збери вправи в тренування один раз і повторюй його щотижня. |
| Name the workout / Add exercises from the catalog / Set sets, reps and weight | Назви тренування / Додай вправи з каталогу / Задай підходи, повтори й вагу |
| Workout ready | Тренування готове |
| Now put it on your calendar. | Лишилося поставити його в календар. |
| It may have been deleted, or the link is wrong. | Можливо, його видалили або посилання неправильне. |
| Back to workouts | До тренувань |
| Save | Зберегти |
| Add a name and at least one exercise to save. | Додай назву й хоча б одну вправу, щоб зберегти. |
| Duplicate | Дублювати |
| {{name}} (copy) | {{name}} (копія) |
| Delete "{{name}}"? Past workouts stay in your history. | Видалити «{{name}}»? Минулі тренування залишаться в історії. |
| Your workouts | Твої тренування |
| Workout not found | Тренування не знайдено |
| Couldn't load workouts. | Не вдалося завантажити тренування. |
| Couldn't save the workout. Try again. | Не вдалося зберегти тренування. Спробуй ще раз. |

The empty state text, title and offline hint reuse existing keys.

## Acceptance criteria

- [ ] AC1: Create a workout with three exercises, save and reopen: the order, targets and notes are preserved. A new workout that is left without saving does not appear in the list.
- [ ] AC2: Reorder by drag on the handle: touch on mobile, mouse on desktop, and the keyboard (Space, arrows, Space) with a screen-reader announcement. The saved order matches.
- [ ] AC3: Tapping an exercise row opens its sheet. The target fields match the tracking type, per the Scope table: no weight field for a `time` exercise, a distance field for `distance`, and no rest field anywhere. Defaults per type are applied on add, weight is empty, and every target can be cleared and saved empty.
- [ ] AC4: The same `PUT` sent twice creates one workout. `DELETE` twice leaves one soft-deleted workout and no error.
- [ ] AC5: Another user's workout id returns 404 `WORKOUT_NOT_FOUND` on `GET`, `PUT` and `DELETE`. A `PUT` referencing another user's own exercise returns 400.
- [ ] AC6: The list shows the name, the exercise count and up to 3 primary muscle groups, newest first. The empty state leads to Create.
- [ ] AC7: Leaving the editor with unsaved changes through its Cancel or back link asks for confirmation, and reload uses `beforeunload`.
- [ ] AC8: On desktop, dragging a catalog row into the workout inserts it at the drop position, and "+" appends it.
- [ ] AC9: On mobile, picking three exercises in the picker and tapping "Додати 3 вправи" appends them in pick order. The same exercise can be added twice.
- [ ] AC10: Save is disabled with the hint while the name is empty or there are no exercises. Limits are enforced by the client and the server: name 80, description 500, note 300, 30 exercises, 200 workouts (422 `WORKOUT_LIMIT_REACHED`), and the target ranges in Scope (400).
- [ ] AC11: Duplicate creates "<name> (копія)" and opens it. Delete asks with the copy above and removes the workout from the list.
- [ ] AC12: Offline, the cached list and editor open read-only, and Create, Save, Duplicate and Delete are disabled with "Потрібен інтернет".
- [ ] AC13: Deleting an own exercise used in a workout lists that workout in the confirmation. After confirming, the workout no longer contains it. If it was the only exercise, the workout shows "0 вправ" and "Додай вправи".
- [ ] AC14: With at least one workout, Today shows the first two steps as done and the "Твої тренування" button.
- [ ] AC15: Mobile (390px) and desktop (1440px), in en and uk, have no horizontal scroll on the list and the editor.

## Depends on

06, 07, 08, 28.

## Open questions

None.
