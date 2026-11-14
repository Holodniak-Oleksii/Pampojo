import 'server-only';
import { LATERALITY, MUSCLE_GROUPS, type Laterality, type MuscleGroup } from '@/constants/exercise';
import {
  TARGET_FIELD_KEYS,
  TARGET_FIELDS,
  WORKOUT_LIMIT,
  type TargetField,
} from '@/constants/workout';
import type { Locale } from '@/i18n/config';
import { getDb } from '@/server/db/client';
import { resolveFrames } from '@/server/exercises/media';
import { lockOwner } from '@/server/exercises/queries';
import { knownTrackingType, only, orNull } from '@/server/exercises/service';
import { DomainError } from '@/server/http/errors';
import type {
  ParsedPutWorkoutInput,
  Workout,
  WorkoutExercise,
  WorkoutListResponse,
} from '@/shared/schemas/workout';
import { WORKOUT_ERROR } from './errors';
import {
  countActiveWorkouts,
  findVisibleExercises,
  findWorkoutRow,
  hasActiveWorkout,
  insertWorkout,
  listWorkoutExerciseRows,
  listWorkoutRows,
  lockWorkoutRow,
  replaceWorkoutExercises,
  softDeleteWorkout,
  updateWorkoutColumns,
  type Executor,
  type WorkoutExerciseRow,
} from './queries';

const LIST_MUSCLES = 3;
const LIST_THUMBNAILS = 4;

function notFound(): DomainError {
  return new DomainError(WORKOUT_ERROR.NOT_FOUND, 'Workout not found');
}

function invalid(path: (string | number)[], message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 'Validation failed', [
    { code: 'custom', path, message },
  ]);
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

/** The most frequent primary muscles; ties keep the order they first appear in. */
function topMuscles(rows: readonly WorkoutExerciseRow[]): MuscleGroup[] {
  const counts = new Map<MuscleGroup, number>();
  for (const row of rows) {
    for (const muscle of only<MuscleGroup>(MUSCLE_GROUPS, row.primary_muscles)) {
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIST_MUSCLES)
    .map(([muscle]) => muscle);
}

export async function listWorkouts(
  userId: string,
  locale: Locale,
  db: Executor = getDb(),
): Promise<WorkoutListResponse> {
  const workouts = await listWorkoutRows(db, userId);
  const rows = await listWorkoutExerciseRows(
    db,
    userId,
    locale,
    workouts.map((row) => row.id),
  );
  const frames = await resolveFrames(rows);
  const byWorkout = new Map<string, { row: WorkoutExerciseRow; thumb: string | null }[]>();
  rows.forEach((row, index) => {
    const list = byWorkout.get(row.workout_id) ?? [];
    list.push({ row, thumb: frames[index]?.[0]?.thumbUrl ?? null });
    byWorkout.set(row.workout_id, list);
  });

  return {
    items: workouts.map((item) => {
      const entries = byWorkout.get(item.id) ?? [];
      const exerciseIds = [...new Set(entries.map(({ row }) => row.exercise_id))];
      const thumbnailUrls: string[] = [];
      const seen = new Set<string>();
      for (const { row, thumb } of entries) {
        if (seen.has(row.exercise_id)) continue;
        seen.add(row.exercise_id);
        if (thumb && thumbnailUrls.length < LIST_THUMBNAILS) thumbnailUrls.push(thumb);
      }
      return {
        id: item.id,
        name: item.name,
        updatedAt: item.updatedAt.toISOString(),
        exerciseCount: entries.length,
        exerciseIds,
        primaryMuscles: topMuscles(entries.map(({ row }) => row)),
        thumbnailUrls,
      };
    }),
  };
}

export async function getWorkout(
  userId: string,
  locale: Locale,
  id: string,
  db: Executor = getDb(),
): Promise<Workout> {
  const row = await findWorkoutRow(db, userId, id);
  if (!row) throw notFound();
  const rows = await listWorkoutExerciseRows(db, userId, locale, [id]);
  const frames = await resolveFrames(rows);
  const exercises: WorkoutExercise[] = rows.map((item, index) => ({
    id: item.id,
    exerciseId: item.exercise_id,
    targetSets: item.target_sets,
    targetRepsMin: item.target_reps_min,
    targetRepsMax: item.target_reps_max,
    targetWeightKg: toNumber(item.target_weight_kg),
    targetDurationSec: item.target_duration_sec,
    targetDistanceM: item.target_distance_m,
    notes: item.notes,
    exercise: {
      id: item.exercise_id,
      name: item.name,
      trackingType: knownTrackingType(item.tracking_type),
      laterality: orNull<Laterality>(Object.values(LATERALITY), item.laterality),
      primaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, item.primary_muscles),
      thumbnailUrl: frames[index]?.[0]?.thumbUrl ?? null,
      isOwn: item.owner_id === userId,
    },
  }));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
    exercises,
  };
}

