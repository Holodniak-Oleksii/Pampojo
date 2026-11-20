import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { SESSION_STATUS } from '@/constants/session';
import type { ExerciseMedia } from '@/shared/schemas/exercise';
import type { Executor } from './queries';
import type { PullAfter } from './cursor';

/** The rows of a run: `updated_at` in `(low, high]`, or up to `high` for a full download. */
export interface PullRange {
  userId: string;
  low: string | null;
  high: string;
  /** The first start instant of a session in the device window. */
  windowStart: Date;
}

const uuids = (ids: readonly string[]) =>
  sql`array[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;

function inRange(column: SQL, range: PullRange): SQL {
  return range.low === null
    ? sql`${column} <= ${range.high}::timestamptz`
    : sql`${column} > ${range.low}::timestamptz and ${column} <= ${range.high}::timestamptz`;
}

function afterKey(updatedAt: SQL, id: SQL, after: PullAfter | null): SQL {
  if (!after) return sql`true`;
  return after.at === null
    ? sql`${id} > ${after.id}`
    : sql`(${updatedAt}, ${id}) > (${after.at}::timestamptz, ${after.id}::uuid)`;
}

function inWindow(alias: SQL, range: PullRange): SQL {
  return sql`${alias}.user_id = ${range.userId}
    and (${alias}.started_at >= ${range.windowStart.toISOString()}::timestamptz
      or ${alias}.status = ${SESSION_STATUS.IN_PROGRESS})`;
}

export async function databaseNow(db: Executor): Promise<string> {
  const [row] = await db.execute<{ now: string }>(sql`select now()::text as now`);
  if (!row) throw new Error('No database time');
  return row.now;
}

/** `high` of the previous run minus the overlap, as text with microseconds. */
export async function lowerBound(db: Executor, high: string, overlapMs: number): Promise<string> {
  const [row] = await db.execute<{ low: string }>(
    sql`select (${high}::timestamptz - ${overlapMs} * interval '1 millisecond')::text as low`,
  );
  if (!row) throw new Error('No lower bound');
  return row.low;
}

export interface Keyed extends Record<string, unknown> {
  cursor_at: string;
  id: string;
}

export interface WorkoutPullRow extends Keyed {
  name: string;
  description: string | null;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export async function pullWorkouts(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<WorkoutPullRow[]> {
  const rows = await db.execute<WorkoutPullRow>(sql`
    select w.id, w.name, w.description, w.updated_at, w.deleted_at, w.updated_at::text as cursor_at
    from workout w
    where w.owner_id = ${range.userId}
      and ${inRange(sql`w.updated_at`, range)}
      and ${range.low === null ? sql`w.deleted_at is null` : sql`true`}
      and ${afterKey(sql`w.updated_at`, sql`w.id`, after)}
    order by w.updated_at, w.id
    limit ${limit}`);
  return [...rows];
}

export interface WorkoutExercisePullRow extends Record<string, unknown> {
  id: string;
  workout_id: string;
  exercise_id: string;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: string | null;
  target_duration_sec: number | null;
  target_distance_m: number | null;
  notes: string | null;
}

export async function pullWorkoutExercises(
  db: Executor,
  workoutIds: readonly string[],
): Promise<WorkoutExercisePullRow[]> {
  if (workoutIds.length === 0) return [];
  const rows = await db.execute<WorkoutExercisePullRow>(sql`
    select id, workout_id, exercise_id, target_sets, target_reps_min, target_reps_max,
      target_weight_kg, target_duration_sec, target_distance_m, notes
    from workout_exercise
    where workout_id = any(${uuids(workoutIds)})
    order by workout_id, position`);
  return [...rows];
}

export interface RulePullRow extends Keyed {
  workout_id: string;
  start_date: string;
  end_date: string | null;
  weekdays: number[];
  interval_weeks: number;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export async function pullRules(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<RulePullRow[]> {
  const rows = await db.execute<RulePullRow>(sql`
    select r.id, r.workout_id, r.start_date::text as start_date, r.end_date::text as end_date,
      r.weekdays, r.interval_weeks, r.updated_at, r.deleted_at, r.updated_at::text as cursor_at
    from schedule_rule r
    where r.user_id = ${range.userId}
      and ${inRange(sql`r.updated_at`, range)}
      and ${range.low === null ? sql`r.deleted_at is null` : sql`true`}
      and ${afterKey(sql`r.updated_at`, sql`r.id`, after)}
    order by r.updated_at, r.id
    limit ${limit}`);
  return [...rows];
}

/** Exercise ids that the user's live workouts and window sessions reference. */
function referencedExercises(range: PullRange): SQL {
  return sql`(
    select we.exercise_id from workout_exercise we
      join workout w on w.id = we.workout_id
      where w.owner_id = ${range.userId} and w.deleted_at is null
    union
    select l.exercise_id from set_log l
      join workout_session s on s.id = l.session_id
      where ${inWindow(sql`s`, range)}
    union
    select (item ->> 'exerciseId')::uuid from workout_session s,
      jsonb_array_elements(s.exercises) item
      where ${inWindow(sql`s`, range)}
  )`;
}

/** Exercise ids that a workout, session or set log of this run references. */
function newlyReferencedExercises(range: PullRange): SQL {
  return sql`(
    select we.exercise_id from workout_exercise we
      join workout w on w.id = we.workout_id
      where w.owner_id = ${range.userId} and w.deleted_at is null
        and ${inRange(sql`w.updated_at`, range)}
    union
    select l.exercise_id from set_log l
      join workout_session s on s.id = l.session_id
      where ${inWindow(sql`s`, range)} and ${inRange(sql`l.updated_at`, range)}
    union
    select (item ->> 'exerciseId')::uuid from workout_session s,
      jsonb_array_elements(s.exercises) item
      where ${inWindow(sql`s`, range)} and ${inRange(sql`s.updated_at`, range)}
  )`;
}

export interface ExercisePullRow extends Keyed {
  owner_id: string | null;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  movement_pattern: string | null;
  mechanic: string | null;
  laterality: string | null;
  tracking_type: string;
  difficulty: number | null;
  popularity: number | null;
  media: ExerciseMedia;
  gym_equipment: string[][];
  source_exercise_id: string | null;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export async function pullExercises(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<ExercisePullRow[]> {
  const own = sql`e.owner_id = ${range.userId}`;
  const visible = sql`(e.owner_id is null or e.owner_id = ${range.userId})`;
  const changed = sql`(${inRange(sql`e.updated_at`, range)} or exists (
    select 1 from exercise_translation t
    where t.exercise_id = e.id and ${inRange(sql`t.updated_at`, range)}))`;
  const filter =
    range.low === null
      ? sql`(e.id in ${referencedExercises(range)} and ${visible} and e.deleted_at is null)
          or (${own} and e.deleted_at is null)`
      : sql`(${own} and ${changed})
          or (e.id in ${referencedExercises(range)} and ${visible} and ${changed})
          or (e.id in ${newlyReferencedExercises(range)} and ${visible})`;
  const rows = await db.execute<ExercisePullRow>(sql`
    select e.id, e.owner_id, e.primary_muscles, e.secondary_muscles, e.equipment,
      e.movement_pattern, e.mechanic, e.laterality, e.tracking_type, e.difficulty, e.popularity,
      e.media, e.gym_equipment, e.source_exercise_id, e.updated_at, e.deleted_at,
      null::text as cursor_at
    from exercise e
    where (${filter}) and ${after ? sql`e.id > ${after.id}` : sql`true`}
    order by e.id
    limit ${limit}`);
  return [...rows];
}

export interface TranslationPullRow extends Record<string, unknown> {
  exercise_id: string;
  locale: string;
  name: string;
  aliases: string[];
  description: string;
  instructions: string[];
  common_mistakes: string[];
  search_name: string;
  search_aliases: string;
}

export async function pullTranslations(
  db: Executor,
  exerciseIds: readonly string[],
): Promise<TranslationPullRow[]> {
  if (exerciseIds.length === 0) return [];
  const rows = await db.execute<TranslationPullRow>(sql`
    select exercise_id, locale, name, aliases, description, instructions, common_mistakes,
      search_name, search_aliases
    from exercise_translation
    where exercise_id = any(${uuids(exerciseIds)})
    order by exercise_id, locale`);
  return [...rows];
}

/** Exercise ids in live workouts whose "last time" or bests may have changed in this run. */
export async function pullLastPerformanceIds(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<string[]> {
  const inWorkouts = sql`(
    select we.exercise_id from workout_exercise we
      join workout w on w.id = we.workout_id
      where w.owner_id = ${range.userId} and w.deleted_at is null)`;
  const changed =
    range.low === null
      ? sql`true`
      : sql`(x.id in (
          select l.exercise_id from set_log l
            join workout_session s on s.id = l.session_id
            where s.user_id = ${range.userId} and s.status = ${SESSION_STATUS.COMPLETED}
              and (${inRange(sql`l.updated_at`, range)} or ${inRange(sql`s.updated_at`, range)}))
          or x.id in (
          select we.exercise_id from workout_exercise we
            join workout w on w.id = we.workout_id
            where w.owner_id = ${range.userId} and w.deleted_at is null
              and ${inRange(sql`w.updated_at`, range)}))`;
  const rows = await db.execute<{ id: string }>(sql`
    select x.id from (select distinct exercise_id as id from ${inWorkouts} refs) x
    where ${changed} and ${after ? sql`x.id > ${after.id}` : sql`true`}
    order by x.id
    limit ${limit}`);
  return rows.map((row) => row.id);
}

export interface SessionPullRow extends Keyed {
  workout_id: string | null;
  scheduled_for: string | null;
  workout_snapshot: unknown;
  exercises: unknown;
  status: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  notes: string | null;
  updated_at: Date | string;
}

export async function pullSessions(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<SessionPullRow[]> {
  const rows = await db.execute<SessionPullRow>(sql`
    select s.id, s.workout_id, s.scheduled_for::text as scheduled_for, s.workout_snapshot,
      s.exercises, s.status, s.started_at, s.finished_at, s.notes, s.updated_at,
      s.updated_at::text as cursor_at
    from workout_session s
    where ${inWindow(sql`s`, range)}
      and ${inRange(sql`s.updated_at`, range)}
      and ${range.low === null ? sql`s.status <> ${SESSION_STATUS.ABANDONED}` : sql`true`}
      and ${afterKey(sql`s.updated_at`, sql`s.id`, after)}
    order by s.updated_at, s.id
    limit ${limit}`);
  return [...rows];
}

export interface SetLogPullRow extends Keyed {
  session_id: string;
  session_exercise_id: string;
  exercise_id: string;
  set_index: number;
  weight_kg: string | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  completed_at: Date | string;
  deleted_at: Date | string | null;
}

export async function pullSetLogs(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<SetLogPullRow[]> {
  const rows = await db.execute<SetLogPullRow>(sql`
    select l.id, l.session_id, l.session_exercise_id, l.exercise_id, l.set_index, l.weight_kg,
      l.reps, l.duration_sec, l.distance_m, l.completed_at, l.deleted_at,
      l.updated_at::text as cursor_at
    from set_log l
    join workout_session s on s.id = l.session_id
    where ${inWindow(sql`s`, range)}
      and ${range.low === null ? sql`s.status <> ${SESSION_STATUS.ABANDONED}` : sql`true`}
      and ${inRange(sql`l.updated_at`, range)}
      and ${range.low === null ? sql`l.deleted_at is null` : sql`true`}
      and ${afterKey(sql`l.updated_at`, sql`l.id`, after)}
    order by l.updated_at, l.id
    limit ${limit}`);
  return [...rows];
}

export interface MeasurementPullRow extends Keyed {
  type: string;
  value: string;
  measured_on: string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export async function pullMeasurements(
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
): Promise<MeasurementPullRow[]> {
  const rows = await db.execute<MeasurementPullRow>(sql`
    select m.id, m.type, m.value, m.measured_on::text as measured_on, m.updated_at, m.deleted_at,
      m.updated_at::text as cursor_at
    from body_measurement m
    where m.user_id = ${range.userId}
      and ${inRange(sql`m.updated_at`, range)}
      and ${range.low === null ? sql`m.deleted_at is null` : sql`true`}
      and ${afterKey(sql`m.updated_at`, sql`m.id`, after)}
    order by m.updated_at, m.id
    limit ${limit}`);
  return [...rows];
}

export async function profileChanged(db: Executor, range: PullRange): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(sql`
    select user_id as id from profile
    where user_id = ${range.userId} and ${inRange(sql`updated_at`, range)}`);
  return rows.length > 0;
}

export async function gymChanged(db: Executor, range: PullRange): Promise<boolean> {
  const rows = await db.execute<{ id: string }>(sql`
    select user_id as id from gym_profile
    where user_id = ${range.userId} and ${inRange(sql`updated_at`, range)}`);
  return rows.length > 0;
}
