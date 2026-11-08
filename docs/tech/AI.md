# AI

AI features come last (specs 20–25), but the data model is built for them from the start: every exercise carries structured metadata, and the workout export schema doubles as the generation target.

## Principles

1. **Catalog-constrained.** The model chooses from exercise ids we send; it never invents exercises. Output ids are checked against the input list.
2. **Structured output.** Every call returns JSON validated by a Zod schema from `src/shared/schemas/ai`.
3. **Validate, then repair once.** On a failed check, retry once with the list of problems; on a second failure, return a clear error.
4. **Drafts, not writes.** AI output is shown as a draft the user edits and saves.
5. **Deterministic first.** Where an algorithm is good enough (substitution), AI only re-ranks and explains.
6. **Server only.** API keys never reach the client. AI is online-only.

## Building blocks (spec 20)

- `src/server/ai/client.ts` — provider SDK wrapper: model from env, timeouts, structured output, token and cost accounting.
- `prompts/<feature>/v<N>.md` — versioned prompt templates. The version is logged with each call.
- `ai_request_log` — feature, model, prompt version, tokens, cost, latency, status.
- Per-user daily limits and a global kill switch (`AI_ENABLED`).
- `evals/` — cases and runners; `pnpm evals` locally, a small subset in CI.

## Features

| Spec | Feature | Input | Output | Checks |
| --- | --- | --- | --- | --- |
| 21 | Workout generation | Goal, days, duration, level, gym equipment, filtered catalog | Workout draft in export schema with catalog ids | ids exist, equipment available, estimated duration within limit, muscle balance |
| 22 | Substitution re-rank | Planned exercise, reason, free text, top-10 deterministic candidates | Ranked 3 ids + one-line reasons | ids from candidates only |
| 23 | Exercise tagging | Name and optional description | Muscles, pattern, equipment, mechanic, tracking type | values from allowed lists |
| 24 | Exercise from voice | Audio → transcript | Exercise card: description, steps, mistakes, tags; then 2–3 key frames | schema, user review before save |
| 25 | Muscle map picker | Selected muscles, gym equipment | Suggested exercises (deterministic + optional AI note) | ids exist |

## Evals

- Workout generation: 20–30 prompts across goals, levels and equipment. Pass = schema valid, constraints met.
- Substitution: table of `exercise + reason → acceptable replacements`. Pass = an acceptable one in the top 3.
- Tagging: labelled set of exercises. Metric = precision of primary muscles and pattern.
- Store cases as JSON in `evals/<feature>/cases.json`; the runner prints a table and exits non-zero under the threshold set in the spec.

## Open questions (decide in `/drill`)

- LLM provider and default model.
- Speech-to-text provider for spec 24.
- Image generation provider and whether visuals ship at all, given anatomy accuracy risks. Visuals always need user approval and are labelled as illustrations.
