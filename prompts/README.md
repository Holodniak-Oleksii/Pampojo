# Prompts

Versioned LLM prompt templates, one folder per AI feature: `prompts/<feature>/v<N>.md`.

- Never edit a version that has shipped; add `v<N+1>` and switch the feature to it. The version is logged with every call (`ai_request_log.promptVersion`), so results stay comparable.
- Variables use `{{name}}` and are filled by the loader in `src/server/ai/prompts.ts`.
- Each prompt states the role, the input format, the hard constraints (only ids from the given list, allowed values) and the output schema in words; the Zod schema is enforced in code.
- Changing a prompt requires running that feature's evals and noting the pass rate in the PR.
