# 25. Muscle map picker

## Goal

A visual way to find exercises: tap muscles on a body figure and get suggestions for them, in the library and during a session.

## Scope

- Original front and back body figure as SVG with one region per `MUSCLE_GROUPS` value; selectable regions with hover/pressed states and labels; keyboard and screen-reader accessible (each region is a toggle button).
- Entry points: Library → Exercises ("Pick on body"), and the Start sheet ("Train a muscle now").
- Result: exercises that hit the selected muscles, filtered by gym profile, ranked by the substitution scoring; optional "Ask AI" note for a short combination (online only).
- Works offline for the deterministic part.

## Acceptance criteria

- [ ] AC1: Every muscle group in the constants has exactly one region on the figure.
- [ ] AC2: Selecting chest + triceps lists exercises with both as primary first.
- [ ] AC3: The figure is usable at 390px and with keyboard only.
- [ ] AC4: Works offline without the AI part.

## Depends on

18, 20.
