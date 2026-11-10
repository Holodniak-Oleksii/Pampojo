# 04-onboarding-profile — technical plan

Spec: `docs/specs/04-onboarding-profile.md`

## 1. Summary

Add the profile and the first body measurement, a 3-step onboarding, an onboarding gate and a first `/profile` page.

- **Data:** new tables `profile` and `body_measurement` (one additive migration).
- **API:** `GET/PUT/PATCH /api/v1/me/profile`. `PUT` finishes onboarding (idempotent). `PATCH` edits only the changed fields.
- **Onboarding:** `/onboarding`, three steps (name + avatar, sex + birth date, height + weight) with a `localStorage` draft and one `PUT` at the end.
- **Gate:** a signed-in user without a completed onboarding is sent to `/onboarding` from every `(app)` route. A completed user opening `/onboarding` is sent to `/today`.
- **Profile:** `/profile` shows avatar, name, age, height and latest weight, an Edit profile sheet and Log out. The `/today` placeholder loses Log out and links to `/profile`.
- **Client data layer:** this spec adds `@tanstack/react-query` (ADR 0006, lead's go-ahead 2026-11-09), `src/api/http.ts` and `src/api/query-client.ts`.

Existing code this builds on:

- `src/server/http/handler.ts`: `withHandler({ auth: 'required', body, … }, fn)` gives `userId`, maps `DomainError` codes through `ERROR_STATUS` in `src/server/http/errors.ts`, returns 400 `VALIDATION_FAILED` with Zod issues. `json()` in `response.ts` sets `Cache-Control: private, no-store`.
- `src/server/auth/request-session.ts`: `getRequestSession()` (React `cache`). `src/app/[lang]/(app)/session-gate.tsx` redirects to `/login?next=…` without a session.
- `src/proxy.ts`: `isProtected()` lists `/today`, `/onboarding`, `/session/*`. It forwards the original path in `ORIGINAL_PATH_HEADER` (`src/constants/routing.ts`).
- `src/server/db/schema/auth.ts`: `user` (uuid `id`, `name`), `account` (`providerId`, `userId`). `schema/index.ts` re-exports domain files. Migrations in `src/server/db/migrations/` (one so far, `0000_…`).
- `src/constants/avatar.ts`: `AVATAR_EMOJI` (24 ids), `AVATAR_EMOJI_IDS`, `AVATAR_COLORS` (1–8), types `AvatarEmojiId`, `AvatarColor`. `src/components/EmojiAvatar` (`emoji`, `color`, `size` sm/md/lg, `label`) and `useAvatarEmojiNames()`.
- Auth UI: `src/features/auth/LogOutButton` (signs out, then `navigateAfterAuth('/')`), `CredentialsForm` (RHF + `zodResolver`, `mode: 'onSubmit'`, error codes translated by a hook, `inFlight` ref against double clicks, desktop-only autofocus via `(min-width: 1024px)`), `SignUpForm` (sets `user.name` to `nameFromEmail(email)`).
- UI primitives in `src/components/ui`: `button`, `input`, `field` (`Field`, `FieldLabel`, `FieldError`), `label`, `progress`, `sheet` (`side` top/right/bottom/left), `skeleton`, `sonner` (`Toaster` is in the root layout), `card`. `PageHeader`, `useIsOnline()` (`src/hooks/useIsOnline.ts`).
- i18n: `getI18n()` on the server, `useTranslation()`, `useLocale()`, `useFormat()` (`number`) on the client. Plurals use `_one/_few/_many/_other` keys (see `{{count}} pending`).
- Tests: `src/test/render.tsx` (`render(ui, { locale })`, comment says the `QueryClient` joins in the first spec with a query), `src/test/mocks.ts` (`mergeMock`), `src/test/db.ts` (`withRollback`, `deleteUsersByEmail`), `e2e/helpers/db.ts` (`deleteE2eUsers` for `e2e-%@example.com`). Node test files own an email prefix and clean up in `afterAll`.

## 2. Acceptance criteria

- AC1: A user who has just signed up with email lands on `/onboarding` step 1. A random emoji and a random color (1–8) are selected; the name field is empty and Continue is disabled. Typing a non-blank name enables Continue. A new Google user (an `account` row with `providerId = 'google'`) sees the name field prefilled with `user.name`.
- AC2: Back and Continue keep every entered value. Reloading the page on any step reopens that step with the values. After Log out (from the onboarding header or anywhere else), the draft is gone: logging in again starts at step 1 with a fresh random avatar.
- AC3: Finish sends `PUT /api/v1/me/profile` and lands on `/today`. In the database: one `profile` row with every field and `onboardingCompletedAt` set; one `body_measurement` row (`type = 'weight'`, value in kg, `measuredOn` = today in the sent time zone); `user.name` equals the onboarding name. Sending the identical `PUT` a second time returns 200 with the same profile and leaves exactly one profile and one weight row.
- AC4: For a signed-in user with no `profile` row: after log in, sign-up and Google sign-in (all go to `/today` or `next`), and when opening `/today` or `/profile` directly, the user ends on `/onboarding`; `next` is dropped. A user with a completed onboarding opening `/onboarding` ends on `/today`. Without a session cookie, `/onboarding` and `/profile` redirect to `/login?next=%2Fonboarding` / `%2Fprofile`.
- AC5: Validation, shown under the field after the first Continue / Save attempt with the section 7 copy:
  - name: 1–40 characters after trim (`"   "` is empty);
  - sex: required;
  - birth date: day, month and year form a real date (`31/02/2000` is invalid), and the age in full years on today's date is 16–100 (a birthday that makes the user 16 tomorrow is rejected, one that makes them 16 today is accepted; 101 is rejected);
  - height: 100–250 cm, checked after converting imperial input (3′4″ accepted, 3′3″ rejected, 8′2″ accepted, 8′3″ rejected);
  - weight: 30–300 kg after rounding to 0.1, checked after converting lb (67 lb accepted, 66 lb rejected, 661 lb accepted, 662 lb rejected).

  `PUT` and `PATCH` return 400 `VALIDATION_FAILED` for the same cases.
- AC6: Conversions (unit tests): 5′11″ → 180.3 cm; 176 lb → 79.8 kg; 180 cm → `5′11″`; 79.8 kg → 175.9 lb. Values are stored in cm and kg rounded to 0.1. Toggling Metric / Imperial on step 3 or in the Edit sheet converts the values already typed. `/profile` shows height and weight in the stored `unitSystem`.
- AC7: `/profile` shows the avatar, name, age (full years from `birthDate` on today's date), height and latest weight. In the Edit sheet, Save is disabled until a field changes; the `PATCH` body contains only the changed fields. Saving a new weight twice on the same day leaves one weight row for today with the last value; a weight saved on another day adds a row and keeps the old one. A name change also updates `user.name`. On success the sheet closes and the toast `Profile saved` shows.
- AC8: The three endpoints read and write only the session user's rows (a second user's `GET` never sees the first user's profile). `GET` and `PATCH` return 404 `PROFILE_NOT_FOUND` before onboarding. All return 401 `UNAUTHORIZED` without a session. `PATCH` with `{}` returns 400.
- AC9: With the browser offline: Continue on steps 1–2 still works; step 3 and the Edit sheet show `You're offline. Connect to the internet to save.`, and Finish / Save are disabled. Going back online re-enables them.
- AC10: Log out is on `/profile` and in the onboarding header. It ends the session and lands on `/`. The `/today` placeholder shows a `Profile` link to `/profile` and no Log out button.
- AC11: `/onboarding` and `/profile` at 390×844 and 1440×900 in `en` and `uk` show the section 7 copy, have no horizontal scroll (`scrollWidth <= innerWidth`), and every interactive element is at least 44×44px. On mobile, Back / Continue are pinned to the bottom; on desktop the onboarding is a centered card (max width 480px).

## 3. Data

### Constants

- `src/constants/profile.ts`: `SEX = { MALE: 'male', FEMALE: 'female' } as const`, `UNIT_SYSTEM = { METRIC: 'metric', IMPERIAL: 'imperial' } as const`, types `Sex`, `UnitSystem` via `ValueOf`.
- `src/constants/profile.ts` also holds the limits: `NAME_MAX = 40`, `AGE_MIN = 16`, `AGE_MAX = 100`, `HEIGHT_CM = { min: 100, max: 250 }`, `WEIGHT_KG = { min: 30, max: 300 }`, and the imperial display limits `HEIGHT_IMPERIAL = { min: '3′4″', max: '8′2″' }`, `WEIGHT_LB = { min: 67, max: 661 }` (used only for error messages).
- `src/constants/measurement.ts`: `MEASUREMENT_TYPE` with `weight`, `chest`, `waist`, `hips`, `biceps_left`, `biceps_right`, `thigh_left`, `thigh_right`, `body_fat_pct` (from `DATA_MODEL.md`), type `MeasurementType`.
- If `src/shared/schemas/utils.ts` (the `z.enum` helper from `docs/development/frontend/typescript.md`) does not exist, create it: `enumOf(obj)` → `z.enum(Object.values(obj) as [V, ...V[]])`.

### Tables — `src/server/db/schema/profile.ts`, `src/server/db/schema/measurement.ts`

`profile`:

| Column | Drizzle | Constraint |
| --- | --- | --- |
| `user_id` | `uuid().primaryKey().references(() => user.id, { onDelete: 'cascade' })` | |
| `display_name` | `text().notNull()` | check `char_length between 1 and 40` |
| `avatar_emoji` | `text().notNull()` | check in `AVATAR_EMOJI_IDS` |
| `avatar_color` | `smallint().notNull()` | check `between 1 and 8` |
| `sex` | `text().notNull()` | check in `SEX` values |
| `birth_date` | `date({ mode: 'string' }).notNull()` | |
| `height_cm` | `numeric({ precision: 4, scale: 1, mode: 'number' }).notNull()` | check `between 100 and 250` |
| `unit_system` | `text().notNull().default('metric')` | check in `UNIT_SYSTEM` values |
| `time_zone` | `text().notNull()` | |
| `onboarding_completed_at` | `timestamp({ withTimezone: true }).notNull()` | |
| `created_at`, `updated_at` | `timestamp({ withTimezone: true }).notNull().defaultNow()` | |

All columns are `notNull`: a row is only created by the onboarding `PUT`, which sends every field (spec: "a user without a `profile` row has not finished onboarding"). The PK is the user FK, so no extra index.

`body_measurement`:

| Column | Drizzle | Constraint |
| --- | --- | --- |
| `id` | `uuid().primaryKey().defaultRandom()` | spec 16 switches creates to client ids |
| `user_id` | `uuid().notNull().references(() => user.id, { onDelete: 'cascade' })` | |
| `type` | `text().notNull()` | check in `MEASUREMENT_TYPE` values |
| `value` | `numeric({ precision: 7, scale: 2, mode: 'number' }).notNull()` | check `> 0` |
| `measured_on` | `date({ mode: 'string' }).notNull()` | |
| `created_at`, `updated_at` | `timestamptz notNull defaultNow` | |
| `deleted_at` | `timestamp({ withTimezone: true })` | nullable |

Index `body_measurement_user_type_date_idx` on `(user_id, type, measured_on)`. No unique constraint: spec 14 owns the rules for several measurements a day; this spec serializes its own writes (section 5).

If `numeric` `mode: 'number'` is not available in the installed drizzle-orm (0.45), keep the default string mode and convert with `Number()` in `queries.ts`; record it in Implementation notes.

Re-export both files from `src/server/db/schema/index.ts`. If no `touch()` helper exists in `src/server/db/utils.ts`, add it (`() => ({ updatedAt: new Date() })`).

### Migration

`pnpm db:generate` → `0001_<name>.sql`. Review: two `CREATE TABLE`, FKs with `ON DELETE cascade`, the checks, one index, nothing else (no drift on auth tables). Apply with `pnpm db:migrate` (shared database, additive only).

### Docs

`docs/tech/DATA_MODEL.md` was updated in the drill (`birthDate`, no `locale`, `avatarColor smallint`). After implementation, align its `profile` table with any column detail that changed and add the `body_measurement` index.

### Zod — `src/shared/schemas/profile.ts`

Messages are codes (same pattern as `AUTH_FIELD_ERROR`), translated by the client:

```ts
export const PROFILE_FIELD_ERROR = {
  NAME_REQUIRED: 'name_required',
  NAME_TOO_LONG: 'name_too_long',
  SEX_REQUIRED: 'sex_required',
  DATE_INVALID: 'date_invalid',
  TOO_YOUNG: 'too_young',
  TOO_OLD: 'too_old',
  HEIGHT_RANGE: 'height_range',
  WEIGHT_RANGE: 'weight_range',
} as const;
```

- `displayNameSchema`: `z.string().trim().min(1, NAME_REQUIRED).max(40, NAME_TOO_LONG)`.
- `avatarEmojiSchema` (`enumOf` over `AVATAR_EMOJI_IDS`), `avatarColorSchema` (`z.number().int().min(1).max(8)`), `sexSchema` (enum, error `SEX_REQUIRED`), `unitSystemSchema`.
- `birthDateSchema`: `z.iso.date({ error: DATE_INVALID })` plus a refine that the date round-trips (rejects `2000-02-31`). The age range is not in this static schema; see `validateAge`.
- `heightCmSchema`: number, `min(100).max(250)`, error `HEIGHT_RANGE`. `weightKgSchema`: number, `min(30).max(300)`, error `WEIGHT_RANGE`. Both transform with `round1`.
- `timeZoneSchema`: `z.string().max(64).refine(isValidTimeZone)` (`new Intl.DateTimeFormat('en', { timeZone })` does not throw).
- `completeOnboardingInputSchema` (`PUT` body): `z.object({ displayName, avatarEmoji, avatarColor, sex, birthDate, heightCm, weightKg, unitSystem, timeZone }).strict()`.
- `updateProfileInputSchema` (`PATCH` body): the same fields except `timeZone`, all optional, `.strict()`, refined to have at least one key.
- `profileSchema` (response): `displayName`, `avatarEmoji`, `avatarColor`, `sex`, `birthDate` (`YYYY-MM-DD`), `age` (int), `heightCm`, `latestWeightKg` (number | null), `latestWeightOn` (`YYYY-MM-DD` | null), `unitSystem`, `timeZone`, `onboardingCompletedAt` (ISO string).
- Types: `CompleteOnboardingInput`, `UpdateProfileInput`, `Profile`.

### Pure helpers (client and server)

- `src/lib/units.ts`: `round1(n)`, `CM_PER_INCH = 2.54`, `KG_PER_LB = 0.45359237`, `cmFromFeetInches(ft, inch)` (rounded to 0.1), `feetInchesFromCm(cm)` → `{ feet, inches }` from `Math.round(cm / 2.54)` total inches, `kgFromLb(lb)` (0.1), `lbFromKg(kg)` (0.1), `parseDecimal(text)` (accepts `,` or `.`, at most one decimal, returns `number | null`).
- `src/lib/dates.ts`: `todayIn(timeZone)` → `YYYY-MM-DD` via `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })`; `ageOn(birthDate, today)` → full years (compare month/day); `isRealDate(y, m, d)`; `validateAge(birthDate, today)` → `null | 'too_young' | 'too_old'` (16–100).

## 4. API

All routes in `src/app/api/v1/me/profile/route.ts`, all `withHandler({ auth: 'required', … })`, responses through `json()` (`private, no-store`). Add to `ERROR_STATUS`: `PROFILE_NOT_FOUND: 404`.

| Method | Body | Success | Errors |
| --- | --- | --- | --- |
| `GET` | — | 200 `Profile` | 401, 404 `PROFILE_NOT_FOUND` |
| `PUT` | `CompleteOnboardingInput` | 200 `Profile` | 400 `VALIDATION_FAILED` (shape, or age against `todayIn(body.timeZone)`), 401 |
| `PATCH` | `UpdateProfileInput` | 200 `Profile` | 400 (shape, empty body, age against `todayIn(stored timeZone)`), 401, 404 `PROFILE_NOT_FOUND` |

- Age failures throw `DomainError('VALIDATION_FAILED', 'Validation failed', [{ code: 'custom', path: ['birthDate'], message: 'too_young' | 'too_old' }])`, so the client sees the same shape as a Zod failure.
- **Idempotency** (`docs/development/request-safety.md`): `PUT` is a natural upsert on the user's single profile row: the first call creates it, any later call returns the stored profile unchanged. `PATCH` sets values (no increments), so a repeat has the same effect; today's weight is updated, not duplicated. No `Idempotency-Key` is needed.
- `docs/tech/API.md` already lists `GET/PUT/PATCH /api/v1/me/profile` (drill).

## 5. Server

### `src/server/profile/`

- `errors.ts`: `PROFILE_ERROR = { NOT_FOUND: 'PROFILE_NOT_FOUND' }`.
- `queries.ts` (`import 'server-only'`), every function takes `userId` (or a `tx`) and filters by it:
  - `findProfile(db, userId)` → profile row joined with the latest weight: `select … from body_measurement where user_id = $1 and type = 'weight' and deleted_at is null order by measured_on desc, created_at desc limit 1` (one query with a lateral join or two queries; constant count either way).
  - `insertProfileIfAbsent(tx, userId, values)` → `insert … on conflict (user_id) do nothing returning *`.
  - `lockProfile(tx, userId)` → `select … for update`.
  - `updateProfileFields(tx, userId, fields)` → `.set({ ...fields, ...touch() })` with only the present fields.
  - `upsertTodayWeight(tx, userId, kg, measuredOn)` → update the non-deleted weight row with that `measured_on` (most recent if several), else insert.
  - `setUserName(tx, userId, name)` → `update "user" set name = $2, updated_at = now() where id = $1`.
  - `hasGoogleAccount(db, userId)` → exists `account` with `provider_id = 'google'`.
  - `isOnboardingComplete(db, userId)` → profile row exists (cheap PK lookup).
- `service.ts` (`import 'server-only'`):
  - `getProfile(userId)` → `findProfile`, throw `PROFILE_NOT_FOUND` when absent, map to `Profile` (`age = ageOn(birthDate, todayIn(timeZone))`).
  - `completeOnboarding(userId, input)`:
    1. `validateAge(input.birthDate, todayIn(input.timeZone))` → throw on failure.
    2. Transaction: `insertProfileIfAbsent` with `onboardingCompletedAt = now`. If nothing was inserted (already completed), commit and return `getProfile(userId)` without other writes.
    3. Otherwise insert the weight row (`measuredOn = todayIn(input.timeZone)`), `setUserName(displayName)`.
    4. Return `getProfile(userId)`.
    - `on conflict do nothing` makes two concurrent first `PUT`s safe: the loser inserts nothing and writes no weight.
  - `updateProfile(userId, input)`:
    1. Transaction: `lockProfile` (throw `PROFILE_NOT_FOUND` when absent). The row lock serializes concurrent `PATCH`es of one user, so two same-day weight saves cannot both insert.
    2. If `birthDate` is present: `validateAge` against `todayIn(locked.timeZone)`.
    3. `updateProfileFields` with the present profile fields (not `weightKg`), if any.
    4. If `displayName` is present: `setUserName`.
    5. If `weightKg` is present: `upsertTodayWeight(kg, todayIn(locked.timeZone))`.
    6. Return `getProfile(userId)`.
  - `getOnboardingStatus(userId)` → `isOnboardingComplete`.
  - `getOnboardingPrefill(userId, userName)` → `{ name: hasGoogleAccount ? userName.slice(0, 40) : '' }`.
- `src/server/profile/request-onboarding.ts`: `getRequestOnboardingComplete = cache(async (userId) => getOnboardingStatus(userId))`, so the gate and pages share one lookup per request.

### Route handler — `src/app/api/v1/me/profile/route.ts`

```ts
export const GET = withHandler({ auth: 'required' }, async ({ userId }) => json(await getProfile(userId)));
export const PUT = withHandler({ auth: 'required', body: completeOnboardingInputSchema }, async ({ userId, body }) => json(await completeOnboarding(userId, body)));
export const PATCH = withHandler({ auth: 'required', body: updateProfileInputSchema }, async ({ userId, body }) => json(await updateProfile(userId, body)));
```

### User scoping

Every query above filters by the `userId` from the session (`withHandler`) or `getRequestSession()` (pages). No function accepts a user id from a request body or URL.

## 6. Client

### Data layer (new)

- Add `@tanstack/react-query` (latest stable v5) to `dependencies`.
- `src/api/http.ts`: `http<T>(path, { method, body, schema })` → `fetch` with JSON headers and `credentials: 'same-origin'`; on non-2xx parses `{ error: { code, message, details } }` into `ApiError` (`status`, `code`, `details`); on network failure throws `ApiError` with `code: 'NETWORK'`. Retries network errors and 408/503 at most twice with exponential backoff + jitter, only for `GET`, `PUT` and requests carrying `Idempotency-Key` (`PATCH` is not retried). Parses the success body with `schema` when given.
- `src/api/query-client.ts`: `createQueryClient()` with defaults (`staleTime: 30_000`, `retry: false` because `http.ts` owns retries, `refetchOnWindowFocus: false`).
- `src/api/QueryProvider.tsx` (`'use client'`): holds one client in `useState`. Wrap `children` in the root layout `src/app/[lang]/layout.tsx` inside `I18nProvider`.
- `src/api/profile.ts`: `profileKeys = { all: ['profile'] as const, me: () => [...profileKeys.all, 'me'] as const }`, `fetchProfile()`, `completeOnboarding(input)` (`PUT`), `updateProfile(input)` (`PATCH`), `useProfileQuery({ initialData })`, `useCompleteOnboardingMutation()`, `useUpdateProfileMutation()` (on success `setQueryData(profileKeys.me(), data)`; no extra refetch needed).
- `src/test/render.tsx`: add a fresh `QueryClient` per render (retries off) to `AppProviders`, and export `createQueryWrapper`. `src/test/mocks.ts`: add `getProfileMock(override?)` (John Smith, fox, color 1, male, `1990-05-15`, 180, 79.8, metric, `Europe/Kyiv`).

### Routes (under `src/app/[lang]/`)

- `onboarding/layout.tsx`: server. Inside `Suspense`, an `OnboardingGate`: no session → `redirect('/login?next=%2Fonboarding')`; onboarding complete → `redirect('/today')`. Renders the header (wordmark, `OnboardingLogOutButton`) and the centered container.
- `onboarding/page.tsx`: metadata `Welcome · Pampojo`; reads the session and `getOnboardingPrefill` and renders `<OnboardingFlow userId prefillName />`.
- `(app)/session-gate.tsx`: after the session check, `if (!(await getRequestOnboardingComplete(session.user.id))) redirect('/onboarding')`.
- `(app)/profile/page.tsx`: metadata `Profile · Pampojo`; inside `Suspense` (fallback `ProfileSkeleton`) loads `getProfile(session.user.id)` and renders `<ProfileView initialProfile={…} />`.
- `(app)/today/page.tsx`: replace `<LogOutButton />` with a `Link` to `/profile` styled as a secondary button (`Profile`).
- `src/proxy.ts`: `isProtected` also matches `/profile` and `/profile/…`.

Sign-up, log in and Google keep their `next ?? '/today'` targets; the `(app)` gate turns them into `/onboarding` (AC4). No change in `src/features/auth` besides log out.

### Feature `src/features/onboarding/`

- `OnboardingFlow/OnboardingFlow.tsx` (`'use client'`, the entry): owns the draft and the step.
  - Draft shape (`types.ts`): `{ version: 1, step: 1 | 2 | 3, displayName, avatarEmoji, avatarColor, sex: Sex | null, birthDay, birthMonth, birthYear (strings), unitSystem, heightCm, heightFt, heightIn, weight (strings) }`.
  - `useOnboardingDraft(userId, prefillName)` (`hooks/useOnboardingDraft.ts`): key `pampojo:onboarding:<userId>`. Reads once on mount, parses with a Zod draft schema; missing or invalid → a new draft with a random emoji (`AVATAR_EMOJI_IDS[Math.floor(Math.random() * 24)]`), a random color and `displayName: prefillName`. Writes on every change. All `localStorage` access in `try/catch`. Until mounted, render a skeleton (no SSR of random values, which would mismatch hydration).
  - Step header: `Step {{step}} of 3` and `Progress` with value `step / 3 * 100`.
  - Each step is a form (RHF + `zodResolver` with a step schema, `mode: 'onSubmit'`). Continue validates the step, writes the values to the draft and moves on. Back writes the current (possibly invalid) values without validating and moves back.
  - Finish (step 3): build `CompleteOnboardingInput` (convert units, `timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'`), call `useCompleteOnboardingMutation` guarded by an `inFlight` ref. On success: remove the draft key, `window.location.assign('/today')` (full load, same reason as `navigateAfterAuth`). On `ApiError`: `VALIDATION_FAILED` with `details` → map issues to field errors with `setError`; otherwise show the generic alert above the buttons. The draft stays.
- `NameAvatarStep/`: large `EmojiAvatar` (`size="lg"`, preview), the name `Input` (`autoComplete="nickname"`, `maxLength` not set so the error can show), then two radio groups: `AvatarEmojiPicker` (6 columns × 4 rows, each option a 48px circle showing `EmojiAvatar` with the selected color) and `AvatarColorPicker` (8 swatches, 44px). Continue is disabled while `displayName.trim() === ''` (AC1).
- `SexBirthDateStep/`: `SegmentedControl` for sex; `BirthDateInput` (three `Input`s with `inputMode="numeric"`, `maxLength` 2/2/4, `autoComplete` `bday-day`/`bday-month`/`bday-year`, labels `DD`/`MM`/`YYYY`; typing the 2nd digit of day or month focuses the next field). Step schema: day 1–31, month 1–12, year 4 digits, `isRealDate`, then `validateAge(iso, todayIn(deviceTz))`. One `FieldError` under the group (`aria-describedby` on all three inputs).
- `HeightWeightStep/`: `SegmentedControl` Metric / Imperial bound to `unitSystem`. Metric: height `Input` (integer, suffix `cm`), weight `Input` (`inputMode="decimal"`, suffix `kg`). Imperial: height `ft` + `in` inputs (integers, in 0–11), weight `lb`. Toggling converts the current values with `src/lib/units.ts` when they parse; empty stays empty. Step schema validates the converted canonical values (AC5 boundaries). Errors give limits in the chosen unit. Offline (`useIsOnline() === false`): `OfflineNotice` above the buttons and Finish disabled.
- `OnboardingLogOutButton`: reuses `LogOutButton` with `variant="ghost"`, `size="sm"`.

Shared pieces used by onboarding and the Edit sheet live in `src/features/profile/` (same domain), and onboarding imports them:

### Feature `src/features/profile/`

- `fields/` (internal folder, exported through `src/features/profile/index.ts` only what onboarding needs): `AvatarEmojiPicker`, `AvatarColorPicker`, `BirthDateInput`, `HeightInput`, `WeightInput`, `UnitToggle`, `SexToggle`, plus `useProfileFieldError()` (maps `PROFILE_FIELD_ERROR` codes to translated messages with the min/max of the current unit) and `profileFormSchema(unitSystem)` helpers in `form.ts` (string inputs → canonical values).
- `ProfileView/ProfileView.tsx` (`'use client'`, entry): `useProfileQuery({ initialData })`. Shows `PageHeader` `Profile`, `EmojiAvatar size="lg"`, name, then rows Age (`{{count}} years`), Height (`180 cm` or `5′11″`), Weight (`79.8 kg` / `175.9 lb`, numbers through `useFormat().number` with `maximumFractionDigits: 1`, `—` when `latestWeightKg` is null). Buttons: Edit profile (opens the sheet), `LogOutButton`.
- `EditProfileSheet/EditProfileSheet.tsx`: `Sheet` with `side="bottom"` below 1024px and `side="right"` from 1024px (`matchMedia`, default bottom). One RHF form with all fields, default values from the profile in its unit system. Save:
  - disabled until `formState.isDirty`;
  - builds the body from `dirtyFields` only, converts to canonical units and drops a field whose canonical value equals the stored one (a unit toggle that only converts values sends just `unitSystem`; converting without editing must not send the weight). Toggling units sets the converted values with `shouldDirty: false`;
  - `useUpdateProfileMutation`, `inFlight` ref, pending label `Saving…`;
  - success: close the sheet, `toast(t('Profile saved'))`;
  - `VALIDATION_FAILED` details → field errors; other errors → generic alert above Save;
  - offline: notice and Save disabled.
- `ProfileSkeleton/`: avatar circle and three row skeletons.

### Generic components

- `src/components/SegmentedControl/`: a radio group (`role="radiogroup"`, each option `role="radio"` with `aria-checked`, arrow-key navigation, 44px min height, pill style with `--accent-soft` for the selected one). Props: `label`, `options: { value, label }[]`, `value`, `onChange`, `aria-describedby`. Used for sex and units. (Built on native radio inputs or `shadcn add radio-group`; `radix-ui` is already a dependency, so either adds no package.)
- `src/components/OfflineNotice/` if the auth offline notice is not already reusable; otherwise reuse it.

### Log out

`LogOutButton` gains optional `variant`/`size` props and, before `signOut()`, removes every `localStorage` key starting with `pampojo:onboarding:` (in `try/catch`). This covers log out from `/profile` and from the onboarding header (AC2).

### Layout

- Onboarding mobile: `px-4`, content scrolls, the Back / Continue row is `sticky bottom-0` with `pb-[max(1rem,env(safe-area-inset-bottom))]` and the page background. Back is a secondary button (hidden on step 1), Continue/Finish the primary button, both `size="lg"`.
- Onboarding desktop (≥ 1024px): the step sits in a `Card` centered horizontally and vertically, `max-w-[480px]`, buttons inside the card (not sticky).
- Emoji grid: 6 columns with `gap-2` fits 390 − 32px gutter (6 × 48 + 5 × 8 = 328px ≤ 358px).
- Profile: single column `max-w-[600px]`, same container as the `/today` placeholder.
- Focus: desktop only, focus the first field of the step on mount (same `(min-width: 1024px)` check as `CredentialsForm`).

## 7. Copy

Keys are the English strings. Add both catalogs; run `pnpm i18n:extract`, then `pnpm i18n:check`.

| Where | en | uk |
| --- | --- | --- |
| Meta title, onboarding | Welcome · Pampojo | Вітаємо · Pampojo |
| Meta title, profile | Profile · Pampojo | Профіль · Pampojo |
| Progress | Step {{step}} of 3 | Крок {{step}} з 3 |
| Back | Back | Назад |
| Continue | Continue | Далі |
| Finish | Finish | Готово |
| Finish pending | Finishing… | Зберігаємо… |
| Header log out | Log out | Вийти (existing key) |
| Step 1 title | What should we call you? | Як до тебе звертатися? |
| Step 1 subtitle | Pick a name and an avatar. | Обери ім'я та аватар. |
| Name label | Name | Ім'я |
| Name placeholder | Your name | Твоє ім'я |
| Emoji group name | Avatar | Аватар |
| Color group name | Background color | Колір фону |
| Color names | Peach / Apricot / Butter / Sage / Mint / Sky / Lavender / Rose | Персиковий / Абрикосовий / Вершковий / Шавлієвий / М'ятний / Небесний / Лавандовий / Рожевий |
| Step 2 title | A bit about you | Трохи про тебе |
| Step 2 subtitle | Used for body stats like BMI. | Потрібно для показників тіла, як-от ІМТ. |
| Sex label | Sex | Стать |
| Sex options | Male / Female | Чоловік / Жінка |
| Birth date label | Date of birth | Дата народження |
| Birth date fields (labels and placeholders) | DD / MM / YYYY | ДД / ММ / РРРР |
| Step 3 title | Height and weight | Зріст і вага |
| Step 3 subtitle | You can change these later in your profile. | Їх можна змінити пізніше в профілі. |
| Unit toggle label (accessible) | Units | Одиниці |
| Unit options | Metric / Imperial | Метрична / Імперська |
| Height label | Height | Зріст |
| Weight label | Weight | Вага |
| Unit suffixes | cm / kg / ft / in / lb | см / кг / фт / дюйм / фн |
| Error: name required | Enter your name | Введи ім'я |
| Error: name too long | Name must be at most 40 characters | Ім'я має містити не більше 40 символів |
| Error: sex required | Choose one | Обери варіант |
| Error: invalid date | Enter a valid date | Введи коректну дату |
| Error: too young | You must be at least 16 to use Pampojo | Тобі має бути щонайменше 16 років |
| Error: too old | Age must be 100 or less | Вік має бути не більше 100 років |
| Error: height | Enter a height between {{min}} and {{max}} | Введи зріст від {{min}} до {{max}} |
| Error: weight | Enter a weight between {{min}} and {{max}} | Введи вагу від {{min}} до {{max}} |
| Error: generic | Something went wrong. Try again. | Щось пішло не так. Спробуй ще раз. (existing key) |
| Offline notice | You're offline. Connect to the internet to save. | Ти офлайн. Під'єднайся до інтернету, щоб зберегти. |
| Profile page title | Profile | Профіль |
| Profile rows | Age / Height / Weight | Вік / Зріст / Вага |
| Age value (plural) | `{{count}} years`: _one `{{count}} year`, _other `{{count}} years` | _one `{{count}} рік`, _few `{{count}} роки`, _many `{{count}} років`, _other `{{count}} року` |
| Missing weight | — | — (not a key) |
| Edit button / sheet title | Edit profile | Редагувати профіль |
| Save / pending | Save / Saving… | Зберегти / Зберігаємо… |
| Cancel | Cancel | Скасувати |
| Toast | Profile saved | Профіль збережено |
| `/today` link | Profile | Профіль |

`{{min}}`/`{{max}}` values: metric `100 cm`/`250 cm`, `30 kg`/`300 kg`; imperial `3′4″`/`8′2″`, `67 lb`/`661 lb` (number + translated suffix, built in `useProfileFieldError`).

## 8. Steps

1. **Constants and helpers.** `src/constants/profile.ts`, `src/constants/measurement.ts`, `src/lib/units.ts`, `src/lib/dates.ts`, `src/shared/schemas/utils.ts` (if missing), with their unit tests.
2. **Schemas.** `src/shared/schemas/profile.ts` + tests.
3. **Tables and migration.** `src/server/db/schema/profile.ts`, `measurement.ts`, `index.ts`, `src/server/db/utils.ts` (`touch`). `pnpm db:generate`, review the SQL, `pnpm db:migrate`.
4. **Server.** `src/server/profile/{errors,queries,service,request-onboarding}.ts`, `PROFILE_NOT_FOUND` in `src/server/http/errors.ts`, `src/app/api/v1/me/profile/route.ts`. Service and handler tests.
5. **Client data layer.** `pnpm add @tanstack/react-query`; `src/api/http.ts`, `query-client.ts`, `QueryProvider.tsx`, `profile.ts`; provider in `src/app/[lang]/layout.tsx`; `src/test/render.tsx` and `src/test/mocks.ts` updates; `http.ts` tests.
6. **Gate and routes.** `src/proxy.ts` (`/profile`), `(app)/session-gate.tsx` (onboarding check), `onboarding/layout.tsx` + `page.tsx` (with a placeholder flow), `(app)/profile/page.tsx` (placeholder view), `/today` placeholder link.
7. **Shared fields.** `src/components/SegmentedControl`, `src/features/profile/fields/*`, `form.ts`, `useProfileFieldError`.
8. **Onboarding flow.** `src/features/onboarding/OnboardingFlow` + steps + `useOnboardingDraft`; `LogOutButton` props and draft cleanup.
9. **Profile view and edit.** `src/features/profile/ProfileView`, `EditProfileSheet`, `ProfileSkeleton`.
10. **Copy.** `pnpm i18n:extract`, fill `uk` from section 7, `pnpm i18n:check`.
11. **E2E.** `e2e/04-onboarding-profile.spec.ts`; update `e2e/03-auth.spec.ts` where it expects to land on `/today` after sign-up or log in (now `/onboarding` for new users) and where it clicks Log out on `/today`.
12. **Docs.** `docs/tech/DATA_MODEL.md` details (section 3), `README` if it lists routes. Run `pnpm lint`, `pnpm typecheck`, the touched tests.

## 9. Tests

| AC | Test |
| --- | --- |
| AC1 | `src/features/onboarding/OnboardingFlow/__tests__/OnboardingFlow.test.tsx`: empty name → Continue disabled, a radio is checked in both avatar groups, typing enables Continue; `prefillName` fills the field. `src/server/profile/__tests__/service.test.ts`: `getOnboardingPrefill` returns the name only with a Google account. e2e: sign up → `/onboarding` step 1. |
| AC2 | `OnboardingFlow.test.tsx`: Back/Continue keep values; remounting with the same `localStorage` restores step and values; invalid stored JSON starts fresh. `src/features/auth/LogOutButton/__tests__/LogOutButton.test.tsx`: removes `pampojo:onboarding:*` keys. e2e: reload on step 2 keeps values. |
| AC3 | `src/server/profile/__tests__/service.test.ts` (real DB, `test-profile-` users): `completeOnboarding` creates profile + one weight + sets `user.name`; a second call → still one profile, one weight, unchanged values; two concurrent calls (`Promise.all`) → one weight. `src/app/api/v1/me/profile/__tests__/route.test.ts`: `PUT` 200 twice. e2e: finish → `/today`. |
| AC4 | e2e `04-onboarding-profile.spec.ts`: new user on `/today` and `/profile` → `/onboarding`; login with `?next=/profile` for a new user → `/onboarding`; completed user on `/onboarding` → `/today`; no cookie → `/login?next=%2Fonboarding` and `%2Fprofile`. |
| AC5 | `src/shared/schemas/__tests__/profile.test.ts` (name trim and 40/41, sex, `2000-02-31`, height and weight bounds, strict keys, empty PATCH). `src/lib/__tests__/dates.test.ts` (`ageOn`, `validateAge` on the day before / of the 16th birthday, 101, Feb 29 birthdays). Step component tests show each message under its field after Continue. `route.test.ts`: 400 for too young on `PUT` and on `PATCH`. |
| AC6 | `src/lib/__tests__/units.test.ts` (the four conversions, imperial boundaries 3′3″/3′4″/8′2″/8′3″, 66/67/661/662 lb, `parseDecimal('79,8')`). `HeightWeightStep` test: toggling converts typed values. `ProfileView.test.tsx`: imperial profile shows `5′11″` and lb. |
| AC7 | `ProfileView.test.tsx` / `EditProfileSheet.test.tsx` (mock `@/api/profile`): rows render; Save disabled until a change; changing only the name sends `{ displayName }`; toggling units only sends `{ unitSystem }`; success closes the sheet and shows the toast. `service.test.ts`: two same-day weight updates → one row with the last value; a row dated yesterday + update → two rows; name change updates `user.name`. |
| AC8 | `route.test.ts`: 401 without a session on all three; `GET`/`PATCH` 404 `PROFILE_NOT_FOUND` before onboarding; user B's `GET` returns 404 while user A has a profile; `PATCH {}` → 400. |
| AC9 | `OnboardingFlow.test.tsx` and `EditProfileSheet.test.tsx` with `navigator.onLine` mocked false + `offline` event: notice visible, Finish/Save disabled; step 1 Continue works. e2e: `context.setOffline(true)` on step 3. |
| AC10 | e2e: Log out from `/profile` and from the onboarding header → `/`; `/today` has a `Profile` link and no Log out button. |
| AC11 | e2e at `mobile` and `desktop` projects in `en` and `uk`: section 7 headings visible, `scrollWidth <= innerWidth`, bounding boxes of buttons, radios and inputs ≥ 44px, sticky buttons at the viewport bottom on mobile, card width ≤ 480 on desktop. |

`src/api/__tests__/http.test.ts`: error envelope → `ApiError`; network error retried twice on `GET`/`PUT`, not on `PATCH`; 400 not retried.

## 10. Risks and open questions

- **`numeric` mode.** If drizzle 0.45 lacks `mode: 'number'` for `numeric`, values arrive as strings; convert in `queries.ts` (section 3).
- **Hydration.** The random avatar and the draft come from `localStorage`, so `OnboardingFlow` renders a skeleton until mounted. Do not compute random values during render.
- **Time zone edge.** The client checks age against the device date and the server against `todayIn(timeZone)`; near midnight they can differ by a day. The server answer wins and is mapped to the field error.
- **`user.name` written outside Better Auth.** The update goes straight to the `user` table. Better Auth's cookie cache is off, so `getSession` reads the new name on the next request.
- **Existing users without a profile** (test accounts from spec 03) are sent to onboarding. Intended.
- **e2e 03 changes.** New users now land on `/onboarding`; update those expectations in step 11, not the product behavior.
- **Later specs:** Today greeting with avatar (05) reads `useProfileQuery`; the navigation replaces the `/today` Profile link (05); measurement endpoints, history and BMI (14); client-generated measurement ids (16); the offline log-out guard (17).

## 11. Implementation notes

- **Versions.** `@tanstack/react-query` 5.107.1. Drizzle 0.45 supports `numeric({ mode: 'number' })`, so no string conversion is needed.
- **Migration** `0001_strange_dracula.sql`: two tables, two FKs (cascade), the checks, one index, no drops. Applied to the shared database with `pnpm db:migrate`. Check constraints inline their allowed values through `src/server/db/schema/utils.ts` (`inList`).
- **Postgres pool fix (outside the plan).** Under parallel requests (about 6+ at once), queries hung forever. Postgres showed backends `active / ClientRead` for minutes, and every later request on the server stalled. Cause: when the pool of 5 is busy, postgres.js pipelines queries onto busy connections, and the Supabase transaction pooler stalls on them. This spec adds one query per `(app)` request (onboarding gate), so the e2e suite hit it. Clean `main` passes, but has the same latent bug. Fix: `max_pipeline: 1` in `src/server/db/client.ts`. Verified with 10 parallel sign-up + `/today` flows on a pool of 5 and with the full e2e suite. This needs the lead's confirmation (it touches the "Postgres driver" decision).
- **One form for the whole onboarding.** `OnboardingFlow` uses one RHF form. A resolver reads the current step from a ref and validates only that step's group. `form.reset(values)` between steps clears the submitted state, so the next step shows no errors before its own Continue.
- **Grouped errors.** The birth date error lives on `birthDay`, and the imperial height error on `heightFt`. Editing month or year triggers `birthDay`. `heightIn` has `deps: ['heightFt']`. Without this, a fixed date kept its old error.
- **Field components** are in `src/features/profile/fields/` (`NameAvatarFields`, `SexBirthDateFields`, `BodyFields`), not one file per input as the plan listed. They take the RHF form and an id prefix, so onboarding and the Edit sheet share them.
- **Avatar and segmented radios** are native `input[type=radio]` inside labels (arrow keys and names for free). `aria-invalid` is not allowed on radios (jsx-a11y); the error is linked to the fieldset with `aria-describedby`.
- **Color names** use the i18n `color` context (`Peach_color`, …), because "Peach" is also an avatar emoji with a different Ukrainian word.
- **Server-side age errors** are a `DomainError('VALIDATION_FAILED')` with Zod-shaped `details` (`path: ['birthDate']`, `message: 'too_young'`). `fieldErrorsFromIssues` maps them to form fields. Onboarding jumps back to the step that owns the field.
- **Edit sheet Save** is disabled until `isDirty`. If the computed body is empty (values typed back to the stored ones), Save closes the sheet without a request.
- **`navigateAfterAuth`** (full page load) is reused after Finish, instead of a raw `window.location.assign` (lint rule, same reason as spec 03).
- **Onboarding layout** has its own header (wordmark + ghost `LogOutButton`) in `onboarding/layout.tsx`. The gate is in `page.tsx` inside `Suspense`, because reading the session must stay out of the static shell.
- **e2e isolation (also fixes 03).**
  - `afterAll` runs once per worker. The mobile and desktop projects run the same file in parallel, so `deleteE2eUsers('e2e-%')` from one worker deleted the other worker's users.
  - Each file now owns a prefix plus a per-worker run id (`e2eRunPrefix`) and an IP range: 03 uses `198.51.100.x`, 04 uses `192.0.2.x`.
  - Pages from `browser.newPage()` now send the test's `x-forwarded-for`. Before, they all shared one IP and hit the 10/min sign-in limit.
  - In 03, `signUp` and the copy test now finish onboarding through `PUT /api/v1/me/profile` (`e2e/helpers/onboarding.ts`), and log out happens on `/profile`.
- **Checks:**
  - lint, typecheck, format:check, i18n:check: pass.
  - `pnpm test`: 34 files, 196 tests passed.
  - `CI=1 pnpm exec playwright test` on the production build: 80 passed, 2 skipped (viewport-specific tests in 02).
  - Under parallel e2e, the dev server reloads and stalls by itself, so e2e was run against `pnpm start` like CI.

## 12. Review — 2026-11-10

**Verdict:** Pass with notes. Every AC works, but a few notes need a fix or the lead's call: the color swatch overlap on phones (finding 1), the pool fix (2), and the flaky auth test (3).

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass | `OnboardingFlow.test.tsx` (random avatar, empty name, Continue disabled, prefill); `service.test.ts` "prefills the name only for Google users"; walk: Continue disabled on a fresh sign-up; `AC1-{mobile,desktop}-step1-empty.png` |
| AC2 | Pass | `OnboardingFlow.test.tsx` (Back/Continue, restore after remount, broken draft); `LogOutButton.test.tsx` (drafts removed); e2e "reload … keeps values", "log out from the onboarding header clears the draft"; `AC2-*-reload-step2.png` |
| AC3 | Pass | `service.test.ts` (profile + one weight + `user.name`; sequential and concurrent repeats leave one weight); `route.test.ts` (`PUT` twice → same body); walk: stored `180.3 cm`, `79.8 kg`, `imperial`; `AC3-*-server-error.png` (generic error, draft kept) |
| AC4 | Pass (Google not testable) | e2e "users without onboarding are sent to it…", "without a session…"; walk: new user `/profile` → `/onboarding`, completed user `/onboarding` → `/today`. Google sign-in has no OAuth client yet; it goes through the same `(app)` gate. |
| AC5 | Pass | `profile.test.ts`, `dates.test.ts`, `units.test.ts` boundaries; `OnboardingFlow.test.tsx` step 2/3 messages; `route.test.ts` 400 on `PUT`/`PATCH`; `AC5-*-name-too-long.png`, `AC5-*-step2-errors.png`, `AC5-*-invalid-date.png`, `AC5-*-too-young.png`, `AC5-*-step3-errors.png`, `AC5-*-edit-sheet-error.png` |
| AC6 | Pass | `units.test.ts` (5′11″ → 180.3, 176 lb → 79.8, 180 cm → 5′11″, 79.8 kg → 175.9 lb); `OnboardingFlow.test.tsx` "converts typed values"; `ProfileView.test.tsx` imperial; `AC6-*-imperial-errors.png`, `AC6-*-imperial-filled.png`, `AC7-*-profile-imperial.png` |
| AC7 | Pass | `ProfileView.test.tsx` (rows, Save disabled, name-only / units-only / weight-only bodies, toast, sheet closes); `service.test.ts` same-day vs. other-day weight; walk: `PATCH {"weightKg":81.6}` for 180 lb; `AC7-*-edit-sheet*.png`, `AC7-*-saved-toast.png` |
| AC8 | Pass | `route.test.ts` (401 on all three, 404 `PROFILE_NOT_FOUND`, another user's `GET` → 404, `PATCH {}` → 400); every query in `src/server/profile/queries.ts` filters by `userId` |
| AC9 | Pass | `OnboardingFlow.test.tsx`, `ProfileView.test.tsx` offline cases; e2e "offline blocks Finish…"; `AC9-*-step3-offline.png`, `AC9-*-sheet-offline.png` |
| AC10 | Pass | e2e "the /today placeholder links to the profile…", full flow log out → `/`; walk: onboarding header "Вийти" → `/`; `AC10-*-today.png` |
| AC11 | Pass with note | e2e layout tests (en, uk; no overflow; ≥ 44px; sticky buttons; card ≤ 480px); `AC11-*-onboarding-uk.png`. On 390px the color swatches overlap (finding 1). |

Screenshots: `scratch/review/04-onboarding-profile/` (git-ignored).

### Findings

1. [major] The color swatches overlap at 390px: `src/features/profile/fields/NameAvatarFields.tsx:94-98`.
   - Math: 8 × 44px + 7 × 4px gaps = 380px, but the column is 358px wide. The circles touch and overlap (`AC11-mobile-onboarding-uk.png`, `AC7-mobile-edit-sheet.png`).
   - The selected ring covers its neighbours, so the real tap area is below 44px.
   - The e2e size check measures each label alone, so it misses this.
   - Fix: two rows of 4, or a 6-column grid like the emoji.
2. [major, needs the lead] The pool change in `src/server/db/client.ts:15-21` (`max_pipeline: 1`) is outside the plan.
   - It fixes a real hang that `main` also has under about 6+ parallel requests: postgres.js pipelining through the Supabase transaction pooler. Evidence is in Implementation notes.
   - It touches the "Postgres driver" decision, so it needs the lead's yes and a `DECISIONS.md` entry before merge.
3. [minor] A flaky auth test: `src/server/auth/__tests__/auth-api.test.ts:90`.
   - "refuses an email that already exists" compares the count of all `user` rows before and after.
   - The new `test-profile-*` files create and delete users in parallel, so the full `pnpm test` failed once in two runs. Alone it passed three times out of three.
   - Fix: count only rows with that email.
4. [minor] The Edit sheet focuses the name input on open on phones too: `src/features/profile/EditProfileSheet/EditProfileSheet.tsx:55`.
   - Radix `onOpenAutoFocus` runs by default, so the keyboard opens over the sheet (`AC7-mobile-edit-sheet.png` shows the name selected).
   - The spec's UX says "first field focused on desktop only".
5. [minor] A weight or height error in the mobile Edit sheet can sit under the sticky footer: `EditProfileSheet.tsx:123`.
   - After Save, the error text is hidden until the user scrolls (`AC5-mobile-edit-sheet-error.png`).
   - Scroll the first invalid field into view, or focus it (`shouldFocusError` works only for registered inputs that are rendered).
6. [minor] Log out removes the onboarding draft before `signOut()` succeeds: `src/features/auth/LogOutButton/LogOutButton.tsx:35`.
   - On a network failure the user stays signed in but loses the draft.
   - Clear it after a server response instead.
7. [minor] Type assertions that a narrowing could replace: `OnboardingFlow.tsx:164-165,176` (`as OnboardingStep`), `BodyFields.tsx:85` (`key as ProfileFormField`). The TypeScript guide says to avoid `as`.
8. [minor, process] The working tree also holds the unrelated env fix (`src/server/env-schema.ts`, `src/server/__tests__/env.test.ts`). Commit it separately, so this spec's PR has only spec 04 changes.

The diff has no secrets, `.env*` files or build output. Comments are short and say why.

### Checks

- lint: pass.
- typecheck: pass.
- tests:
  - `pnpm test`: 34 files, 195 of 196 passed. The one failure was finding 3, and that file passed three times out of three alone.
  - The earlier full run passed all 196.
- e2e:
  - `pnpm test:e2e e2e/03-auth.spec.ts e2e/04-onboarding-profile.spec.ts` on the lead's dev server: 38 passed.
  - Full suite on the production build earlier today: 80 passed, 2 skipped.
- UI walk:
  - A Playwright script at 390×844 and 1440×900, in `en` (plus `uk` for step 1).
  - States covered: empty, field errors, invalid and underage dates, reload, imperial, offline (step 3 and the sheet), server error, saved toast, log out from both places.
  - Test users `e2e-review-*` and the `203.0.113.*` rate-limit rows were deleted afterwards.

### Out of scope

- The Ukrainian unit suffix `фн` for pounds may read oddly; `lb` is common in Ukrainian gym apps (copy decision for the lead).
- `/today` and `/profile` render nothing while the `(app)` gate loads (`fallback={null}`, spec 03 note). Spec 05 should give the shell a skeleton.
- The main deploy needs `BETTER_AUTH_URL` in Vercel Production (spec 03 env rule). This is unrelated to this spec's code.

## 13. Review fixes — 2026-11-10

The lead asked to fix every finding in section 12 and approved `max_pipeline: 1`.

- **1. Color swatches.** Two rows of 4 below 640px, one row of 8 from 640px (`NameAvatarFields.tsx`). The swatch ring offset went from 2px to 1px, so the selection ring of a 44px swatch fits the 8px gap in the 416px desktop card. The spec's step 1 text was updated to match. New e2e check `overlappingSwatches` asserts at least 8px between swatches at both viewports.
- **2. Pool.** `max_pipeline: 1` kept, logged in `DECISIONS.md` ("No query pipelining on the transaction pooler").
- **3. Flaky auth test.** `auth-api.test.ts` now counts only the rows with the duplicate email.
- **4. Sheet focus.** `onOpenAutoFocus` is prevented below 1024px, and focus goes to the dialog itself; desktop still focuses the name. Tests: "does not focus the name on a phone", "focuses the name on desktop".
- **5. Hidden errors.**
  - `scrollToFirstError` (`src/features/profile/scrollToFirstError.ts`) centers the first invalid field after a failed Continue, Finish or Save, and after server field errors.
  - Used in the Edit sheet and in onboarding.
  - Test: "scrolls a field error into view above the buttons on a phone".
- **6. Draft on log out.** Drafts are cleared after `signOut()` answers, not before. On a network failure the draft stays. Tests cover both cases.
- **7. Assertions.**
  - `NEXT_STEP` / `PREV_STEP` maps replace the `as OnboardingStep` casts.
  - The earliest step with an error is picked without casting.
  - `BodyFields` loops over a typed `BODY_FIELDS` tuple.
- **8. Env fix.** It is still in the working tree, waiting for the lead's call on how to commit it.
- **Checks:**
  - lint, typecheck, format:check, i18n:check: pass.
  - `pnpm test`: 34 files, 200 tests passed.
  - `pnpm test:e2e e2e/03-auth.spec.ts e2e/04-onboarding-profile.spec.ts` (dev server): 38 passed.
