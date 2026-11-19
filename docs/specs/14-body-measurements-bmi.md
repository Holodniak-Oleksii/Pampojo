# 14. Body measurements and BMI

## Goal

Users track weight and body measurements over time and see their BMI, tucked into Profile rather than the main screen. This spec also lets a user open the details of an exercise during a session, and fixes two mobile bugs.

## User stories

- As a user, I want to log my weight and body measurements with a date, so that I see how my body changes.
- As a user, I want to see my BMI and its category, so that I have a rough reference point.
- As a user, I want to see on a body figure where each measurement goes, so that I measure the right place.
- As a user, I want to edit or delete a wrong measurement, so that my history stays correct.
- As a lifter in a session, I want to open the current exercise's details, so that I remember how to do it.
- As a user, I want to see how many exercises a planned workout has past the visible thumbnails.
- As a mobile user, I want to see the search results in the exercise picker while the keyboard is open.

## Scope

### Measurements

- Types: 15 values of `MEASUREMENT_TYPE` (`src/constants/measurement.ts`), in this order:
  - weight;
  - girths: neck, shoulders, chest, waist, hips, left and right biceps, left and right forearm, left and right thigh, left and right calf;
  - body fat %.
- This spec adds 6 types: `neck`, `shoulders`, `forearm_left`, `forearm_right`, `calf_left`, `calf_right`.
- One measurement per type per day. A save for a type and a date that already have a measurement replaces its value. This is the spec 04 rule for weight, now for every type.
- Limits and units:

  | Type | Metric | Imperial | Step |
  | --- | --- | --- | --- |
  | Weight | 30–300 kg | 67–661 lb | 0.1 |
  | All girths | 10–250 cm | 4–98 in | 0.01 |
  | Body fat | 2–75 % | 2–75 % | 0.01 |

- The app stores weight in kg rounded to 0.1, and girths and body fat in cm and % rounded to 0.01. Conversion uses the spec 04 factors (1 in = 2.54 cm, 1 lb = 0.45359237 kg).
- Values show at most two decimals, with no trailing zeros after the first decimal ("104,25 см", "86,5 см", "88,0 см").
- The date is today in the profile time zone by default. A date in the future is rejected.
- Any measurement can be deleted, also the last weight. A delete is a soft delete.
- The Edit profile weight (spec 04) keeps its rule: it writes today's weight measurement.

### BMI

- BMI = latest weight in kg / (`profile.heightCm` / 100)², rounded to one decimal.
- WHO adult categories, the same for every age (users can be 16+):
  - below 18.5: underweight;
  - 18.5 to below 25: normal;
  - 25 to below 30: overweight;
  - 30 and above: obese.
- The scale shows BMI 15–40. A value outside it sits at the nearest end.
- The card says that BMI is a rough indicator for adults.
- Without a weight measurement, the card asks the user to add a weight. The height is always present after onboarding.

### Profile

- **BMI card:** the BMI value, the category label, the horizontal scale, a weight trend mini chart and the date of the latest weight.
  - The mini chart shows the weight measurements of the last 90 days, with no axes.
  - With fewer than 2 points in 90 days, the mini chart is hidden.
- **Body diagram:** a front silhouette in SVG under the "Measurements" heading. The figure follows `profile.sex`: one male and one female figure.
  - The figure shows a ring for each of the 13 girths. A label with the latest value connects to each ring.
  - The labels on the left of the figure are the user's right side and the central girths. The labels on the right are the user's left side.
  - Each label is a link to the history of its type. Its accessible name is the full type name and the value, for example "Біцепс, правий: 38,75 см".
  - A girth with no measurement shows "—" in its label.
  - The labels show the latest value only, with no change.
  - The silhouette is decorative (`aria-hidden`).
- **Weight and body fat rows:** two list rows under the figure. Each row shows the latest value, the change since the previous measurement and links to its history.
  - A type with no measurement shows "—" and no change.
  - A type with one measurement shows no change.
  - The change has an up or down arrow and a sign ("↓ −0,6 кг"). Its colour is neutral, because a good direction depends on the user's goal.
