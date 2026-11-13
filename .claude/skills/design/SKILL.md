---
name: design
description: Design the screens and states of a drilled spec as mockups with the lead, using the frontend-design skill inside the project's visual language, then record the result in the spec. Step 2 of the spec workflow.
argument-hint: <spec name or number, e.g. 09-workout-builder or 09>
disable-model-invocation: true
---

# /design — design a spec

Goal: every screen and state the spec touches has an agreed mockup, and the spec's "Design" section says enough that `/scratch` can plan the UI without guessing. You design and write docs only, never product code.

Talk to the lead in Ukrainian. Write everything in files in English; mockup copy uses the real uk/en strings.

## 1. Check the input

- Resolve `$ARGUMENTS` to one file in `docs/specs/`.
- If the spec still has open questions, stop and tell the lead to run `/drill` first.
- If the spec has no user-facing surface, write `## Design` with "No UI." and tell the lead the next step is `/scratch`.
- If the spec already has a `## Design` section, read it and ask whether to revise it or start over.

## 2. Load the design guidance

- Load the `frontend-design` skill with the Skill tool and follow its process.
- `docs/tech/VISUAL_LANGUAGE.md` is the brief's fixed direction: palette, type, shape, the diamond, motion, copy rules and the rejected directions. The skill's freedom applies only inside it. Do not invent a new palette, typeface or shape language for one feature.

## 3. Read the context

1. The spec, especially UX, Copy and Acceptance criteria, and the specs it depends on.
2. `DECISIONS.md`.
3. `docs/tech/VISUAL_LANGUAGE.md` and `docs/tech/DESIGN_SYSTEM.md`.
4. `docs/product/SCREENS.md` and `USER_FLOWS.md` for the screens involved.
5. The existing UI the spec changes: read the components in `src/`, and if useful take screenshots of the running app at 390×844 and 1440×900.

## 4. Mock up

- Make the mockups on one Design canvas per spec (Artifact tool, `quickstart` with intent "design"; one artboard per screen and state). If the spec revises a screen that already has a canvas, add a row to that canvas instead.
- Cover every screen and state the spec lists: filled, empty, loading, error, offline, and any spec-specific state. Do mobile 390×844 for each, plus desktop 1440 for each screen.
- Use real content: catalog exercise photos from Storage, the copy from the spec in Ukrainian, plausible numbers.
- Show the lead one screen first, iterate on their feedback, then do the rest.
- Ask, batched and with the recommended option first, when the design needs any of these:
  - a deviation from `VISUAL_LANGUAGE.md`;
  - a new token or component;
  - a copy change against the spec;
  - a behaviour the spec does not state.
- Give your own critique of each mockup when asked: what does not work, and why.

## 5. Write the result

Add or update `## Design` in the spec, right after `## UX`:

- the canvas link and the agreed board names, mapped to the screens and states;
- per screen: layout (mobile and desktop), components used, and what is new;
- copy that changed, also updated in the spec's Copy section;
- anything deliberately left out, with the spec that owns it.

Then:

- Append each design decision to `DECISIONS.md` in its format.
- If the lead agreed to extend the visual language (a new component, token or rule), update `VISUAL_LANGUAGE.md` and `DESIGN_SYSTEM.md` too.
- Keep the spec style: short sentences, no status lines.

## 6. Finish

Tell the lead, in Ukrainian and briefly: the canvas link, what was designed, which decisions were logged, and that the next step is `/scratch <spec>`. Do not commit.
