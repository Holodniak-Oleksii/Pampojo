# 04. Onboarding and profile basics

## Goal

Collect the few details the app needs (name, avatar, sex, birth date, height, weight) in a quick flow, and let the user edit them later.

## User stories

- As a new user, I want a short setup right after sign-up, so that the app knows my body basics without a long form.
- As a user, I want to enter height and weight in my own units, so that I don't convert by hand.
- As a user, I want to see and edit my profile and log out from it.

## Scope

### Data

- `profile` table and `body_measurement` table (see "Data and API"). The first weight goes to `body_measurement` (type `weight`).
- Every onboarding field is required. Profile columns stay nullable only where a row can exist without them; a user without a `profile` row has not finished onboarding.
- The language is not stored in the database. It stays in the `lang` cookie (spec 01).

### `/onboarding`

Three steps with a progress indicator ("Step 1 of 3" and a bar), Back (hidden on step 1) and Continue (Finish on step 3).

1. **Name and avatar.**
   - A large `EmojiAvatar` preview on top. Below it a 6×4 grid of the 24 emoji and the 8 background colors (spec 01): one row of 8 from 640px, two rows of 4 on phones, so every swatch keeps a 44px target.
   - A random emoji and a random color are pre-selected when the draft is created; the user can change both.
   - Name: trimmed, 1–40 characters. Prefilled with `user.name` only for users who signed up with Google; empty for email sign-ups.
   - Continue is disabled while the name is empty.
