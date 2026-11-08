# 20. AI foundation

## Goal

Shared infrastructure every AI feature uses: one client, versioned prompts, validation with a repair retry, cost logging, limits and evals. Design: `docs/tech/AI.md`.

## Scope

- `src/server/ai/client.ts`: provider SDK wrapper; model from env; timeout; `generateStructured({ feature, promptVersion, schema, input })` returning parsed Zod output; one repair retry with the validation errors; token and cost accounting.
- Prompt loader for `prompts/<feature>/v<N>.md` with simple variable substitution; prompts are plain files in git.
- `ai_request_log` table and writes for every call (success and failure).
- Per-user daily limit per feature and a global `AI_ENABLED` switch; 429 with a friendly message.
- `evals/` runner: `pnpm evals [feature]` loads `evals/<feature>/cases.json`, runs the feature function, applies checks, prints a table, exits non-zero below the threshold. CI runs a small smoke subset on PRs labelled `ai`.
- Client: `AiButton` pattern with loading, cancel, error and "Needs internet" states.

## Acceptance criteria

- [ ] AC1: A test feature returns valid structured output through `generateStructured`; invalid output triggers exactly one repair attempt.
- [ ] AC2: Every call writes a log row with tokens, cost, latency, prompt version and status.
- [ ] AC3: Exceeding the daily limit returns 429; `AI_ENABLED=false` disables all AI endpoints and hides AI buttons.
- [ ] AC4: The provider key is never exposed to the client bundle (build check).
- [ ] AC5: `pnpm evals test-feature` runs and reports pass rate.

## Depends on

19 (milestone order), 00.

## Open questions

- Provider and default model; monthly budget cap.
- Rate-limit store: Postgres counters or a hosted KV.
