# Screens and navigation

Mobile-first. Desktop reuses the same routes with a wider layout.

## Navigation

- **Mobile:** charcoal bottom bar with Calendar, Library, a large central "Start workout" button, Progress, Profile (icons only). The app icon in the top bar links to Today.
- **Desktop:** left sidebar with the wordmark, "Start workout" as the primary button, then Today and the same sections.
- **Top bar:** page title and the online/offline pill with the pending-changes count, on every in-app screen.
- Session mode hides the navigation.

## Routes

| Route | Screen | Spec |
| --- | --- | --- |
| `/` | Landing for visitors; redirects to `/today` with a session | 02 |
| `/login`, `/signup` | Auth | 03 |
| `/forgot-password`, `/reset-password` | Password reset | 27 |
| `/onboarding` | 3–4 steps: name and avatar, sex and age, height and weight | 04 |
| `/today` | Next planned workout, week strip, adherence, last session | 05, 12 |
| `/library/workouts` | Workouts list, create, import | 09, 19 |
| `/library/workouts/[id]` | Workout builder / editor | 09 |
| `/library/exercises` | Catalog with search and muscle filters | 06, 07 |
| `/library/exercises/[id]` | Exercise details | 06 |
| `/session/[id]` | Active session, full screen | 10, 18 |
| `/calendar` | Month calendar, plan, history, day details | 11, 12 |
| `/progress` | Strength charts, records | 13 |
| `/profile` | Avatar, BMI, measurements, settings, sync status, logout | 04, 08, 14, 17 |
| `/profile/gym` | Gym equipment profile | 08 |
| `/s/[token]` | Shared workout preview and import | 19 |

## Screen notes

**Today.** Greeting with emoji avatar. Card with today's planned workout and a big Start. Week strip (done, done late, missed, planned). Adherence this month. Last session summary. Empty state with "Create your first workout".

**Session.** Header: workout name, elapsed time, Finish. Current exercise: name, small image, previous result. Set rows: weight, reps, check. Rest timer with -15s / +15s. Add set, Swap exercise, next exercises list. Touch targets at least 48px. Screen kept awake where supported.

**Calendar.** Month grid with status dots, legend, adherence summary, "Schedule workout" with repeat options, selected day details. Toggle to a list view of past sessions.

**Library.** Tabs Workouts / Exercises. Search, muscle chips. Workout cards with exercise count, duration estimate, share icon; imported ones show "From <name>".

**Profile.** Emoji avatar, name, age. BMI card with scale and weight trend. Measurements list with latest value and change. Settings: gym equipment, units, language. Sync block. Log out.

## Reference images

See `docs/wireframes/`. The landing reference sets the visual direction; the logo in it is wrong, use `docs/brand/`.
