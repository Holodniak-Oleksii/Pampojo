# 21. AI workout generation

## Goal

A user describes what they want and gets a workout draft built only from exercises available to them.

## Scope

- Library → Workouts → "Generate with AI" (online only).
- Form: goal (strength, hypertrophy, endurance, general fitness), focus muscles (optional), duration (30–120 min), level, free-text wishes; gym profile applied automatically.
- Server: filter catalog (system + own, equipment available) → compact list (`id`, name, muscles, pattern, equipment, tracking type) → `generateStructured` with the workout draft schema (catalog ids) → checks: ids in the list, equipment available, estimated duration within ±15% of the request, primary muscles cover the focus.
- The draft opens in the workout builder as unsaved, with an "AI draft" badge; the user edits and saves. Regenerate keeps the form values.
- Prompt `prompts/workout-generation/v1.md`; evals with at least 20 cases.

## Out of scope

Generating a whole calendar plan (later), multi-week programs.

## Acceptance criteria

- [ ] AC1: Every generated exercise exists in the user's available catalog; equipment checks pass.
- [ ] AC2: Estimated duration is within the tolerance or the response is repaired or rejected with a message.
- [ ] AC3: The draft is not saved until the user saves it in the builder.
- [ ] AC4: Evals pass rate ≥ the threshold set in drill (suggested 90%).
- [ ] AC5: Errors (timeout, limit, invalid output twice) show a clear message and keep the form.

## Depends on

20, 09.
