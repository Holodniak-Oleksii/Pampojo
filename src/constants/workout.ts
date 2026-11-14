import type { TrackingType } from './exercise';

export const WORKOUT_NAME_MAX = 80;
export const WORKOUT_DESCRIPTION_MAX = 500;
export const WORKOUT_NOTE_MAX = 300;
export const WORKOUT_EXERCISES_MAX = 30;
export const WORKOUT_LIMIT = 200;

export const TARGET_RANGE = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  weightKg: { min: 0, max: 500, step: 0.25 },
  durationSec: { min: 5, max: 3600 },
  distanceM: { min: 10, max: 100_000 },
} as const;

export const TARGET_FIELD = {
  SETS: 'sets',
  REPS: 'reps',
  WEIGHT: 'weight',
  DURATION: 'duration',
  DISTANCE: 'distance',
} as const;

export type TargetField = (typeof TARGET_FIELD)[keyof typeof TARGET_FIELD];

export interface WorkoutTargets {
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  targetDurationSec: number | null;
  targetDistanceM: number | null;
}

/** Targets prefilled when an exercise is added (DECISIONS 2026-11-14). */
export const TARGET_DEFAULTS = {
  weight_reps: { targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
  reps: { targetSets: 3, targetRepsMin: 10, targetRepsMax: 15 },
  time: { targetSets: 3, targetDurationSec: 30 },
  distance: { targetSets: 1 },
} as const satisfies Record<TrackingType, Partial<WorkoutTargets>>;

/** Which target fields each tracking type allows. */
export const TARGET_FIELDS = {
  weight_reps: ['sets', 'reps', 'weight'],
  reps: ['sets', 'reps'],
  time: ['sets', 'duration'],
  distance: ['sets', 'distance'],
} as const satisfies Record<TrackingType, readonly TargetField[]>;

/** The target columns each field writes. */
export const TARGET_FIELD_KEYS = {
  sets: ['targetSets'],
  reps: ['targetRepsMin', 'targetRepsMax'],
  weight: ['targetWeightKg'],
  duration: ['targetDurationSec'],
  distance: ['targetDistanceM'],
} as const satisfies Record<TargetField, readonly (keyof WorkoutTargets)[]>;
