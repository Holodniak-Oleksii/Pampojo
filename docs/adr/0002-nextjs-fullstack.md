# 0002. Next.js for both UI and API

Date: 2026-11-08

## Context

The lead works in React and TypeScript. Options for the backend were Node or Python, as a separate service or inside the web app.

## Decision

One Next.js (App Router) project. The API is route handlers under `/api/v1`; business logic lives in `src/server`, independent of Next.js APIs, so it could move to a separate service later.

## Consequences

- One language, one deploy, shared Zod schemas and types between client and server.
- Vercel's free tier covers it for a non-commercial project.
- Long-running work (large AI jobs) must fit serverless time limits or move to a queue later.
- Python would only pay off for training our own models, which is not planned.
