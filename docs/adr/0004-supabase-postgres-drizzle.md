# 0004. Supabase Postgres and Storage, accessed through Drizzle

Date: 2026-11-08

## Context

Need a free Postgres and file storage for exercise images. We want our own backend logic rather than clients talking to the database directly.

## Decision

Use Supabase only as infrastructure: Postgres (through Drizzle from our server) and Storage (public bucket for catalog media, private bucket for user uploads). No Supabase client SDK on the frontend for data, no Row Level Security as the authorization layer; authorization is in our services.

## Consequences

- Free projects pause after about a week without database activity. A scheduled GitHub Action pings the health endpoint every few days. Check current free-tier limits before launch.
- Moving to another Postgres host means changing a connection string.
- Use the pooled connection string for serverless.
