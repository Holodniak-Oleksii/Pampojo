---
name: drill
description: Question a product spec with the lead until it has no gaps, then write the answers into the spec. Step 1 of the spec workflow.
argument-hint: <spec name or number, e.g. 00-project-setup or 03>
disable-model-invocation: true
---

# /drill — question a spec

Goal: leave `docs/specs/<spec>.md` complete enough that `/scratch` can plan it without guessing. You change docs only, never code.

Talk to the lead in Ukrainian. Write everything in files in English.

## 1. Find the spec

- Resolve `$ARGUMENTS` to one file in `docs/specs/` (a number like `03` matches `03-*.md`).
- If it matches nothing or several files, stop and ask.

## 2. Read the context

Read in this order:

1. The spec itself.
2. `DECISIONS.md`, including its "Open questions" list. Note every item tagged with this spec.
3. Every doc the spec links, plus the specs listed under "Depends on".
4. `docs/product/PRD.md`, `ROADMAP.md`, and the `USER_FLOWS.md` / `SCREENS.md` sections for this feature.
5. Relevant `docs/tech/*`, `docs/adr/*` and wireframes in `docs/wireframes/`.
6. Any code in `src/` the feature touches, if it exists.

## 3. Find the gaps

Go through the spec section by section and list what a developer would have to guess. Typical gaps:

- user stories with no acceptance criterion, or criteria that cannot be tested;
- missing UI states: empty, loading, error, offline, mobile vs desktop;
- copy that is not written (titles, buttons, errors, empty states);
- limits and edge cases (lengths, counts, duplicates, deletes, concurrent edits);
- data model, API or auth impact that is not stated;
- contradictions with `DECISIONS.md`, an ADR, a tech doc or another spec;
- scope that leaks into a later spec in the roadmap.

Do not ask anything already answered in `DECISIONS.md` or the docs. Apply that answer.

## 4. Ask

- Batch the questions. Use `AskUserQuestion` (at most 4 questions per call, 2–4 options each). Put your recommended option first and mark it "(Recommended)".
- Each question must stand on its own: say which section it concerns and why it matters.
- Run several rounds if needed. Stop when nothing a developer would guess is left.
- If the lead says "you decide", pick your recommendation and record it as decided by the lead's delegation.

## 5. Write the answers

- Put each answer into the section where it belongs (Scope, UX, Data and API, Acceptance criteria…), not into a Q&A dump.
- Every acceptance criterion is testable and numbered `AC1`, `AC2`, … in a `- [ ]` list.
- Clear the spec's "Open questions" section. Anything deliberately postponed moves to "Out of scope" with the spec number that owns it.
- Append each product or technical decision to `DECISIONS.md` in its format (date, title, Context, Decision, Why, one line each). Remove answered items from its "Open questions" list.
- If a decision is architecture-level, propose an ADR to the lead; write it only after they agree.
- Keep the spec style: short sentences, no status lines.

## 6. Finish

Tell the lead, in Ukrainian and briefly: what changed in the spec, which decisions were logged, and that the next step is `/scratch <spec>`. Do not commit.
