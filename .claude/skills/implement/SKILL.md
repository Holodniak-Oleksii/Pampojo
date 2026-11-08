---
name: implement
description: Build exactly what a scratch plan describes, with tests, then record deviations in the plan. Step 3 of the spec workflow.
argument-hint: <scratch file, e.g. scratch/00-project-setup.md>
disable-model-invocation: true
---

# /implement — build a scratch plan

Goal: implement `scratch/<name>.md` exactly, meet every acceptance criterion it maps, and leave the checks green.

Talk to the lead in Ukrainian. Write code, comments and notes in English.

## 1. Check the input

- Resolve `$ARGUMENTS` to one file in `scratch/` (a spec name or number also works).
- If there is no scratch file, stop: tell the lead to run `/scratch` first. Never implement from a spec alone.
- If the plan has unanswered blocking questions in "Risks and open questions", stop and ask.

## 2. Read the context

- The scratch plan, all of it.
- `DECISIONS.md`.
- The development guides the plan touches: `docs/development/frontend/*`, `docs/development/backend/*`, `docs/development/request-safety.md`.
- `docs/tech/*` and `docs/adr/*` sections the plan links.
- The existing code you will change.

Do not read `docs/specs/` or `docs/product/`. The plan is the contract; if it is unclear, ask instead of looking at the spec.

## 3. Build

- Follow the plan's "Steps" in order. Track them with a todo list.
- Use the exact copy from the plan's "Copy" section.
- Write the tests from the plan's "Tests" table alongside the code.
- Scope every database read and write to the current user.
- Make mobile (390px) and desktop (1440px) layouts both work.
- Comment only what the code cannot say, one or two sentences.

When the plan does not fit reality:

- Small, local deviation (a renamed file, a helper split differently): do it and note it.
- Anything on the "When to ask the lead" list in `CLAUDE.md` (data model, migration, API contract, new dependency, auth, product decisions, guide deviations): stop and ask, batched, recommended option first. Log the answer in `DECISIONS.md`.
- Out-of-scope findings (bugs, cleanups, ideas): do not fix them; list them in the final summary.

## 4. Verify

Run before finishing:

- `pnpm lint`
- `pnpm typecheck`
- the test files you added or touched (`pnpm test <paths>`, `pnpm test:e2e <paths>` for Playwright)

Run the full suite only if the change is broad. Report failures honestly with the output; do not finish with red checks unless the lead agrees.

## 5. Record

Fill "11. Implementation notes" in the scratch file: every deviation from the plan and why, in short bullets. Write "None" if there were none.

## 6. Finish

Tell the lead, in Ukrainian and briefly: what was built, check results, deviations, out-of-scope findings, and that the next step is `/review <spec>`.

Do not commit unless the lead asks. If they do: one subject line saying what changed, no body, no attribution trailers.
