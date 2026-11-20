import 'server-only';
import { sql } from 'drizzle-orm';
import { SESSION_STATUS } from '@/constants/session';
import type { Locale } from '@/i18n/config';
import { translationJoins } from '@/server/exercises/queries';
import type { Executor } from '@/server/sessions/queries';
import type { ExerciseMedia } from '@/shared/schemas/exercise';

export interface TrainedExerciseRow extends Record<string, unknown> {
  id: string;
  owner_id: string | null;
  name: string;
  tracking_type: string;
  media: ExerciseMedia;
  last_trained_at: Date | string;
}

/** Exercises with at least one counted set of the user, the most recently trained first. */
export async function listTrainedExerciseRows(
  db: Executor,
  userId: string,
  locale: Locale,
): Promise<TrainedExerciseRow[]> {
  const rows = await db.execute<TrainedExerciseRow>(sql`
    with trained as (
      select l.exercise_id, max(s.started_at) as last_trained_at
      from set_log l
      join workout_session s on s.id = l.session_id
      where s.user_id = ${userId} and s.status = ${SESSION_STATUS.COMPLETED}
        and l.deleted_at is null
      group by l.exercise_id
    )
    select e.id, e.owner_id, e.tracking_type, e.media, trained.last_trained_at,
      coalesce(tr.name, tf.name) as name
    from trained
    join exercise e on e.id = trained.exercise_id
    ${translationJoins(locale)}
    where (e.owner_id is null or e.owner_id = ${userId}) and e.deleted_at is null
    order by trained.last_trained_at desc, e.id`);
  return [...rows];
}

export interface MonthTotalsRow extends Record<string, unknown> {
  workouts: number | string;
  volume_kg: number | string | null;
}

/** Completed workouts and their weight_reps volume with a start date in `[from, to]` in the zone. */
export async function findMonthTotalsRow(
  db: Executor,
  input: { userId: string; timeZone: string; from: string; to: string },
): Promise<MonthTotalsRow> {
  const rows = await db.execute<MonthTotalsRow>(sql`
    select count(distinct s.id) as workouts,
      coalesce(sum(l.weight_kg * l.reps) filter (
        where e.tracking_type = 'weight_reps' and l.weight_kg is not null and l.reps is not null
      ), 0) as volume_kg
    from workout_session s
    left join set_log l on l.session_id = s.id and l.deleted_at is null
    left join exercise e on e.id = l.exercise_id
    where s.user_id = ${input.userId} and s.status = ${SESSION_STATUS.COMPLETED}
      and (s.started_at at time zone ${input.timeZone})::date between ${input.from} and ${input.to}`);
  return rows[0] ?? { workouts: 0, volume_kg: 0 };
}

export interface ExerciseSetRow extends Record<string, unknown> {
  session_id: string;
  started_at: Date | string;
  weight_kg: string | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
}

/** Every counted set of one exercise, in session start order. */
export async function listExerciseSetRows(
  db: Executor,
  userId: string,
  exerciseId: string,
): Promise<ExerciseSetRow[]> {
  const rows = await db.execute<ExerciseSetRow>(sql`
    select s.id as session_id, s.started_at, l.weight_kg, l.reps, l.duration_sec, l.distance_m
    from set_log l
    join workout_session s on s.id = l.session_id
    where s.user_id = ${userId} and s.status = ${SESSION_STATUS.COMPLETED}
      and l.exercise_id = ${exerciseId} and l.deleted_at is null
    order by s.started_at, s.id, l.completed_at, l.set_index`);
  return [...rows];
}

export interface ExerciseSetForRow extends ExerciseSetRow {
  exercise_id: string;
}

/** Counted sets of several exercises in one query, grouped by exercise, then in session order. */
export async function listExerciseSetRowsFor(
  db: Executor,
  userId: string,
  exerciseIds: readonly string[],
): Promise<ExerciseSetForRow[]> {
  if (exerciseIds.length === 0) return [];
  const ids = sql`array[${sql.join(
    exerciseIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
  const rows = await db.execute<ExerciseSetForRow>(sql`
    select l.exercise_id, s.id as session_id, s.started_at, l.weight_kg, l.reps, l.duration_sec,
      l.distance_m
    from set_log l
    join workout_session s on s.id = l.session_id
    where s.user_id = ${userId} and s.status = ${SESSION_STATUS.COMPLETED}
      and l.exercise_id = any(${ids}) and l.deleted_at is null
    order by l.exercise_id, s.started_at, s.id, l.completed_at, l.set_index`);
  return [...rows];
}
