import 'server-only';
import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { WORKOUT_LIMIT } from '@/constants/workout';
import type { Locale } from '@/i18n/config';
import { exercise, workout, workoutExercise } from '@/server/db/schema';
import { touch } from '@/server/db/utils';
import { translationJoins, type Executor, type Tx } from '@/server/exercises/queries';
import type { ExerciseMedia } from '@/shared/schemas/exercise';

export type { Executor, Tx };

export type WorkoutRow = typeof workout.$inferSelect;
export type WorkoutExerciseInsert = typeof workoutExercise.$inferInsert;

/** No owner filter on purpose: the service reports a foreign row as not found. */
export async function lockWorkoutRow(tx: Tx, id: string): Promise<WorkoutRow | undefined> {
  const [row] = await tx.select().from(workout).where(eq(workout.id, id)).for('update').limit(1);
  return row;
}

export async function countActiveWorkouts(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(workout)
    .where(and(eq(workout.ownerId, userId), isNull(workout.deletedAt)));
  return row?.value ?? 0;
}

export async function insertWorkout(tx: Tx, values: typeof workout.$inferInsert) {
  await tx.insert(workout).values(values);
}

export async function updateWorkoutColumns(
  tx: Tx,
  userId: string,
  id: string,
  fields: { name: string; description: string | null },
) {
  await tx
    .update(workout)
    .set({ ...fields, ...touch() })
    .where(and(eq(workout.id, id), eq(workout.ownerId, userId)));
}

export async function softDeleteWorkout(tx: Tx, userId: string, id: string) {
  await tx
    .update(workout)
    .set({ deletedAt: new Date(), ...touch() })
    .where(and(eq(workout.id, id), eq(workout.ownerId, userId)));
}

/** The caller has checked that the workout belongs to the user. */
export async function replaceWorkoutExercises(
  tx: Tx,
  workoutId: string,
  rows: WorkoutExerciseInsert[],
) {
  await tx.delete(workoutExercise).where(eq(workoutExercise.workoutId, workoutId));
  if (rows.length > 0) await tx.insert(workoutExercise).values(rows);
}

/** System exercises and the user's own live ones, among `ids`. */
export async function findVisibleExercises(
  tx: Tx,
  userId: string,
  ids: readonly string[],
): Promise<{ id: string; trackingType: string }[]> {
  if (ids.length === 0) return [];
  return tx
    .select({ id: exercise.id, trackingType: exercise.trackingType })
    .from(exercise)
    .where(
      and(
        inArray(exercise.id, [...ids]),
        or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
        isNull(exercise.deletedAt),
      ),
    );
}

export async function listWorkoutRows(db: Executor, userId: string): Promise<WorkoutRow[]> {
  return db
    .select()
    .from(workout)
    .where(and(eq(workout.ownerId, userId), isNull(workout.deletedAt)))
    .orderBy(sql`${workout.updatedAt} desc`, workout.id)
    .limit(WORKOUT_LIMIT);
}

export async function findWorkoutRow(
  db: Executor,
  userId: string,
  id: string,
): Promise<WorkoutRow | undefined> {
  const [row] = await db
    .select()
    .from(workout)
    .where(and(eq(workout.id, id), eq(workout.ownerId, userId), isNull(workout.deletedAt)))
    .limit(1);
  return row;
}

export async function hasActiveWorkout(db: Executor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workout.id })
    .from(workout)
    .where(and(eq(workout.ownerId, userId), isNull(workout.deletedAt)))
    .limit(1);
  return row !== undefined;
}

export interface WorkoutExerciseRow extends Record<string, unknown> {
  id: string;
  workout_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: string | null;
  target_duration_sec: number | null;
  target_distance_m: number | null;
  notes: string | null;
  name: string;
  tracking_type: string;
  laterality: string | null;
  primary_muscles: string[];
  media: ExerciseMedia;
  owner_id: string | null;
}

/** The exercises of the user's workouts in one query, ordered by workout and position. */
export async function listWorkoutExerciseRows(
  db: Executor,
  userId: string,
  locale: Locale,
  workoutIds: readonly string[],
): Promise<WorkoutExerciseRow[]> {
  if (workoutIds.length === 0) return [];
  const ids = sql`array[${sql.join(
    workoutIds.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;
  const rows = await db.execute<WorkoutExerciseRow>(sql`
    select we.id, we.workout_id, we.exercise_id, we.position, we.target_sets, we.target_reps_min,
      we.target_reps_max, we.target_weight_kg, we.target_duration_sec, we.target_distance_m,
      we.notes, coalesce(tr.name, tf.name) as name, e.tracking_type, e.laterality,
      e.primary_muscles, e.media, e.owner_id
    from workout_exercise we
    join workout w on w.id = we.workout_id and w.owner_id = ${userId}
    join exercise e on e.id = we.exercise_id
    ${translationJoins(locale)}
    where we.workout_id = any(${ids})
    order by we.workout_id, we.position`);
  return [...rows];
}

/** Removes an exercise from all of the user's workouts and marks those workouts as changed. */
export async function removeExerciseFromWorkouts(tx: Tx, userId: string, exerciseId: string) {
  await tx.execute(sql`
    with removed as (
      delete from workout_exercise we
      using workout w
      where w.id = we.workout_id and w.owner_id = ${userId} and we.exercise_id = ${exerciseId}
      returning we.workout_id
    )
    update workout set updated_at = now()
    where id in (select workout_id from removed)`);
}
