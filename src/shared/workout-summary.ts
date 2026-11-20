import { MUSCLE_GROUPS, type MuscleGroup } from '@/constants/exercise';

const LIST_MUSCLES = 3;
const LIST_THUMBNAILS = 12;

export interface SummaryExercise {
  exerciseId: string;
  primaryMuscles: readonly string[];
  thumbnailUrl: string | null;
}

export interface WorkoutSummary {
  exerciseCount: number;
  exerciseIds: string[];
  primaryMuscles: MuscleGroup[];
  thumbnailUrls: string[];
}

const isMuscle = (value: string): value is MuscleGroup =>
  (MUSCLE_GROUPS as readonly string[]).includes(value);

/** The list fields of a workout; the server and the device both use it, so they cannot differ. */
export function summarizeWorkout(exercises: readonly SummaryExercise[]): WorkoutSummary {
  const exerciseIds: string[] = [];
  const thumbnailUrls: string[] = [];
  const seen = new Set<string>();
  const counts = new Map<MuscleGroup, number>();
  for (const item of exercises) {
    for (const muscle of item.primaryMuscles.filter(isMuscle)) {
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
    }
    if (seen.has(item.exerciseId)) continue;
    seen.add(item.exerciseId);
    exerciseIds.push(item.exerciseId);
    if (item.thumbnailUrl && thumbnailUrls.length < LIST_THUMBNAILS) {
      thumbnailUrls.push(item.thumbnailUrl);
    }
  }
  // Ties keep the order the muscles first appear in, because the sort is stable.
  const primaryMuscles = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIST_MUSCLES)
    .map(([muscle]) => muscle);
  return { exerciseCount: exercises.length, exerciseIds, primaryMuscles, thumbnailUrls };
}
