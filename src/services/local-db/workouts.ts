import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/search';
import { summarizeWorkout } from '@/shared/workout-summary';
import type {
  Workout,
  WorkoutExerciseSummary,
  WorkoutListResponse,
} from '@/shared/schemas/workout';
import type { LocalExercise, LocalWorkout, PampojoDb } from './db';
import { localExerciseName } from './exercises';

function summaryOf(
  exerciseId: string,
  exercise: LocalExercise | undefined,
  lang: string,
): WorkoutExerciseSummary {
  return {
    id: exerciseId,
    name: exercise ? localExerciseName(exercise, lang) : '',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    laterality: exercise?.laterality ?? null,
    primaryMuscles: exercise?.primaryMuscles ?? [],
    thumbnailUrl: exercise?.frames[0]?.thumbUrl ?? null,
    isOwn: exercise?.isOwn === 1,
  };
}

async function exercisesById(db: PampojoDb, workouts: readonly LocalWorkout[]) {
  const ids = [
    ...new Set(workouts.flatMap((workout) => workout.exercises.map((item) => item.exerciseId))),
  ];
  const rows = await db.exercises.bulkGet(ids);
  return new Map(rows.flatMap((row) => (row ? [[row.id, row] as const] : [])));
}

/** Live workouts, newest change first, as `GET /workouts` lists them. */
export async function listLocalWorkouts(db: PampojoDb): Promise<WorkoutListResponse> {
  const workouts = (await db.workouts.toArray())
    .filter((workout) => workout.deletedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const exercises = await exercisesById(db, workouts);
  return {
    items: workouts.map((workout) => ({
      id: workout.id,
      name: workout.name,
      updatedAt: workout.updatedAt,
      ...summarizeWorkout(
        workout.exercises.map((item) => {
          const exercise = exercises.get(item.exerciseId);
          return {
            exerciseId: item.exerciseId,
            primaryMuscles: exercise?.primaryMuscles ?? [],
            thumbnailUrl: exercise?.frames[0]?.thumbUrl ?? null,
          };
        }),
      ),
    })),
  };
}

/** `null` for a missing or deleted workout, as `fetchWorkout` answers. */
export async function getLocalWorkout(
  db: PampojoDb,
  id: string,
  lang: string,
): Promise<Workout | null> {
  const workout = await db.workouts.get(id);
  if (!workout || workout.deletedAt) return null;
  const exercises = await exercisesById(db, [workout]);
  return {
    id: workout.id,
    name: workout.name,
    description: workout.description,
    updatedAt: workout.updatedAt,
    exercises: workout.exercises.map((item) => ({
      ...item,
      exercise: summaryOf(item.exerciseId, exercises.get(item.exerciseId), lang),
    })),
  };
}

export function fromWorkoutResponse(workout: Workout): LocalWorkout {
  return {
    id: workout.id,
    name: workout.name,
    description: workout.description,
    updatedAt: workout.updatedAt,
    deletedAt: null,
    exercises: workout.exercises.map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      targetSets: item.targetSets,
      targetRepsMin: item.targetRepsMin,
      targetRepsMax: item.targetRepsMax,
      targetWeightKg: item.targetWeightKg,
      targetDurationSec: item.targetDurationSec,
      targetDistanceM: item.targetDistanceM,
      notes: item.notes,
    })),
  };
}

export async function putLocalWorkout(db: PampojoDb, workout: LocalWorkout): Promise<void> {
  await db.workouts.put(workout);
}

/** Deleted workouts stay as tombstones, because the plan still shows the names of their rules. */
export async function markLocalWorkoutDeleted(db: PampojoDb, id: string): Promise<void> {
  const now = new Date().toISOString();
  await db.workouts.update(id, { deletedAt: now, updatedAt: now });
}

/**
 * Puts a placeholder row for each exercise of a REST workout that the device does not have yet,
 * built from the summary in the response, so names show at once. The next pull replaces it.
 */
export async function putMissingWorkoutExercises(
  db: PampojoDb,
  workout: Workout,
  lang: Locale,
): Promise<void> {
  const ids = [...new Set(workout.exercises.map((item) => item.exerciseId))];
  const existing = await db.exercises.bulkGet(ids);
  const known = new Set(existing.flatMap((row) => (row ? [row.id] : [])));
  const missing = new Map<string, WorkoutExerciseSummary>();
  for (const item of workout.exercises) {
    if (!known.has(item.exerciseId)) missing.set(item.exerciseId, item.exercise);
  }
  await db.exercises.bulkPut(
    [...missing.values()].map((summary) => ({
      id: summary.id,
      isOwn: summary.isOwn ? 1 : 0,
      primaryMuscles: summary.primaryMuscles,
      secondaryMuscles: [],
      equipment: [],
      movementPattern: null,
      mechanic: null,
      laterality: summary.laterality,
      trackingType: summary.trackingType,
      difficulty: null,
      popularity: null,
      frames: summary.thumbnailUrl
        ? [{ id: null, thumbUrl: summary.thumbnailUrl, fullUrl: summary.thumbnailUrl }]
        : [],
      gymEquipment: [],
      sourceExerciseId: null,
      // The oldest time, so any pulled row wins.
      updatedAt: new Date(0).toISOString(),
      deletedAt: null,
      translations: [
        {
          locale: lang,
          name: summary.name,
          aliases: [],
          description: '',
          instructions: [],
          commonMistakes: [],
          searchName: normalizeSearch(summary.name),
          searchAliases: '',
        },
      ],
    })),
  );
}