- **Add measurement sheet:** opens from the "Add measurement" button.
  - One date field at the top, then one value field per type, in the `MEASUREMENT_TYPE` order. Each field shows the latest value as its placeholder.
  - Only the filled fields are saved. "Save" is disabled while all value fields are empty.
  - Opened from a history page, the sheet focuses the field of that type.
  - The fields use the profile unit system.

### `/profile/measurements/[type]`

- An unknown `type` shows the not-found state with a link to Profile.
- The latest value, and the change over the selected range.
- A line chart with the spec 13 chart style and the range control "1M 3M 6M 1Y All". The default is 3M. Each range ends today.
- A range with no points shows "No measurements in this period." in the plot area.
- A list of all measurements of the type, the newest first: the date, the change since the previous measurement and the value.
- Tap a list row to open the edit sheet: the date and the value. "Delete" asks for confirmation.
- Editing the date to a day that already has a measurement of this type replaces that measurement.
- "Add measurement" opens the add sheet with focus on this type.

### Offline (before spec 16)

- The views that the user opened before come from the query cache.
- Other views show the existing `OfflineNotice`.
- "Add measurement", edit and delete are disabled offline, with "Потрібен інтернет". Spec 16 adds offline writes.

### Exercise details from a session

- In `/session/[id]`, a tap on the thumbnail or the name of the current exercise opens `/library/exercises/[id]` for that exercise.
- The thumbnail and the name are one link with an accessible name, for example "How to do Bench press".
- A tap on a row of the exercise list sheet keeps the spec 10 behaviour: it makes that exercise current.
- The session keeps running. The details page is the normal light page with no change. The session bar (spec 10) returns to the session with "Повернутися".
- The session opens on the same current exercise after the return.
- At session start, and when an exercise is added, the client prefetches the details of each session exercise into the query cache. Offline, the details come from this cache. If the cache has no details, the page shows the existing `OfflineNotice`.

### Also in this spec

- **Today thumbnails:** the planned card on `/today` shows the first 4 thumbnails only (`PlannedCard`).
  - Show as many 52px thumbnails as fit in one row of the card.
  - If some exercises do not fit, the last visible tile shows "+N" over a dimmed image. N is the number of exercises that have no visible thumbnail, the covered one included.
  - The row never wraps and never scrolls.
- **Exercise picker on mobile:** with the keyboard open, the picker sheet moves down and the keyboard covers the results.
  - On mobile, the `ExercisePicker` sheet has a fixed height: the full visible viewport. Its height does not depend on the number of results.
  - With the keyboard open, the header, the search field and the results stay in the visible area above the keyboard. The results list scrolls inside it.
  - This applies to the workout editor and to the session.

## Out of scope

- Body photos, body-fat calculators.
- Offline writes of measurements (16).
- Exercise image caching for offline (17).
- BMI-for-age for users under 18.
- Goals for measurements.

## UX

- **Mobile (390):** the BMI card and the measurements section sit on Profile above the settings rows. The history page is one column.
- **Desktop (1440):** two columns, see Design. The add and edit sheets are right side sheets, as Edit profile.
- **States:** loading (skeletons in the page geometry), error with retry, offline (cached view or notice), no weight (BMI card asks for weight), a type with no measurements, a range with no points, a type with one point.
- **Validation:** the spec 04 rule. Field errors appear after the first "Save", then update as the user types. Errors give the limit in the chosen unit.

## Design

Canvas: <https://claude.ai/artifact/6m4uBWRvjVfxt8DptQ8Pzc>. The lead approved all boards.

