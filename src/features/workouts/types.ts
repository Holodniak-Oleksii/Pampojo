import type { WorkoutTargets } from '@/constants/workout';
import type { WorkoutExerciseSummary } from '@/shared/schemas/workout';

export interface DraftItem {
  /** The workout_exercise id, also the stable key for drag and drop. */
  key: string;
  exercise: WorkoutExerciseSummary;
  targets: WorkoutTargets;
  notes: string;
}

export interface Draft {
  id: string;
  name: string;
  description: string;
  items: DraftItem[];
}
