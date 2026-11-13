import 'server-only';
import { eq, sql, type SQL } from 'drizzle-orm';
import { MUSCLE_GROUPS } from '@/constants/exercise';
import type { Locale } from '@/i18n/config';
import type { Db } from '@/server/db/client';
import { exercise, exerciseTranslation } from '@/server/db/schema';
import { touch } from '@/server/db/utils';
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
  /** Own exercises only (the "Mine" chip). */
  mine: boolean;
  /** Only exercises the user's saved gym allows; ignored without a saved gym. */
  gym: boolean;
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
  gym_equipment: string[][];
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

  // The SQL twin of isAvailableInGym (src/shared/gym.ts): paging happens here, so the filter must too.
  // `group ?| text[]` is true when any item of the group is in the gym.
  const gym = sql`(${input.gym}::boolean = false or gp.user_id is null
    or not exists (select 1 from jsonb_array_elements(e.gym_equipment) as g(grp)
      where not (g.grp ?| gp.equipment)))`;

  const order =
    input.q === null
      ? sql`array_position(${textArray(MUSCLE_GROUPS)}, ${section}), e.popularity desc nulls last, ${name}, e.id`
      : sql`${rank}, e.popularity desc nulls last, ${name}, e.id`;

  const rows = await db.execute<ExerciseListRow>(sql`
    select e.id, ${name} as name, e.primary_muscles, e.equipment, e.media, e.owner_id,
      e.gym_equipment, ${input.q === null ? section : sql`null`} as section
    from exercise e
    ${translationJoins(input.locale)}
    left join gym_profile gp on gp.user_id = ${input.userId}
    where ${visibleTo(input.userId)}
      and (cardinality(${muscles}) = 0 or e.primary_muscles && ${muscles})
      and (cardinality(${textArray(input.equipment)}) = 0 or e.equipment && ${textArray(input.equipment)})
      and (${input.pattern}::text is null or e.movement_pattern = ${input.pattern})
      and (${input.mine}::boolean = false or e.owner_id = ${input.userId})
      and ${gym}
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
  source_exercise_id: string | null;
  gym_equipment: string[][];
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
      e.source_exercise_id, e.gym_equipment,
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

// ---- Writes (spec 07). Every function runs inside the caller's transaction.

export interface LockedExercise extends Record<string, unknown> {
  id: string;
  owner_id: string | null;
  deleted_at: Date | null;
  primary_muscles: string[];
  media: ExerciseMedia;
}

/** Serialises one user's creates and renames, so the name and limit checks cannot race. */
export async function lockOwner(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`exercise-owner:${userId}`}))`);
}

/** No owner filter on purpose: the service tells a system row (403) from a foreign one (404). */
export async function lockExerciseRow(tx: Tx, id: string): Promise<LockedExercise | undefined> {
  const rows = await tx.execute<LockedExercise>(sql`
    select id, owner_id, deleted_at, primary_muscles, media from exercise where id = ${id} for update`);
  return rows[0];
}

export async function findSystemExerciseMedia(
  tx: Tx,
  id: string,
): Promise<ExerciseMedia | undefined> {
  const rows = await tx.execute<{ media: ExerciseMedia }>(sql`
    select media from exercise where id = ${id} and owner_id is null and deleted_at is null`);
  return rows[0]?.media;
}

export async function countOwnExercises(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.execute<{ count: number }>(sql`
    select count(*)::int as count from exercise where owner_id = ${userId} and deleted_at is null`);
  return rows[0]?.count ?? 0;
}

export async function ownNameTaken(
  tx: Tx,
  userId: string,
  searchName: string,
  exceptId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ taken: boolean }>(sql`
    select exists (
      select 1 from exercise e join exercise_translation t on t.exercise_id = e.id
      where e.owner_id = ${userId} and e.deleted_at is null and e.id <> ${exceptId}
        and t.search_name = ${searchName}
    ) as taken`);
  return rows[0]?.taken ?? false;
}

export async function insertOwnExercise(tx: Tx, values: typeof exercise.$inferInsert) {
  await tx.insert(exercise).values(values);
}

export async function insertTranslation(tx: Tx, values: typeof exerciseTranslation.$inferInsert) {
  await tx.insert(exerciseTranslation).values(values);
}

type ExerciseColumns = Partial<
  Pick<
    typeof exercise.$inferInsert,
    | 'primaryMuscles'
    | 'secondaryMuscles'
    | 'equipment'
    | 'trackingType'
    | 'movementPattern'
    | 'mechanic'
    | 'laterality'
    | 'gymEquipment'
    | 'media'
    | 'deletedAt'
  >
>;

export async function updateExerciseColumns(tx: Tx, id: string, fields: ExerciseColumns) {
  await tx
    .update(exercise)
    .set({ ...fields, ...touch() })
    .where(eq(exercise.id, id));
}

type TranslationColumns = Partial<
  Pick<
    typeof exerciseTranslation.$inferInsert,
    'name' | 'searchName' | 'description' | 'instructions' | 'commonMistakes'
  >
>;

/** Own exercises have exactly one translation row, whatever its locale. */
export async function updateOwnTranslation(tx: Tx, id: string, fields: TranslationColumns) {
  await tx
    .update(exerciseTranslation)
    .set({ ...fields, ...touch() })
    .where(eq(exerciseTranslation.exerciseId, id));
}
