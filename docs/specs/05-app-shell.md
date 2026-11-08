# 05. App shell and navigation

## Goal

The frame every in-app screen lives in: navigation, top bar and a first Today screen.

## Scope

- `(app)/layout.tsx` with auth guard and onboarding guard.
- Mobile bottom bar: Calendar, Library, central Start (accent rounded square), Progress, Profile. Active item highlighted (`aria-current`). Safe-area insets for iPhone home indicator.
- Desktop (≥ 1024px): left sidebar with logo, Start workout button, the same sections; content area max width.
- Top bar: page title, `StatusPill` (online/offline from `navigator.onLine` only; pending count arrives in spec 17).
- Start button behavior: if a session is in progress → resume it; else if a workout is planned today → start it (after spec 11); else open a "Choose workout" sheet listing workouts (after spec 09). Until those specs land, the sheet shows an empty state with "Create workout".
- Placeholder pages for Calendar, Library, Progress with empty states.
- Today first version: greeting with avatar, empty state "Create your first workout" → Library.

## Out of scope

Today's real data (spec 12), offline pending count (spec 17).

## Acceptance criteria

- [ ] AC1: Mobile shows the bottom bar on all `(app)` routes and hides it on `/session/*`.
- [ ] AC2: Desktop shows the sidebar instead of the bottom bar; no layout jump between 1023 and 1024px beyond the switch.
- [ ] AC3: Navigation items are links with accessible names and `aria-current` on the active one; keyboard navigation works.
- [ ] AC4: The status pill switches to Offline when the browser goes offline and back to Online.
- [ ] AC5: Start opens the choose-workout sheet with the empty state.
- [ ] AC6: Today shows the greeting with the user's name and emoji avatar.
- [ ] AC7: A user who has not finished onboarding is sent to `/onboarding`.

## Depends on

04.
