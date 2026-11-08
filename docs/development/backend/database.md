---
title: Database
---

## Schema

- One file per domain in `src/server/db/schema/`, re-exported from `schema/index.ts`.
- Table names are snake_case singular (`workout_exercise`); TypeScript names camelCase.
- UUID primary keys; client-generated where the client can create offline.
- `createdAt`/`updatedAt` with defaults; `updatedAt` is set explicitly on every update (Drizzle has no `auto_now`), through the `touch()` helper in `db/utils.ts`.
- Foreign keys with explicit `onDelete`. Index every foreign key and every column used in a user-scoped filter (`(userId, updatedAt)` for sync pulls).
- Enumerations are text columns with a `check` constraint built from the `as const` values.

The draft model is `docs/tech/DATA_MODEL.md`. Changing it needs the lead's approval.

## Migrations

```bash
pnpm db:generate   # drizzle-kit generate from schema changes
pnpm db:migrate    # apply to the database in DATABASE_URL
```

- Review every generated SQL file before committing. Generation picks up unrelated uncommitted schema drift; an accidental migration is cheap to delete now and expensive after it ran.
- Never edit a migration that has run on a shared database. Add a new one.
- Data migrations (backfills) are separate SQL or TypeScript scripts in `db/migrations/data/` with a clear name, run once, idempotent (safe to run twice).
- Two branches can each add a migration and merge without a git conflict. After merging `main`, run `pnpm db:generate` again and check the journal is linear.

## Writing rows

**Update only the fields you changed.** Pass only the present input fields to `.set()`. Do not load a row, change one property and write the whole object back: a concurrent request that changed another column would be silently reverted.

```ts
// Good
await db.update(workout)
  .set({ ...pick(input, ['name', 'description']), updatedAt: now() })
  .where(and(eq(workout.id, id), eq(workout.ownerId, userId)));

// Bad — writes every column from a stale copy
await db.update(workout).set({ ...existing, name: input.name }).where(eq(workout.id, id));
```

Partial writes do not help when two writers change the same field; the last one wins. When that matters (reordering exercises, import counters), use a transaction and lock the row with `.for('update')`, or do the change in a single SQL statement (`importCount = importCount + 1`).

**Multi-row changes run in a transaction.** Saving a workout with its exercises, importing a workout with custom exercises, applying a sync batch.

**Soft delete** rows that sync (`deletedAt`), so other devices receive the tombstone.

## Seeds

`pnpm db:seed` loads the system exercise catalog from `db/seed/exercises.json`. Seeds upsert by `slug` and are safe to run repeatedly.