2. **Sex and birth date.**
   - Sex: segmented control Male / Female, nothing pre-selected.
   - Birth date: three numeric fields DD / MM / YYYY (in this order in both languages), numeric keyboard, focus moves to the next field when one is full.
   - Must be a real calendar date. Age (full years on today's date) must be 16–100.
3. **Height and weight.**
   - Unit toggle Metric / Imperial, metric by default. The toggle sets `profile.unitSystem`. Switching converts the values already typed.
   - Metric: height in whole cm, weight in kg with at most one decimal.
   - Imperial: height in two fields, ft and in (0–11), whole numbers; weight in lb with at most one decimal.
   - Comma and dot are both accepted as the decimal separator.
   - Limits: height 100–250 cm (3′4″–8′2″), weight 30–300 kg (67–661 lb). Errors give the limit in the chosen unit.

Behavior:

- **Draft**: the values live in `localStorage`, keyed by user id, and survive a reload. A reload reopens the step the user was on. Another device starts from step 1. The draft is cleared on finish and on log out.
- **Finish** sends one `PUT /api/v1/me/profile` with all fields, the weight and the device time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`, `UTC` if missing). It creates the profile and the first weight measurement dated today, sets `onboardingCompletedAt`, replaces the temporary `user.name` (email local part, spec 03) with the onboarding name, then redirects to `/today`.
- **Header**: the wordmark and a small "Log out" text button, for users who signed in to the wrong account.
- **Mobile**: full width with a 16px gutter, Back and Continue pinned to the bottom above the safe area. **Desktop (≥ 1024px)**: a centered card, max width about 480px.

### Redirects

Extends spec 03:

- A signed-in user without a completed onboarding goes to `/onboarding` after sign-up, log in and Google sign-in, and when opening any protected `(app)` route. A valid `next` is dropped in this case.
- `/onboarding` with a completed onboarding redirects to `/today`.
- `/onboarding` and `/profile` are protected (no session → `/login?next=…`), in the proxy and on the server.

### `/profile` (first version)

- Lives in the `(app)` group. Shows the avatar, name, age (derived from the birth date on today's date), height and latest weight in the user's unit system, an Edit profile button and Log out.
- Log out moves here from the `/today` placeholder. The placeholder gets a "Profile" link instead; spec 05 replaces both with the real navigation.
- **Edit profile**: a sheet (bottom sheet on mobile, right side sheet on desktop) with the onboarding fields: name, avatar, sex, birth date, unit toggle, height, weight. Same validation.
  - Save is disabled until something changed. It sends only the changed fields with `PATCH /api/v1/me/profile`.
  - Changing the weight records today's weight: if a weight measurement for today (in the profile time zone) exists it is updated, otherwise one is created. Older measurements stay as history.
  - Changing the name also updates `user.name`.
  - On success the sheet closes and a toast "Profile saved" shows.
- The time zone is captured once at onboarding; editing it is out of scope.

## Out of scope

- BMI, measurements history and editing past measurements (spec 14).
- Gym equipment (spec 08).
- Language setting in the profile and a stored language (later; the switcher from spec 01 stays as is).
- A Settings block on `/profile`, sync status (specs 08, 14, 17).
- Navigation bar, Today data (spec 05).
- Photo avatars, time zone editing, account deletion (later).
- Offline log-out guard (spec 17).

## UX

- **Validation**: shared Zod schemas on client and server. Field errors appear only after the first Continue / Save attempt, then update as the user types (same rule as spec 03). Errors go under the field, linked by `aria-describedby`. For birth date and imperial height one error covers the field group.
- **Pending**: Finish / Save show the pending label and are disabled; a double click sends one request.
- **Server error**: an alert above the button with the generic error; the draft stays.
- **Offline** (`navigator.onLine === false`): steps 1–2 work (the draft is local). On step 3 and in the Edit sheet an inline notice shows, and Finish / Save are disabled.
- **Loading**: `/profile` renders on the server; a skeleton covers the streaming gap.
- **Accessibility**: emoji and color options are radio groups with accessible names (emoji names from spec 01, color names peach, apricot, …). Touch targets at least 44px. The first field is focused on load on desktop only.

## Data and API

### `profile`

Changes the `DATA_MODEL.md` draft: `birthDate date` replaces `birthYear`, and `locale` is dropped.

| Column | Type | Notes |
| --- | --- | --- |
| userId | uuid PK → user | |
| displayName | text | 1–40 characters, trimmed |
| avatarEmoji | text | Id from `AVATAR_EMOJI` (kebab-case) |
| avatarColor | smallint | 1–8, `--avatar-N` |
| sex | text | `male`, `female` |
| birthDate | date | Age is derived on read |
| heightCm | numeric | Rounded to 0.1 |
| unitSystem | text | `metric`, `imperial` (display and input only) |
| timeZone | text | IANA zone from the device at onboarding |
| onboardingCompletedAt | timestamptz | Set by the onboarding `PUT` |
| createdAt, updatedAt | timestamptz | |

### `body_measurement`

As in `DATA_MODEL.md`: `id`, `userId`, `type`, `value numeric` (canonical unit), `measuredOn date`, `createdAt`, `updatedAt`, `deletedAt`. This spec writes only `type = 'weight'`, value in kg rounded to 0.1.

### Conversions

- 1 in = 2.54 cm, 1 lb = 0.45359237 kg. Stored values are rounded to 0.1 cm / 0.1 kg.
- Display: metric height in whole cm, imperial height as `5′11″` (total inches rounded), weight with one decimal in kg or lb.

### Endpoints

All `auth: 'required'`, scoped to the session user.

- `GET /api/v1/me/profile` → the profile with derived `age` and `latestWeightKg` (latest non-deleted weight measurement). `404 PROFILE_NOT_FOUND` before onboarding.
- `PUT /api/v1/me/profile` → onboarding finish. Body: `displayName`, `avatarEmoji`, `avatarColor`, `sex`, `birthDate`, `heightCm`, `weightKg`, `unitSystem`, `timeZone`. In one transaction: creates the profile, inserts the weight measurement for today in `timeZone`, sets `onboardingCompletedAt`, updates `user.name`. If the onboarding is already completed it returns the stored profile and changes nothing (a repeat never adds a second weight).
- `PATCH /api/v1/me/profile` → any subset of the same fields except `timeZone`. `weightKg` writes today's weight as described above. `404 PROFILE_NOT_FOUND` before onboarding. An empty body is a 400.
- Schemas in `src/shared/schemas/profile.ts`. Age 16–100 is checked against today in the request's time zone (`timeZone` on `PUT`, the stored one on `PATCH`).

## Copy

| Where | en | uk |
| --- | --- | --- |
| Meta titles | Welcome · Pampojo / Profile · Pampojo | Вітаємо · Pampojo / Профіль · Pampojo |
| Progress | Step {{step}} of 3 | Крок {{step}} з 3 |
| Buttons | Back / Continue / Finish / Finishing… | Назад / Далі / Готово / Зберігаємо… |
| Header log out | Log out | Вийти |
| Step 1 title / subtitle | What should we call you? / Pick a name and an avatar. | Як до тебе звертатися? / Обери ім'я та аватар. |
| Name label / placeholder | Name / Your name | Ім'я / Твоє ім'я |
| Avatar groups (accessible names) | Avatar / Background color | Аватар / Колір фону |
| Step 2 title / subtitle | A bit about you / Used for body stats like BMI. | Трохи про тебе / Потрібно для показників тіла, як-от ІМТ. |
| Sex label / options | Sex / Male / Female | Стать / Чоловік / Жінка |
| Birth date label / fields | Date of birth / DD / MM / YYYY | Дата народження / ДД / ММ / РРРР |
| Step 3 title / subtitle | Height and weight / You can change these later in your profile. | Зріст і вага / Їх можна змінити пізніше в профілі. |
| Unit toggle | Metric / Imperial | Метрична / Імперська |
| Height / weight labels | Height / Weight | Зріст / Вага |
| Unit suffixes | cm / kg / ft / in / lb | см / кг / фт / дюйм / фн |
| Error: name required | Enter your name | Введи ім'я |
| Error: name too long | Name must be at most 40 characters | Ім'я має містити не більше 40 символів |
| Error: sex required | Choose one | Обери варіант |
| Error: invalid date | Enter a valid date | Введи коректну дату |
| Error: too young | You must be at least 16 to use Pampojo | Тобі має бути щонайменше 16 років |
| Error: too old | Age must be 100 or less | Вік має бути не більше 100 років |
| Error: height | Enter a height between {{min}} and {{max}} | Введи зріст від {{min}} до {{max}} |
| Error: weight | Enter a weight between {{min}} and {{max}} | Введи вагу від {{min}} до {{max}} |
| Error: generic | Something went wrong. Try again. | Щось пішло не так. Спробуй ще раз. |
| Offline notice | You're offline. Connect to the internet to save. | Ти офлайн. Під'єднайся до інтернету, щоб зберегти. |
| Profile page title | Profile | Профіль |
| Profile rows | Age / Height / Weight | Вік / Зріст / Вага |
| Age value | {{count}} years (plural) | {{count}} рік / роки / років |
| Profile buttons | Edit profile / Log out | Редагувати профіль / Вийти |
| Edit sheet title / buttons | Edit profile / Save / Saving… / Cancel | Редагувати профіль / Зберегти / Зберігаємо… / Скасувати |
| Saved toast | Profile saved | Профіль збережено |
| `/today` placeholder link | Profile | Профіль |

## Acceptance criteria

- [ ] AC1: A new user after email sign-up lands on step 1 with a random emoji and color selected and an empty name; Continue is disabled until a name is entered. A new Google user sees the name prefilled.
- [ ] AC2: Values persist between steps (Back and Continue) and after a reload mid-onboarding, which reopens the same step. Log out clears the draft.
- [ ] AC3: Finishing creates the profile and one weight measurement dated today, sets `onboardingCompletedAt`, replaces `user.name`, and redirects to `/today`. Sending the same `PUT` twice leaves one profile and one weight measurement.
- [ ] AC4: A signed-in user without a completed onboarding who logs in, signs up, signs in with Google or opens `/today` or `/profile` lands on `/onboarding`. After finishing, opening `/onboarding` redirects to `/today`. Without a session, `/onboarding` and `/profile` redirect to `/login?next=…`.
- [ ] AC5: Validation, shown under the fields with the copy above: name 1–40 after trim; sex required; birth date must be a real date (31/02 is rejected) and give an age of 16–100 (a user turning 16 tomorrow is rejected, today is accepted); height 100–250 cm; weight 30–300 kg; in imperial 3′4″–8′2″ and 67–661 lb. The server rejects the same cases with 400.
- [ ] AC6: Imperial input is converted and stored in cm and kg rounded to 0.1 (unit tested: 5′11″ → 180.3 cm, 176 lb → 79.8 kg). Switching the toggle converts typed values. The profile and the Edit sheet show values in the stored unit system.
- [ ] AC7: `/profile` shows avatar, name, age derived from the birth date, height and latest weight. Edit profile sends only the changed fields; Save is disabled with no changes. Changing the weight twice on the same day leaves one measurement for today with the last value; a change on another day adds a new one.
- [ ] AC8: `GET`, `PUT` and `PATCH /api/v1/me/profile` only read and write the session user's rows; `GET` and `PATCH` return `404 PROFILE_NOT_FOUND` before onboarding; all return 401 without a session.
- [ ] AC9: Offline, steps 1–2 work, step 3 and the Edit sheet show the offline notice and Finish / Save are disabled.
- [ ] AC10: Log out is on `/profile` and in the onboarding header, ends the session and lands on `/`. The `/today` placeholder links to `/profile` and has no Log out button.
- [ ] AC11: Onboarding and `/profile` work at 390px (touch targets ≥ 44px, buttons pinned to the bottom) and 1440px (onboarding is a centered card) in `en` and `uk`, with no horizontal scroll.

## Depends on

03.

## Open questions