| Board | Screen and state |
| --- | --- |
| Профіль, виміри, чоловік, моб | `/profile`, mobile, male figure, data filled |
| Виміри, жінка, моб | Measurements section with the female figure |
| Додати вимір, моб | Add measurement sheet, one field filled |
| Змінити вимір, моб | Edit sheet and the delete dialog |
| Історія типу, моб | `/profile/measurements/waist`, range 3M |
| Стани | No weight, no girths, offline, loading |
| Профіль, темна тема, моб | Profile in the dark theme |
| Сьогодні, +N, моб | Today planned card with 8 exercises |
| Сесія, деталі вправи, моб | Session header with the details link |
| Пікер з клавіатурою, моб | Exercise picker with the keyboard open |
| Профіль, десктоп 1440 | `/profile`, desktop |

The boards show 7 girths for each figure. The 6 new types follow the same rules (see "Body diagram" below).

### Profile, mobile

- Order: page header, avatar and name, BMI card, "Measurements" heading with the dark "Add measurement" button (44px), body diagram, the weight and body fat rows, then the settings rows.
- The settings rows no longer have "Weight", because the BMI card and the weight row show it. "Age" and "Height" stay.
- **BMI card:** `--card`, 6px radius, 20px padding.
  - "ІМТ" (14px, muted) over the value (30/800) and the category (16/700) on one baseline.
  - On the right, the weight mini chart: 124×44px, an accent line and a filled accent diamond on the last point, with the caption "Вага, 90 днів" (13px, muted).
  - The scale: 4 segments of 6px height with 3px gaps, in widths 14 / 26 / 20 / 40 (BMI 15–18.5–25–30–40). The current segment is `--foreground`, the others `--border-strong`. A 14px accent diamond with a 2px `--card` border marks the value. The tick labels are "15 18,5 25 30 40" (12px, muted).
  - Under a 1px `--border` divider: "Вага 82,4 кг, зріст 183 см" (15/600) and "Оновлено 16 листопада. Приблизний показник для дорослих." (14px, muted).

### Body diagram

- A 358×400px block. The silhouette is 154×400px in the centre. The label columns are 98px wide on each side.
- **Figures:** `docs/wireframes/14-body-male.svg` and `docs/wireframes/14-body-female.svg`. The lead supplied the source images, and the agent traced them into SVG. Each file is one path with `fill="currentColor"` in a 200×520 viewBox.
  - Light theme fill: `--border-strong` (`#D9D3CB`). Dark theme fill: `#45403C`.
- **Rings:** each girth is a flat ellipse across the body part at its widest point. Its height is 13% of its width, from 2.2px to 5.5px.
  - The front half is solid: light `#6E6862`, dark `#B3ACA3`, 1.2px.
  - The back half is dashed (2 / 2.5): light `#AEA79F`, dark `#6E6862`, 0.9px.
  - Ring positions in the 200×520 viewBox: y, then the x span. The span is the width of the silhouette at that y. "Right" is the user's right side, which is on the viewer's left.

    | Girth | Male | Female |
    | --- | --- | --- |
    | Neck | 76: 82–118 | 74: 85–115 |
    | Shoulders (at the deltoids) | 160: 22–178 | 152: 35–164.5 |
    | Chest | 182: 56–144 | 174: 62–137 |
    | Biceps, right / left | 214: 14–44 / 156–186 | 182: 32–54 / 146–168 |
    | Waist | 250: 52–148 | 196: 65–135 |
    | Forearm, right / left | 256: 18–34 / 166–183 | 250: 24–37.5 / 162.5–175.6 |
    | Hips | 286: 48–152 | 270: 46–154 |
    | Thigh, right / left | 330: 49–93 / 107–152 | 320: 51–94 / 105–149 |
    | Calf, right / left | 398: 52–85 / 115–148 | 394: 57–88 / 112–143 |
