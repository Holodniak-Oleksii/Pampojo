import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { getEnv } from '@/server/env';
import { seedCatalog } from '../catalog';
import { seedCatalogSchema } from '../seed-schema';

// Seeds the whole catalog twice against the remote database.
vi.setConfig({ testTimeout: 120_000 });

const entries = seedCatalogSchema.parse(
  JSON.parse(readFileSync(new URL('../exercises.json', import.meta.url), 'utf8')),
);
const slugs = entries.map((entry) => entry.slug);

const sql = postgres(getEnv().DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });

afterAll(async () => {
  await sql.end();
});

class Rollback extends Error {}

async function counts(tx: postgres.TransactionSql) {
  const [row] = await tx<{ exercises: number; translations: number }[]>`
    select
      (select count(*)::int from exercise where owner_id is null and slug = any(${slugs}::text[])) as exercises,
      (select count(*)::int from exercise_translation t join exercise e on e.id = t.exercise_id
        where e.owner_id is null and e.slug = any(${slugs}::text[])) as translations`;
  return row;
}

describe('seedCatalog', () => {
  it('is repeatable and stores complete rows', async () => {
    // The database is shared with production, so the test never commits.
    await expect(
      sql.begin(async (tx) => {
        await seedCatalog(tx, entries);
        const first = await counts(tx);
        await seedCatalog(tx, entries);
        const second = await counts(tx);

        expect(first).toEqual({ exercises: entries.length, translations: entries.length * 2 });
        expect(second).toEqual(first);

        const incomplete = await tx`
          select e.slug from exercise e
          where e.owner_id is null and e.slug = any(${slugs}::text[])
            and (jsonb_array_length(e.media -> 'frames') <> 2 or e.popularity is null
              or e.movement_pattern is null or cardinality(e.primary_muscles) = 0
              or (select count(*) from exercise_translation t
                  where t.exercise_id = e.id and t.search_name <> '' and cardinality(t.instructions) > 0
                    and cardinality(t.common_mistakes) > 0) <> 2)`;
        expect(incomplete).toEqual([]);

        const [bench] = await tx<{ search_name: string; search_aliases: string }[]>`
          select t.search_name, t.search_aliases from exercise_translation t
          join exercise e on e.id = t.exercise_id
          where e.slug = 'barbell-bench-press' and e.owner_id is null and t.locale = 'uk'`;
        expect(bench).toEqual({
          search_name: 'жим штанги лежачи',
          search_aliases: 'жим лежачи\nжим на горизонтальніи лаві',
        });

        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  });
});
