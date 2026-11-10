import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { MUSCLE_GROUPS } from '@/constants/exercise';
import type { Locale } from '@/i18n/config';
import type { Db } from '@/server/db/client';
import type { ExerciseMedia } from '@/shared/schemas/exercise';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

/** A Postgres array literal bound as one parameter, so the SQL text does not depend on the values. */
function textArray(values: readonly string[]): SQL {
  const literal = `{${values.map((value) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`).join(',')}}`;
  return sql`${literal}::text[]`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface ListExerciseRowsInput {
  userId: string;
  locale: Locale;
  /** Already normalized with `normalizeSearch`; null means no search. */
  q: string | null;
  muscles: readonly string[];
  equipment: readonly string[];
  pattern: string | null;
  offset: number;
  limit: number;
}

export interface ExerciseListRow extends Record<string, unknown> {
  id: string;
  name: string;
  primary_muscles: string[];
  equipment: string[];
  media: ExerciseMedia;
  owner_id: string | null;
  section: string | null;
}

// `tf` is the other locale: own exercises (spec 07) may have one translation in either language.
const translationJoins = (locale: Locale) => sql`
  left join exercise_translation tr on tr.exercise_id = e.id and tr.locale = ${locale}
  left join exercise_translation tf on tf.exercise_id = e.id and tf.locale <> ${locale}`;

const visibleTo = (userId: string) =>
  sql`(e.owner_id is null or e.owner_id = ${userId}) and e.deleted_at is null`;

/** One query for any page size: filters, section or rank, order and paging all happen in SQL. */
export async function listExerciseRows(
  db: Executor,
  input: ListExerciseRowsInput,
): Promise<ExerciseListRow[]> {
  const muscles = textArray(input.muscles);
  const name = sql`coalesce(tr.name, tf.name)`;
  const contains = input.q === null ? null : `%${escapeLike(input.q)}%`;
  const prefix = input.q === null ? null : `${escapeLike(input.q)}%`;

  const section = sql`(select m from unnest(e.primary_muscles) with ordinality as u(m, i)
    where cardinality(${muscles}) = 0 or m = any(${muscles}) order by i limit 1)`;
  const rank = sql`(select min(case when s.search_name like ${prefix} escape '\\' then 0
    when s.search_name like ${contains} escape '\\' then 1 else 2 end)
    from exercise_translation s where s.exercise_id = e.id)`;

  const search =
    contains === null
      ? sql`true`
      : sql`exists (select 1 from exercise_translation s where s.exercise_id = e.id
          and (s.search_name like ${contains} escape '\\' or s.search_aliases like ${contains} escape '\\'))`;

  const order =
    input.q === null
      ? sql`array_position(${textArray(MUSCLE_GROUPS)}, ${section}), e.popularity desc nulls last, ${name}, e.id`
      : sql`${rank}, e.popularity desc nulls last, ${name}, e.id`;

  const rows = await db.execute<ExerciseListRow>(sql`
    select e.id, ${name} as name, e.primary_muscles, e.equipment, e.media, e.owner_id,
      ${input.q === null ? section : sql`null`} as section
    from exercise e
    ${translationJoins(input.locale)}
    where ${visibleTo(input.userId)}
      and (cardinality(${muscles}) = 0 or e.primary_muscles && ${muscles})
      and (cardinality(${textArray(input.equipment)}) = 0 or e.equipment && ${textArray(input.equipment)})
      and (${input.pattern}::text is null or e.movement_pattern = ${input.pattern})
      and ${search}
    order by ${order}
    limit ${input.limit + 1} offset ${input.offset}`);
  return [...rows];
}

export interface ExerciseRow extends Record<string, unknown> {
  id: string;
  owner_id: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  movement_pattern: string | null;
  mechanic: string | null;
  laterality: string | null;
  tracking_type: string;
  difficulty: number | null;
  media: ExerciseMedia;
  name: string;
  aliases: string[];
  description: string;
  instructions: string[];
  common_mistakes: string[];
}

export async function findExerciseRow(
  db: Executor,
  input: { userId: string; locale: Locale; id: string },
): Promise<ExerciseRow | undefined> {
  const rows = await db.execute<ExerciseRow>(sql`
    select e.id, e.owner_id, e.primary_muscles, e.secondary_muscles, e.equipment,
      e.movement_pattern, e.mechanic, e.laterality, e.tracking_type, e.difficulty, e.media,
      coalesce(tr.name, tf.name) as name,
      coalesce(tr.aliases, tf.aliases) as aliases,
      coalesce(tr.description, tf.description) as description,
      coalesce(tr.instructions, tf.instructions) as instructions,
      coalesce(tr.common_mistakes, tf.common_mistakes) as common_mistakes
    from exercise e
    ${translationJoins(input.locale)}
    where e.id = ${input.id} and ${visibleTo(input.userId)}
    limit 1`);
  return rows[0];
}