- **Labels:** a chip on `--card` with a 4px radius and 4×8px padding. The short type name is on top (11px, muted), and the value is under it (13/700). Neither line wraps.
  - The chip shows the short name ("Біцепс", "Передпліччя", "Стегно", "Литка"). Over the columns, "Права сторона" and "Ліва сторона" (11px, `--planned`) tell the side.
  - Left column, top to bottom: neck, chest, right biceps, right forearm, hips, right thigh, right calf. Right column: shoulders, left biceps, waist, left forearm, left thigh, left calf.
  - Each chip sits at the height of its ring. If two chips come closer than 42px, the lower one moves down.
  - The widest value is "122,25 см" and it fits the column.
- **Leaders:** 1px `--planned` lines from the chip edge, 8px straight, then to the near end of the ring. A 6px diamond in the solid ring colour marks the end.
- **Weight and body fat rows:** one `--card` list with 56px rows: the name (15/700), the change (14px, muted, for example "↓ −0,6 кг") and the value (15/600).

### Add and edit sheets

- **Add:** a bottom sheet from 72px below the top, with an 8px top radius and the floating shadow. The title "Додати вимір" (24/800) and a close button.
  - The date field (52px, `--background` fill) with a calendar icon. It shows the date in the app language ("18 листопада 2026"), and the native date picker opens on a tap.
  - A 2-column grid of value fields. Weight, hips and body fat span both columns. The left and right pairs share a row. Each field has its label (14px, muted) over a 52px field with the value (18/700) and the unit suffix.
  - The placeholder is the latest value in `--planned`. The focused or filled field has a 2px `--foreground` border.
  - "Зберегти" (52px, dark) stays fixed at the bottom over a `--border` divider.
- **Edit:** a bottom sheet with the title "Змінити вимір" and the type under it (15px, muted). The date and the value stack in one column, because a long date does not fit half the row. Then "Зберегти" (dark) and "Видалити" (outlined, destructive text).
- **Delete dialog:** "Видалити цей вимір?", the line "<type> <value>, <date>.", a destructive "Видалити" and an outlined "Скасувати", as in spec 10.
- **Desktop:** both sheets are right side sheets.

### History page

- The back link "Профіль", then the `h1` with the type name (30/800) and the dark "Add measurement" button.
- **Chart card:** the spec 13 chart card. The header is "<type> зараз" over the value (24/800), and the change "↓ −2,25 см" over "за 3 місяці" on the right. The chart has an accent line, outline diamond points and a filled last point. The range control "1М 3М 6М 1Р Все" sits under the plot.
- **List:** "Усі виміри" (18/800), then one `--card` list with 60px rows: the date (15px, muted), the change (14px, muted) and the value (15/700). A row is a button that opens the edit sheet. Rows have no chevron.

### States

- **No weight:** the BMI card shows "Додай вагу, щоб побачити ІМТ." (16/700), the scale with dashed `--planned` segments, an outlined "Додати вагу" button that opens the add sheet with focus on weight, and the BMI note.
- **No girths:** the silhouette at 92×240px with 70% opacity, "Ще немає вимірів" (20/800), "Заміряй груди, талію, стегна, руки й ноги. Значення зʼявляться на схемі." and the dark "Додати вимір".
- **Offline:** "Додати вимір" is disabled, with the `WifiOff` icon and "Потрібен інтернет" (13px) under it. The cached figure and values stay.
- **Loading:** skeleton blocks for the BMI card, the heading row, the silhouette and the chips, with `aria-busy`.

### Desktop 1440

- The sidebar, then a content column of at most 1040px with the visible `h1` "Профіль".
- Two columns with a 40px gap. The left column has the avatar, the BMI card (with the 124×44px mini chart) and the settings rows in one column. The right column (420px) has the measurements section with the same 358×400px diagram.
- The settings rows are one column wide, because a 2-column grid in the left column wraps "Обладнання залу" and "Встановити застосунок" (review fix).

### Dark theme

- The tokens of spec 29: page `#1E1C1A`, cards and chips `#2A2724`, text `#F3F1EC`, muted `#B3ACA3`. The current scale segment is `#F3F1EC` and the others `#4A4541`. The primary button is `#4A4541`.

