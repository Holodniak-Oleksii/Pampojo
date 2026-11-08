---
title: Backend testing
---

- Service and query tests run against a real Postgres (a test database or a container), not mocks of Drizzle. Mock only external I/O: the LLM provider, Storage, email.
- Each test runs inside a transaction that is rolled back, or on a freshly truncated schema; tests never depend on order.
- Handler tests call the exported handler with a `Request` and a fake session, to cover parsing, auth and error mapping.
- Ownership is a required case for every endpoint that reads or writes user data: another user's id returns 404.
- List endpoints: the success test returns at least two items and asserts the query count stays constant, so an N+1 regression shows up.
- Idempotent writes: the test sends the same request twice and asserts one row.
- Run the smallest meaningful scope (`pnpm test src/server/workouts`). Leave the full suite to CI.
- Before blaming your change, check whether the failure already exists on `main`.
- In the summary, state which checks you ran and which you could not run.
