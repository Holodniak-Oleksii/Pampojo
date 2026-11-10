// Runs under plain Node (`pnpm db:seed`): package imports and relative `.ts` paths only.
import type postgres from 'postgres';
import { normalizeSearch } from '../../../lib/search.ts';
import { mediaKeys, type SeedExercise } from './seed-schema.ts';

type Sql = postgres.Sql | postgres.TransactionSql;

export interface SeedResult {
  exercises: number;
  translations: number;
}

/** Upserts system exercises by slug and their translations by locale; running it twice changes nothing. */
export async function seedCatalog(sql: Sql, entries: SeedExercise[]): Promise<SeedResult> {
  let translations = 0;
  for (const entry of entries) {
    const [row] = await sql<{ id: string }[]>`
      insert into exercise (
        slug, primary_muscles, secondary_muscles, movement_pattern, equipment, mechanic,
        laterality, tracking_type, difficulty, popularity, media
      ) values (
        ${entry.slug}, ${entry.primaryMuscles}::text[], ${entry.secondaryMuscles}::text[],
        ${entry.movementPattern}, ${entry.equipment}::text[], ${entry.mechanic}, ${entry.laterality},
        ${entry.trackingType}, ${entry.difficulty}, ${entry.popularity},
        ${sql.json(mediaKeys(entry.slug))}
      )
      on conflict (slug) where owner_id is null do update set
        primary_muscles = excluded.primary_muscles,
        secondary_muscles = excluded.secondary_muscles,
        movement_pattern = excluded.movement_pattern,
        equipment = excluded.equipment,
        mechanic = excluded.mechanic,
        laterality = excluded.laterality,
        tracking_type = excluded.tracking_type,
        difficulty = excluded.difficulty,
        popularity = excluded.popularity,
        media = excluded.media,
        deleted_at = null,
        updated_at = now()
      returning id`;
    if (!row) throw new Error(`Seed upsert returned no row for ${entry.slug}`);

    for (const [locale, text] of Object.entries(entry.translations)) {
      await sql`
        insert into exercise_translation (
          exercise_id, locale, name, aliases, description, instructions, common_mistakes,
          search_name, search_aliases
        ) values (
          ${row.id}, ${locale}, ${text.name}, ${text.aliases}::text[], ${text.description},
          ${text.instructions}::text[], ${text.commonMistakes}::text[], ${normalizeSearch(text.name)},
          ${text.aliases.map(normalizeSearch).join('\n')}
        )
        on conflict (exercise_id, locale) do update set
          name = excluded.name,
          aliases = excluded.aliases,
          description = excluded.description,
          instructions = excluded.instructions,
          common_mistakes = excluded.common_mistakes,
          search_name = excluded.search_name,
          search_aliases = excluded.search_aliases,
          updated_at = now()`;
      translations += 1;
    }
  }
  return { exercises: entries.length, translations };
}