### Today "+N"

- The planned card fits as many 52px thumbnails with 6px gaps as the row allows: 5 at 390px.
- When exercises are left over, the last visible tile shows its image under a `rgba(30,28,26,0.62)` overlay with "+N" (16/800, `#F3F1EC`). N counts every exercise without its own visible thumbnail.
- A visually hidden text gives "Ще N вправ" to screen readers.

### Session details link

- The exercise header becomes one link on `#2A2724` with a 6px radius: the 64px thumbnail, the name (22/800), then the `Info` icon and "Як виконувати" (14px, secondary), and a chevron on the right.
- "Минулого разу: …" moves under the link.

### Exercise picker on mobile

- The sheet fills the visible viewport. The header, the search field and the results sit above the keyboard. The results scroll inside the sheet, and "Додати" stays at the bottom of the visible area.

## Copy

The lead approved this copy on the canvas.

| Key | en | uk |
| --- | --- | --- |
| BMI card title | BMI | ІМТ |
| Categories | Underweight / Normal / Overweight / Obese | Недостатня вага / Норма / Надлишкова вага / Ожиріння |
| BMI note | A rough indicator for adults. | Приблизний показник для дорослих. |
| No weight | Add your weight to see your BMI. | Додай вагу, щоб побачити ІМТ. |
| No weight button | Add weight | Додати вагу |
| Weight and height line | Weight {{weight}}, height {{height}} | Вага {{weight}}, зріст {{height}} |
| Latest weight date | Updated {{date}}. | Оновлено {{date}}. |
| Mini chart caption | Weight, 90 days | Вага, 90 днів |
| Section title | Measurements | Виміри |
| Types | Weight / Neck / Shoulders / Chest / Waist / Hips / Biceps, left / Biceps, right / Forearm, left / Forearm, right / Thigh, left / Thigh, right / Calf, left / Calf, right / Body fat | Вага / Шия / Плечі / Груди / Талія / Стегна / Біцепс, лівий / Біцепс, правий / Передпліччя, ліве / Передпліччя, праве / Стегно, ліве / Стегно, праве / Литка, ліва / Литка, права / Жир |
| Short chip names | Biceps / Forearm / Thigh / Calf | Біцепс / Передпліччя / Стегно / Литка |
| Column headers | Right side / Left side | Права сторона / Ліва сторона |
| No girths | No measurements yet / Measure your chest, waist, hips, arms and legs. The values will appear on the figure. | Ще немає вимірів / Заміряй груди, талію, стегна, руки й ноги. Значення зʼявляться на схемі. |
| History chart header | {{type}} now | {{type}} зараз |
| History list title | All measurements | Усі виміри |
| Add button and sheet title | Add measurement | Додати вимір |
| Date field | Date | Дата |
| Save | Save | Зберегти |
| Edit sheet title | Edit measurement | Змінити вимір |
| Delete | Delete | Видалити |
| Delete dialog | Delete this measurement? | Видалити цей вимір? |
| Range with no points | No measurements in this period. | Немає вимірів за цей період. |
| Future date error | The date can't be in the future. | Дата не може бути в майбутньому. |
| Range error | From {{min}} to {{max}} {{unit}}. | Від {{min}} до {{max}} {{unit}}. |
| Unit suffixes | cm / kg / in / lb / % | см / кг / дюйм / фн / % |
| Offline | Internet needed | Потрібен інтернет |
| Session link (accessible name) | How to do {{name}} | Як виконувати {{name}} |
| Session link hint | How to do it | Як виконувати |
| More thumbnails | +{{count}} | +{{count}} |
| More thumbnails (screen reader) | {{count}} more exercises | Ще {{count}} вправ |

## Data and API

Changes to `docs/tech/DATA_MODEL.md` and `docs/tech/API.md`, approved by the lead:

