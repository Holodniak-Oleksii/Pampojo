---
name: scratch
description: Turn a drilled product spec into a technical plan in scratch/<same-name>.md. Step 2 of the spec workflow.
argument-hint: <spec name or number, e.g. 00-project-setup or 03>
disable-model-invocation: true
---

# /scratch — plan a spec

Goal: write `scratch/<spec>.md`, a plan `/implement` can follow without ever opening the product spec. You write the plan only, never code.

Talk to the lead in Ukrainian. Write the plan in English.

## 1. Check the input

- Resolve `$ARGUMENTS` to one file in `docs/specs/`.
- If the spec still has open questions or untestable acceptance criteria, stop and tell the lead to run `/drill` first.
- If `scratch/<spec>.md` already exists, read it and ask whether to revise it or start over.

## 2. Read the context

1. The spec and the specs it depends on (and their scratch plans, if any).
2. `DECISIONS.md`.
3. The `docs/tech/*` sections and ADRs the spec touches.
4. All of `docs/development/` that applies: frontend, backend, `request-safety.md`.
5. The current code in `src/`, `package.json` and config. Plan against what really exists.

## 3. Ask before planning around a problem

Stop and ask the lead (batched, recommended option first, see `CLAUDE.md` "When to ask the lead") if the plan needs:

- a data model change, migration or API contract not described in `docs/tech/`;
- a new dependency or a replacement;
- anything touching auth, sessions, share links or data visibility beyond what is documented;
- a deviation from the spec, an ADR or a development guide;
- a choice between two documents that contradict each other.

Log the answers in `DECISIONS.md`.

## 4. Write the plan

Copy `scratch/_TEMPLATE.md` to `scratch/<spec>.md` and fill every section:

1. **Summary** — what gets built, in a few sentences.
2. **Acceptance criteria** — restate every AC from the spec with the same numbers, in words a developer can act on. `/implement` will not see the spec, so nothing may be implied.
3. **Data** — tables, columns, indexes, migrations, Zod schemas. Write "No changes" if none.
4. **API** — routes, methods, request and response shapes, errors, idempotency (see `request-safety.md`).
5. **Server** — modules, files, user scoping of every query.
6. **Client** — routes, components, state, data fetching, offline behaviour, mobile (390px) and desktop (1440px) layout.
7. **Copy** — every user-facing string, exactly as it should appear.
8. **Steps** — ordered, small steps, each ending in a state that typechecks. Name the files each step creates or changes.
9. **Tests** — a table mapping every AC to at least one test (unit, component or Playwright) with the test file path.
10. **Risks and open questions** — what could go wrong; leave no unanswered question that blocks implementation.
11. **Implementation notes** — leave empty; `/implement` fills it.

Rules:

- Use file paths and names that match `docs/development/frontend/code-organization.md` and `docs/development/backend/overview.md`.
- Stay inside the spec's scope. Things for later specs go under Risks with the spec number.
- Prefer existing code and dependencies over new ones.

## 5. Finish

Tell the lead, in Ukrainian and briefly: the plan's shape, any decisions logged, and that the next step is `/implement scratch/<spec>.md`. Do not commit.
