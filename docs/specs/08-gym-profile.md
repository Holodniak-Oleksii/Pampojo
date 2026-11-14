# 08. Gym equipment profile

## Goal

The user records once what equipment their gym has, so the catalog, substitution (18) and AI generation (21) suggest only exercises they can do there.

## User stories

- As a user, I want to tick the equipment my gym has, so the app knows what I can train with.
- As a user, I want to see only the exercises I can do in my gym, so I don't plan something I can't perform.
- As a user, I want to state what equipment my own exercise needs, so it is filtered like the catalog ones.

## Scope

### Gym equipment list

A new constant `GYM_EQUIPMENT` in `src/constants`, separate from the coarse `EQUIPMENT` of spec 06. Items are grouped; group and item order is the display order. 38 items:

| Group | Items (key) |
| --- | --- |
| Free weights `free_weights` | `barbell`, `ez_bar`, `trap_bar`, `dumbbells`, `kettlebells`, `weight_plates` |
| Benches and racks `benches_racks` | `flat_bench`, `adjustable_bench`, `decline_bench`, `squat_rack`, `preacher_bench`, `back_extension_bench`, `glute_ham_bench`, `pull_up_bar`, `dip_station`, `captains_chair` |
| Machines `machines` | `smith_machine`, `chest_press_machine`, `shoulder_press_machine`, `pec_deck`, `row_machine`, `t_bar_row`, `triceps_machine`, `biceps_machine`, `ab_crunch_machine`, `leg_press`, `hack_squat`, `leg_extension`, `leg_curl`, `hip_abduction_adduction`, `calf_raise_machine`, `reverse_hyper` |
| Cables `cables` | `cable_station`, `cable_crossover`, `pulldown_row_station` |
| Other `other` | `resistance_bands`, `ab_wheel`, `stability_ball` |

Bodyweight is not an item: exercises that need nothing are always available. There is no cardio group, because the catalog has no cardio exercises (spec 06).

### What an exercise needs

- Every exercise gets `gymEquipment`: a list of groups. Each group must be met, and any item inside a group meets it.
  - Goblet Squat: `[["dumbbells", "kettlebells"]]`.
  - Bench Press: `[["barbell"], ["flat_bench"], ["squat_rack"]]`.
  - Triceps Pushdown: `[["cable_station", "cable_crossover"]]`.
  - Push-Up: `[]`, always available.
- An exercise is available in a gym when every group has at least one item the gym has. This rule is one pure function, `isAvailableInGym(requirements, gymEquipment)`, in `src/shared/`, so spec 18 can reuse it offline.
- The coarse `equipment` field stays as it is. It still drives the catalog Equipment filter, the badges and the custom exercise form.

### Seed

- The agent tags all 210 seed exercises with `gymEquipment` in `exercises.json`. The lead reviews the tags in the PR.
- Tagging rule: the smallest setup a typical gym needs for the exercise as described. Use alternatives where either item works, for example dumbbells or kettlebells, or a cable station or a crossover.
- `pnpm db:seed` stays repeatable and updates the tags of existing rows.

### `/profile/gym`

- Page title "My gym". A short intro, then the groups. Each group has a header with one lucide icon, a "Select all" button, and the items as text toggle chips.
- When every item in a group is on, "Select all" becomes "Clear all".
- A note under the list: bodyweight exercises are always available.
- **First visit (nothing saved yet):** every item is on, and a "Save my gym" button saves the selection. After that first save the button is gone.
- **After the first save:** every toggle autosaves.
  - The chip changes at once. A PUT with the whole list goes out 400ms after the last change, so quick taps send one request.
  - "Select all" and "Clear all" count as one change.
  - A small status next to the title shows "Saving…" and then "Saved".
  - If a save fails, the chips go back to the last saved state and a toast says so.
- Any selection can be saved, including an empty one, which means bodyweight only.
- One gym per user.

### Nudge card

- A "Set up your gym" card on Today (under the greeting) and on Profile (above the rows) links to `/profile/gym`.
- It shows until the first save, then never again. It cannot be dismissed.

### Profile row

- `/profile` gets a "Gym equipment" row linking to `/profile/gym`. It shows "{{count}} of 38", or "Not set up" before the first save.

### Catalog filter (spec 06)

- An "Available in my gym" chip in the chip row, after "Mine". In the URL it is `?gym=1`.
- It is off on every fresh visit, like the other filters, and it combines with them by AND.
- The chip is hidden until the gym is saved. If the API gets `gym=1` and the user has no saved gym, it ignores the parameter.
- With the chip on, an exercise is listed only if `isAvailableInGym` is true for it. Exercises with `[]` always stay.

