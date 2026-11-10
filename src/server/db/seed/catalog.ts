// Runs under plain Node (`pnpm db:seed`): package imports and relative `.ts` paths only.
import type postgres from 'postgres';
import { normalizeSearch } from '../../../lib/search.ts';
import { mediaKeys, type SeedExercise } from './seed-schema.ts';

type Sql = postgres.Sql | postgres.TransactionSql;

export interface SeedResult {
  exercises: number;
  translations: number;
}

/**
 * Upserts system exercises by slug and their translations by locale; running it twice changes nothing.
 * Two statements in total: the database is remote, and one round trip per row made CI time out.
 */
export async function seedCatalog(sql: Sql, entries: SeedExercise[]): Promise<SeedResult> {
  const exerciseRows = entries.map((entry) => ({
    slug: entry.slug,
    primary_muscles: entry.primaryMuscles,
    secondary_muscles: entry.secondaryMuscles,
    movement_pattern: entry.movementPattern,
    equipment: entry.equipment,
    mechanic: entry.mechanic,
    laterality: entry.laterality,
    tracking_type: entry.trackingType,
    difficulty: entry.difficulty,
    popularity: entry.popularity,
    media: mediaKeys(entry.slug),
  }));

  const inserted = await sql<{ id: string; slug: string }[]>`
    insert into exercise (
      slug, primary_muscles, secondary_muscles, movement_pattern, equipment, mechanic,
      laterality, tracking_type, difficulty, popularity, media
    )
    select
      r.slug,
      array(select jsonb_array_elements_text(r.primary_muscles)),
      array(select jsonb_array_elements_text(r.secondary_muscles)),
      r.movement_pattern,
      array(select jsonb_array_elements_text(r.equipment)),
      r.mechanic, r.laterality, r.tracking_type, r.difficulty, r.popularity, r.media
    from jsonb_to_recordset(${sql.json(exerciseRows)}) as r(
      slug text, primary_muscles jsonb, secondary_muscles jsonb, movement_pattern text,
      equipment jsonb, mechanic text, laterality text, tracking_type text, difficulty smallint,
      popularity smallint, media jsonb
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
    returning id, slug`;

  const idBySlug = new Map(inserted.map((row) => [row.slug, row.id]));
  const translationRows = entries.flatMap((entry) => {
    const exerciseId = idBySlug.get(entry.slug);
    if (!exerciseId) throw new Error(`Seed upsert returned no row for ${entry.slug}`);
    return Object.entries(entry.translations).map(([locale, text]) => ({
      exercise_id: exerciseId,
      locale,
      name: text.name,
      aliases: text.aliases,
      description: text.description,
      instructions: text.instructions,
      common_mistakes: text.commonMistakes,
      search_name: normalizeSearch(text.name),
      search_aliases: text.aliases.map(normalizeSearch).join('\n'),
    }));
  });

  await sql`
    insert into exercise_translation (
      exercise_id, locale, name, aliases, description, instructions, common_mistakes,
      search_name, search_aliases
    )
    select
      r.exercise_id, r.locale, r.name,
      array(select jsonb_array_elements_text(r.aliases)),
      r.description,
      array(select jsonb_array_elements_text(r.instructions)),
      array(select jsonb_array_elements_text(r.common_mistakes)),
      r.search_name, r.search_aliases
    from jsonb_to_recordset(${sql.json(translationRows)}) as r(
      exercise_id uuid, locale text, name text, aliases jsonb, description text,
      instructions jsonb, common_mistakes jsonb, search_name text, search_aliases text
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

  return { exercises: entries.length, translations: translationRows.length };
}
