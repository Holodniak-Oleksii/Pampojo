# 08. Gym equipment profile

## Goal

The user records what equipment their gym has once, so substitution and AI generation suggest only exercises they can do.

## Scope

- `gym_profile` table, `GET/PUT /api/v1/me/gym`.
- `/profile/gym`: equipment grouped (free weights, machines, cables, benches and racks, cardio, other) as toggle chips with icons; "Select all" per group.
- Optional step at the end of onboarding is not included; instead a card on Profile and Today nudges "Set up your gym" until saved.
- Catalog gets an "Available in my gym" filter.

## Out of scope

Several gyms per user.

## Acceptance criteria

- [ ] AC1: Saving the profile persists the selection; reopening shows it.
- [ ] AC2: "Available in my gym" hides exercises that need equipment not selected; bodyweight exercises always stay.
- [ ] AC3: The nudge card disappears after the first save.
- [ ] AC4: Chips are toggle buttons with `aria-pressed`.

## Depends on

06.
