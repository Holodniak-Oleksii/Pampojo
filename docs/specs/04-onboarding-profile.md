# 04. Onboarding and profile basics

## Goal

Collect the few details the app needs (name, avatar, sex, age, height, weight) in a quick flow, and let the user edit them later.

## Scope

- `profile` table (see `DATA_MODEL.md`); the first weight goes to `body_measurement` (type `weight`), so this spec creates that table too.
- `/onboarding`, 3 steps with a progress indicator, Back and Continue:
  1. Name and emoji avatar (grid of emoji on colored circles; no photo upload).
  2. Sex (male / female) and age (stored as birth year).
  3. Height and weight, metric by default with an imperial toggle.
- Time zone captured from the device.
- Skippable fields: decide in drill. Name and avatar are required.
- `onboardingCompletedAt` set on finish; redirect to `/today`.
- Extend spec 03's post-auth redirect: a signed-in user without `onboardingCompletedAt` goes to `/onboarding` from sign-up, log in, Google sign-in and protected `(app)` routes.
- Replace the temporary `user.name` (email local part, set in spec 03) with the onboarding name.
- Move Log out from the `/today` placeholder (spec 03) to `/profile`.
- `/profile` first version: avatar, name, age, height, latest weight, Edit profile sheet with the same fields, Log out.
- `GET/PATCH /api/v1/me/profile`.

## Out of scope

BMI and measurements history (spec 14), gym equipment (spec 08), language setting.

## Acceptance criteria

- [ ] AC1: A new user after sign up lands on step 1; Continue is disabled until name and avatar are set.
- [ ] AC2: Values persist between steps and after a page reload mid-onboarding.
- [ ] AC3: Finishing saves profile and first weight and redirects to `/today`; revisiting `/onboarding` afterwards redirects to `/today`.
- [ ] AC4: Validation: age 13–100, height 100–250 cm, weight 30–300 kg (or imperial equivalents); errors show under fields.
- [ ] AC5: Imperial input is converted and stored in kg/cm; the profile shows values in the chosen unit system.
- [ ] AC6: Profile edit updates only changed fields.
- [ ] AC7: Works at 390px with large touch targets; on desktop the flow is a centered card.

## Depends on

03.

## Open questions

- Can sex, age, height or weight be skipped? If yes, what do BMI and other features show?
- Minimum age policy (13 or 16 in the EU)?
