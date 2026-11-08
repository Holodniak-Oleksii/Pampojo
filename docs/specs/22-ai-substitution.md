# 22. AI substitution

## Goal

Better swap suggestions when the situation is specific ("bench busy, only dumbbells and a cable left, shoulder hurts"), with a one-line reason per suggestion.

## Scope

- In the swap sheet (spec 18), a free-text field "Describe the situation" and an "Ask AI" action, online only.
- Server: deterministic top 10 candidates (spec 18 function) + context → `generateStructured` returns 3 ids from the candidates with reasons.
- Offline or AI unavailable: the deterministic list stays as is; no blocking.
- Evals: table of situations → acceptable ids; pass if one acceptable id is in the top 3.

## Acceptance criteria

- [ ] AC1: AI suggestions are always a subset of the deterministic candidates.
- [ ] AC2: Each suggestion shows a one-line reason in the user's UI language.
- [ ] AC3: Offline, the "Ask AI" control is disabled with the hint; the deterministic list works.
- [ ] AC4: Evals pass rate ≥ threshold.

## Depends on

18, 20.
