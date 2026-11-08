# Evals

Automated checks of AI feature quality. Design: `docs/tech/AI.md`.

```text
evals/
└── <feature>/
    ├── cases.json      # inputs and expectations
    └── checks.ts       # functions that judge one output
```

`pnpm evals [feature]` runs the feature against every case, prints a pass/fail table and exits non-zero under the threshold defined in the feature's spec. CI runs a small smoke subset on PRs labelled `ai`.

Cases use neutral, English test data. Keep each case small and explain in a `note` field what it checks.