- `MEASUREMENT_TYPE` gets `neck`, `shoulders`, `forearm_left`, `forearm_right`, `calf_left` and `calf_right`. A migration updates the `body_measurement_type` check constraint.
- `value numeric(7,2)` already holds two decimals. No column change.
- `body_measurement` gets a partial unique index on `(userId, type, measuredOn) WHERE deletedAt IS NULL`.
- The migration first keeps the newest row per user, type and day, and soft deletes the others. Then it creates the index.
- `GET /api/v1/measurements` returns all non-deleted measurements of the current user: `{ items: [{ id, type, value, measuredOn, updatedAt }] }`. The client computes the latest values, the changes, the BMI and the charts.
- `PUT /api/v1/measurements/{id}` creates or updates a measurement with a client id: `{ type, value, measuredOn }`, in canonical units.
  - If another measurement of the type already exists on that day, the server updates that row and returns it.
  - A repeat of the same request gives the same result (`request-safety.md`).
- `DELETE /api/v1/measurements/{id}` soft deletes and returns 204. A repeat on an own measurement that is already deleted returns 204.
- An unknown id or another user's measurement is a 404 for `PUT` and `DELETE`, with no change (`api-handlers.md`).
- The workout list response allows up to 12 `thumbnailUrls` (was 4), so the Today card can fill its row. The other screens still show the first 4.
- Shared Zod schemas validate the limits on the client and on the server.
- The add sheet sends one `PUT` per filled field.
- No API change for the session or the picker.

## Acceptance criteria

- [ ] AC1: Adding a weight updates the BMI card at once. BMI = kg / m², rounded to one decimal (unit tested).
- [ ] AC2: The category labels follow the WHO adult ranges. Unit tests cover 18.4, 18.5, 24.9, 25.0, 29.9 and 30.0.
- [ ] AC3: In the weight and body fat rows and in the history list, a change shows an up or down arrow and a sign, in a neutral colour. A type with one measurement shows no change. The figure labels show no change.
- [ ] AC4: Editing or deleting a measurement updates the history, the latest value and the BMI card.
- [ ] AC5: Without a weight measurement, the BMI card asks the user to add a weight. Deleting the last weight shows this state.
- [ ] AC6: The same `PUT` sent twice creates one measurement.
- [ ] AC7: A second save of a type on the same day replaces the value. The database never has two non-deleted rows for one user, type and day.
- [ ] AC8: The add sheet saves only the filled fields, and "Save" is disabled while all fields are empty.
- [ ] AC9: Values outside the limits and future dates are rejected with the copy above, on the client and with 400 on the server. Weight is stored rounded to 0.1, and girths and body fat to 0.01, also from imperial input (unit tested).
- [ ] AC10: Profile shows all 15 types: 13 girth labels on the figure and the weight and body fat rows. A type with no measurement shows "—". "122,25 см" fits its label at 390px.
- [ ] AC11: The mini chart shows the last 90 days of weight and is hidden with fewer than 2 points.
- [ ] AC12: The history page chart has the range control with 3M as the default. A range with no points shows the empty message.
- [ ] AC13: Offline, add, edit and delete are disabled with "Потрібен інтернет", and views opened before still show.
- [ ] AC14: In a session, a tap on the current exercise's thumbnail or name opens its details page. The session bar returns to the same session and exercise.
- [ ] AC15: A tap on a row of the exercise list sheet still makes that exercise current.
- [ ] AC16: After session start, the details of the session exercises open offline from the cache.
- [ ] AC17: The Today planned card with more exercises than fit shows "+N" on the last tile, and N is correct at 390px and 1440px.
- [ ] AC18: On a 390px mobile viewport with the keyboard open, the exercise picker keeps its height, and the first result is visible above the keyboard.
- [ ] AC19: Profile shows the male or the female figure from `profile.sex`. Each label is a link to its history, with the full type name and value as its accessible name.
- [ ] AC20: Every measurement read and write is scoped to the current user.

## Depends on

04, 10, 13.
