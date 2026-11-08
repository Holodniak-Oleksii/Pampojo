---
name: review
description: Review an implemented spec — code against the plan and guides, UI walked with Playwright against every acceptance criterion — and append the report to the scratch file. Step 4 of the spec workflow.
argument-hint: <spec name or number, e.g. 00-project-setup or 03>
disable-model-invocation: true
---

# /review — review an implemented spec

Goal: tell the lead whether the feature meets its spec, with evidence. You report; you do not fix unless the lead asks.

Talk to the lead in Ukrainian. Write the report in English.

## 1. Check the input

- Resolve `$ARGUMENTS` to `docs/specs/<spec>.md` and `scratch/<spec>.md`. Both must exist; if the scratch file is missing, stop.
- Find the change set: uncommitted changes (`git status`, `git diff`) plus commits on the current branch that are not on `main`. If it is unclear what belongs to this spec, ask.

## 2. Read the context

- The spec (now in scope again: review checks the product, not just the plan).
- The scratch plan, including "Implementation notes".
- `DECISIONS.md` and the `docs/development/` guides that apply.

## 3. Review the code

Check, and note each finding with `file:line`:

- every AC in the spec is implemented and covered by the test the plan maps;
- the diff stays inside the plan's scope; deviations are recorded in "Implementation notes";
- conventions from `docs/development/` (code organization, TypeScript, state and data, API handlers, database);
- every database read and write is scoped to the current user;
- writes are idempotent and safe to retry where `request-safety.md` requires it;
- no secrets, `.env*` files (other than `.env.example`) or build output in the diff;
- comments follow `CLAUDE.md`.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` for the spec's tests, and record the results.

## 4. Walk the UI

Skip this step only if the spec has no user-facing surface; say so in the report.

- Start the app (`pnpm dev`) in the background and wait until it responds.
- Use Playwright (a throwaway script in the scratchpad, or the project's Playwright setup) to walk every AC that has a UI, at 390×844 and 1440×900.
- Cover the states the spec lists: empty, loading, error, offline, where applicable.
- Save screenshots to `scratch/review/<spec>/` named `ACn-<viewport>-<state>.png`.
- Look at the screenshots yourself before judging an AC.
- Stop the dev server when done.

## 5. Write the report

Append to the end of `scratch/<spec>.md`:

```markdown
## 12. Review — YYYY-MM-DD

**Verdict:** Pass | Pass with notes | Fail

| AC | Result | Evidence |
| --- | --- | --- |
| AC1 | Pass / Fail / Not testable | test file, screenshot, or file:line |

### Findings

1. [blocker | major | minor] Short description — `file:line`. Why it matters.

### Checks

- lint: …
- typecheck: …
- tests: …
- e2e: …

### Out of scope

Things noticed that belong to other specs or later work.
```

If you review again later, add a new dated section; do not rewrite the old one.

## 6. Finish

Tell the lead, in Ukrainian and briefly: the verdict, blockers first, and what to fix. Offer to fix the findings; do not change code without their go-ahead. Do not commit.