### Details page (spec 06)

- A "Gym equipment" metadata row lists the groups, with alternatives joined by "or", for example "Barbell · Flat bench · Squat rack" or "Dumbbells or Kettlebells".
- For an exercise with `[]` the row says "Nothing special".

### Custom exercise form (spec 07)

- A new optional field "Gym equipment needed" uses the same grouped chips without the "Select all" buttons. Each ticked item becomes its own group, so all of them are required. Alternatives exist only in the seed.
- Empty means always available. This covers every own exercise created before this spec.
- "Duplicate as my own" copies the system exercise's `gymEquipment` with its alternatives.
  - An alternatives group shows as one chip, for example "Dumbbells or Kettlebells", which can be removed but not edited.
  - Ticking further items adds single groups.

### Online only

Toggling chips, "Select all", "Clear all" and "Save my gym" need a connection. Offline they are disabled with the hint "Needs internet", following `docs/tech/OFFLINE.md`. Data already on screen stays visible.

## Out of scope

- Several gyms per user.
- Cardio equipment.
- Alternatives (OR groups) in the custom exercise form.
- Counting how many exercises the gym allows.
- Using the gym profile in substitution (18) and AI generation (21); they reuse `isAvailableInGym`.
- Local copy of the gym profile for offline use (16).
- AI tagging of own exercises' gym equipment (23).

## UX

- **Mobile:** one column; group headers with "Select all" on the right; the chips wrap. The "Save my gym" button stays at the bottom of the screen on the first visit.
- **Desktop (≥ 1024px):** the groups sit in two columns inside the content column, and "Save my gym" sits under the list.
- **Chips:** toggle buttons with `aria-pressed`, at least 44px tall. An on chip shows a check and the accent style.
- **Loading:** skeleton groups with skeleton chips.
- **Error loading:** inline message with Retry.
- **Nudge card:** the spec 01 card style with an icon, title, one line of text and a "Set up" button. Same on mobile and desktop.
- **Catalog:** the new chip follows the "Mine" chip style. With the chip on and nothing left, the spec 06 "No results" state shows, and Clear filters turns the chip off too.

## Data and API

`docs/tech/DATA_MODEL.md` and `docs/tech/API.md` are updated with this spec.

- **`exercise.gymEquipment`**: new `jsonb not null default '[]'`, a `string[][]` of `GYM_EQUIPMENT` keys. The migration is additive; existing own exercises get `[]`.
- **`gym_profile`**: `userId` PK → user, `equipment text[]` (`GYM_EQUIPMENT` keys, sorted, no duplicates), `createdAt`, `updatedAt`. A user without a row has not set up a gym. Every read and write is scoped to the current user.
- **`GET /api/v1/me/gym`** returns `{ equipment, updatedAt }`, or 404 `GYM_PROFILE_NOT_FOUND` before the first save.
- **`PUT /api/v1/me/gym`**:
  - takes `{ equipment: string[] }` and creates or replaces the row;
  - is idempotent;
  - accepts an empty list and drops duplicates;
  - rejects an unknown key with 400 (validation error).
- **`GET /api/v1/exercises`**:
  - gains `gym=1`;
  - list items and details gain `gymEquipment`.
- **`PUT` / `PATCH /api/v1/exercises/{id}`** accept an optional `gymEquipment` (groups of known keys, no empty groups). It is additive to the spec 07 contract.

## Copy

