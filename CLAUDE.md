# Pampojo — agent guide

Pampojo is an offline-first gym workout tracker, built as a PWA. One Next.js app holds the web client and the backend API. Phones are the main target (Android, iPhone); laptops get the same app with a wide layout.

Talk to the lead (the repo owner) in Ukrainian. Write code, comments, commits and docs in English.

## Repository layout

- `docs/product/` — what we build and why: PRD, user flows, screens, roadmap.
- `docs/tech/` — how the system works: architecture, data model, API, offline, AI, design system, visual language.
- `docs/development/` — how we write code. SSOT for conventions:
  - `frontend/` — code organization, TypeScript, state and data, testing.
  - `backend/` — structure, database, API handlers, testing.
  - `request-safety.md` — idempotent writes and retries.
- `docs/adr/` — architecture decision records. One decision per file.
- `docs/specs/` — one product spec per feature, numbered in delivery order.
- `docs/wireframes/` — reference images. They set mood and layout, not pixels.
- `docs/brand/` — logo SVGs.
- `scratch/` — technical plans, one per spec, same file name as the spec.
- `prompts/` — versioned LLM prompts. Never inline prompts in code.
- `evals/` — AI eval cases and runners.
- `DECISIONS.md` — log of answers the lead gave. Read before asking anything.
- `.claude/skills/` — workflow skills (see below).
- `src/` — application code, created by spec `00`. Layout: `docs/development/frontend/code-organization.md` and `docs/development/backend/overview.md`.

## Workflow

Every feature goes through five skills, run by the lead one at a time:

1. `/drill <spec>` — question the spec with the lead, write the answers into the spec.
2. `/design <spec>` — design the spec's screens and states as mockups with the lead (the `frontend-design` skill inside `docs/tech/VISUAL_LANGUAGE.md`), write the result into the spec's Design section.
3. `/scratch <spec>` — turn the spec into a technical plan in `scratch/<same-name>.md`.
4. `/implement <scratch>` — build exactly the plan. Product specs are out of context here.
5. `/review <spec>` — review the code and walk the UI with Playwright against the spec's acceptance criteria and its design.

Do not jump ahead. Do not plan a spec with UI that has no Design section. Do not implement a spec that has no scratch file.

## When to ask the lead

You are a developer working with a lead. Ask, do not guess, when the task needs any of these:

- a change to the data model, a migration, or an API contract;
- a new dependency, or replacing one;
- anything touching auth, sessions, share links, or user data visibility;
- a deviation from a spec, a scratch plan, an ADR, or a guide in `docs/development/`;
- a product decision the spec does not make (copy, empty states, limits, edge cases);
- two documents that contradict each other.

Decide yourself: naming, local refactors inside the files you touch, markup details already covered by the design system, test structure.

How to ask:

- Check `DECISIONS.md` first. If the answer is there, apply it.
- Batch questions. Put them in an "Open questions" block before writing code, with your recommended option first.
- After the lead answers, append the decision to `DECISIONS.md` (date, context, decision, why). Keep each entry short.

## Commands

The source of truth is `package.json`. Expected scripts after spec `00`:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (unit + component) |
| `pnpm test:e2e` | Playwright |
| `pnpm db:generate` / `pnpm db:migrate` | Drizzle migrations |
| `pnpm db:seed` | Seed the exercise catalog |
| `pnpm evals` | AI evals |

Run the cheap checks (`lint`, `typecheck`, the test files you touched) before finishing. Leave the full suite to CI unless the change is broad.

## Definition of done

- Every acceptance criterion the scratch plan maps is met and tested.
- `lint` and `typecheck` pass. Tests for the touched code pass.
- No change outside the plan's scope. Out-of-scope findings go to the summary, not into the diff.
- Mobile (390px) and desktop (1440px) layouts both work.
- Deviations from the plan are recorded under "Implementation notes" in the scratch file.

## Commits

- One subject line, nothing else. It says what changed.
- Explanations belong in the PR description.
- No tool or session attribution trailers.

## Code comments

- Comment only what the code cannot say: the non-obvious problem and the reason behind the solution.
- One or two sentences. No narration, no history of previous versions.

## Security and config

- Never commit secrets or `.env*` files other than `.env.example`.
- Every database read and write is scoped to the current user. See `docs/development/backend/overview.md`.
- Do not commit generated build output.
