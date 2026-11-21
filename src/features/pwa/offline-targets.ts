import { MEASUREMENT_TYPES } from '@/constants/measurement';
import type { PampojoDb } from '@/services/local-db/db';

export interface OfflineTargets {
  paths: string[];
  imageUrls: string[];
}

/** The pages and images of the user's own data that must open offline (spec 17). */
export async function offlineTargets(db: PampojoDb): Promise<OfflineTargets> {
  const [workouts, exercises, sessions] = await Promise.all([
    db.workouts.toArray(),
    db.exercises.toArray(),
    db.sessions.toArray(),
  ]);
  const liveWorkouts = workouts.filter((workout) => workout.deletedAt === null);
  const liveExercises = exercises.filter((exercise) => exercise.deletedAt === null);
  const used = new Set([
    ...liveWorkouts.flatMap((workout) => workout.exercises.map((item) => item.exerciseId)),
    ...sessions.flatMap((session) => session.exercises.map((item) => item.exerciseId)),
  ]);
  return {
    paths: [
      ...liveWorkouts.map((workout) => `/library/workouts/${workout.id}`),
      ...liveExercises.map((exercise) => `/library/exercises/${exercise.id}`),
      ...MEASUREMENT_TYPES.map((type) => `/profile/measurements/${type}`),
    ],
    imageUrls: liveExercises
      .filter((exercise) => used.has(exercise.id))
      .flatMap((exercise) => exercise.frames.flatMap((frame) => [frame.thumbUrl, frame.fullUrl])),
  };
}