| Where | en | uk |
| --- | --- | --- |
| Page title / meta | My gym / My gym · Pampojo | Мій зал / Мій зал · Pampojo |
| Intro | Tick what your gym has. You can then hide exercises that need anything else. | Познач, що є у твоєму залі. Тоді зможеш приховати вправи, яким потрібне інше обладнання. |
| Bodyweight note | Bodyweight exercises are always available. | Вправи з власною вагою доступні завжди. |
| Group buttons | Select all / Clear all | Обрати все / Зняти все |
| First save button | Save my gym | Зберегти мій зал |
| Save status | Saving… / Saved | Зберігаю… / Збережено |
| First save toast | Gym saved | Зал збережено |
| Save error toast | Couldn't save your gym. Try again. | Не вдалося зберегти зал. Спробуй ще раз. |
| Load error | Couldn't load your gym. / Retry | Не вдалося завантажити зал. / Спробувати ще |
| Groups | Free weights / Benches and racks / Machines / Cables / Other | Вільна вага / Лавки та стійки / Тренажери / Блоки / Інше |
| Free weights | Barbell / EZ bar / Trap bar / Dumbbells / Kettlebells / Weight plates | Штанга / EZ-гриф / Трап-гриф / Гантелі / Гирі / Диски |
| Benches and racks | Flat bench / Adjustable bench / Decline bench / Squat rack / Preacher bench / Back extension bench / Glute-ham bench / Pull-up bar / Dip station / Captain's chair | Пряма лавка / Регульована лавка / Лавка з негативним нахилом / Стійки для присідань / Лавка Скотта / Лавка для гіперекстензії / Станок GHR / Турнік / Бруси / Станок для підйому ніг |
| Machines | Smith machine / Chest press / Shoulder press / Pec deck / Row machine / T-bar row / Triceps machine / Biceps machine / Ab crunch machine / Leg press / Hack squat / Leg extension / Leg curl / Hip abduction / adduction / Calf raise machine / Reverse hyper | Тренажер Сміта / Жим від грудей / Жим над головою / Батерфляй / Тренажер для тяги / Т-гриф / Тренажер для трицепса / Тренажер для біцепса / Тренажер для преса / Жим ногами / Гак-присід / Розгинання ніг / Згинання ніг / Відведення / зведення ніг / Тренажер для литок / Зворотна гіперекстензія |
| Cables | Cable station / Cable crossover / Pulldown and row station | Блочна станція / Кросовер / Станція верхньої й нижньої тяги |
| Other | Resistance bands / Ab wheel / Stability ball | Резинки / Ролик для преса / Фітбол |
| Nudge card | Set up your gym / Tick the equipment you have, and the app will show only exercises you can do. / Set up | Налаштуй свій зал / Познач обладнання, яке маєш, і застосунок покаже лише ті вправи, які ти можеш виконати. / Налаштувати |
| Profile row | Gym equipment / {{count}} of {{total}} / Not set up | Обладнання залу / {{count}} з {{total}} / Не налаштовано |
| Catalog chip | Available in my gym | Є в моєму залі |
| Details row | Gym equipment / or / Nothing special | Обладнання залу / або / Нічого особливого |
| Form field | Gym equipment needed / Leave empty if it needs nothing special. | Потрібне обладнання залу / Залиш порожнім, якщо нічого особливого не потрібно. |
| Offline hint | Needs internet | Потрібен інтернет |

## Acceptance criteria

- [ ] AC1: On the first visit to `/profile/gym` all 38 items are on and "Save my gym" is shown. Saving persists the selection and reopening shows it. Afterwards the button is gone.
- [ ] AC2: After the first save, toggling a chip, "Select all" or "Clear all" saves without a button, and a reload shows the latest state. Several quick taps send one request with the final selection.
- [ ] AC3: When an autosave fails, the chips return to the last saved state and the error toast shows.
- [ ] AC4: The nudge card shows on Today and Profile until the first save and never after it. The Profile row shows "Not set up" before the first save and "{{count}} of 38" after it.
- [ ] AC5: `GET /api/v1/me/gym` returns 404 `GYM_PROFILE_NOT_FOUND` before the first save. Sending the same `PUT` twice leaves one row. An empty list is accepted; an unknown key returns 400. A user never reads or changes another user's gym.
- [ ] AC6: Seeding twice gives the same rows. Every seed exercise has a valid `gymEquipment` with only known keys. Goblet Squat is `[["dumbbells","kettlebells"]]`, and Push-Up is `[]`.
- [ ] AC7: The "Available in my gym" chip is hidden until the gym is saved. With it on (`?gym=1`), it combines with search, muscles, Equipment and "Mine" by AND, and survives a reload. Clear filters turns it off.
- [ ] AC8: With a gym of only dumbbells and a flat bench, the chip shows Dumbbell Bench Press, Goblet Squat and Push-Up, and hides Bench Press and Lat Pulldown.
- [ ] AC9: `isAvailableInGym` has table-driven unit tests:
  - an empty requirement;
  - a single item, present and missing;
  - an alternatives group met by either item;
  - several groups with one missing;
  - an empty gym.
- [ ] AC10: The details page shows the "Gym equipment" row with alternatives joined by "or", or "Nothing special".
- [ ] AC11: An own exercise saved with ticked gym equipment is hidden by the chip when one of those items is missing. An own exercise without it, including any created before this spec, always shows. "Duplicate as my own" keeps the system exercise's alternatives.
- [ ] AC12: Chips and the "Select all" / "Clear all" buttons are buttons. Chips expose `aria-pressed`.
- [ ] AC13: Offline, the chips, "Select all", "Clear all" and "Save my gym" are disabled with "Needs internet".
- [ ] AC14: `/profile/gym`, the nudge card and the catalog chip work at 390px and 1440px without horizontal scroll.

## Depends on

06, 07.

## Open questions

None.