const ALL_FIELDS = Object.keys(TARGET_FIELD_KEYS) as TargetField[];

/**
 * Idempotent create or replace with a client id (request-safety.md): a replay writes the same
 * values again. The workout and its exercises change together in one transaction.
 */
export async function putWorkout(
  userId: string,
  locale: Locale,
  id: string,
  input: ParsedPutWorkoutInput,
  db: Executor = getDb(),
): Promise<Workout> {
  await db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const existing = await lockWorkoutRow(tx, id);
    if (existing && (existing.ownerId !== userId || existing.deletedAt)) throw notFound();
    if (!existing && (await countActiveWorkouts(tx, userId)) >= WORKOUT_LIMIT) {
      throw new DomainError(WORKOUT_ERROR.LIMIT_REACHED, 'Workout limit reached');
    }

    const visible = await findVisibleExercises(tx, userId, [
      ...new Set(input.exercises.map((item) => item.exerciseId)),
    ]);
    const trackingOf = new Map(visible.map((row) => [row.id, knownTrackingType(row.trackingType)]));
    input.exercises.forEach((item, index) => {
      const trackingType = trackingOf.get(item.exerciseId);
      if (!trackingType) throw invalid(['exercises', index, 'exerciseId'], 'Unknown exercise');
      const allowed: readonly TargetField[] = TARGET_FIELDS[trackingType];
      for (const field of ALL_FIELDS) {
        if (allowed.includes(field)) continue;
        for (const key of TARGET_FIELD_KEYS[field]) {
          if (item[key] !== null) {
            throw invalid(['exercises', index, key], `Not a target of ${trackingType} exercises`);
          }
        }
      }
    });

    if (existing) {
      await updateWorkoutColumns(tx, userId, id, {
        name: input.name,
        description: input.description,
      });
    } else {
      await insertWorkout(tx, {
        id,
        ownerId: userId,
        name: input.name,
        description: input.description,
      });
    }
    await replaceWorkoutExercises(
      tx,
      id,
      input.exercises.map((item, position) => ({
        id: item.id,
        workoutId: id,
        exerciseId: item.exerciseId,
        position,
        targetSets: item.targetSets,
        targetRepsMin: item.targetRepsMin,
        targetRepsMax: item.targetRepsMax,
        targetWeightKg: item.targetWeightKg === null ? null : String(item.targetWeightKg),
        targetDurationSec: item.targetDurationSec,
        targetDistanceM: item.targetDistanceM,
        notes: item.notes,
      })),
    );
  });
  return getWorkout(userId, locale, id, db);
}

/** A repeat of a delete is a no-op, so retries are safe. */
export async function deleteWorkout(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockWorkoutRow(tx, id);
    if (!row || row.ownerId !== userId) throw notFound();
    if (row.deletedAt) return;
    await softDeleteWorkout(tx, userId, id);
  });
}

export async function hasWorkouts(userId: string, db: Executor = getDb()): Promise<boolean> {
  return hasActiveWorkout(db, userId);
}
