// No value imports: the seed scripts run this file with plain Node, which does not resolve `@/`.
import type { ValueOf } from '@/types/utils';

export const MUSCLE_GROUP = {
  CHEST: 'chest',
  SHOULDERS: 'shoulders',
  TRICEPS: 'triceps',
  BICEPS: 'biceps',
  FOREARMS: 'forearms',
  LATS: 'lats',
  MIDDLE_BACK: 'middle_back',
  TRAPS: 'traps',
  LOWER_BACK: 'lower_back',
  ABDOMINALS: 'abdominals',
  GLUTES: 'glutes',
  QUADRICEPS: 'quadriceps',
  HAMSTRINGS: 'hamstrings',
  ADDUCTORS: 'adductors',
  ABDUCTORS: 'abductors',
  CALVES: 'calves',
  NECK: 'neck',
} as const;

export type MuscleGroup = ValueOf<typeof MUSCLE_GROUP>;

/** Display and catalog section order, top of the body to the bottom. */
export const MUSCLE_GROUPS: readonly MuscleGroup[] = Object.values(MUSCLE_GROUP);

export const EQUIPMENT = {
  BARBELL: 'barbell',
  EZ_BAR: 'ez_bar',
  DUMBBELL: 'dumbbell',
  KETTLEBELL: 'kettlebell',
  CABLE: 'cable',
  MACHINE: 'machine',
  BODYWEIGHT: 'bodyweight',
  BAND: 'band',
  OTHER: 'other',
} as const;

export type Equipment = ValueOf<typeof EQUIPMENT>;

export const EQUIPMENT_LIST: readonly Equipment[] = Object.values(EQUIPMENT);

export const MOVEMENT_PATTERN = {
  HORIZONTAL_PUSH: 'horizontal_push',
  VERTICAL_PUSH: 'vertical_push',
  HORIZONTAL_PULL: 'horizontal_pull',
  VERTICAL_PULL: 'vertical_pull',
  SQUAT: 'squat',
  HINGE: 'hinge',
  LUNGE: 'lunge',
  CARRY: 'carry',
  CORE: 'core',
  ISOLATION: 'isolation',
} as const;

export type MovementPattern = ValueOf<typeof MOVEMENT_PATTERN>;

export const MECHANIC = {
  COMPOUND: 'compound',
  ISOLATION: 'isolation',
} as const;

export type Mechanic = ValueOf<typeof MECHANIC>;

export const LATERALITY = {
  BILATERAL: 'bilateral',
  UNILATERAL: 'unilateral',
} as const;

export type Laterality = ValueOf<typeof LATERALITY>;

export const TRACKING_TYPE = {
  WEIGHT_REPS: 'weight_reps',
  REPS: 'reps',
  TIME: 'time',
  DISTANCE: 'distance',
} as const;

export type TrackingType = ValueOf<typeof TRACKING_TYPE>;

export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const POPULARITY = { min: 1, max: 100 } as const;

export const EXERCISE_NAME_MAX = 80;
export const EXERCISE_SEARCH_MAX = 60;
/** Page size the catalog requests. */
export const EXERCISE_PAGE_SIZE = 30;
/** List convention from docs/tech/API.md. */
export const LIST_LIMIT = { default: 50, max: 200 } as const;

export const EXERCISE_MEDIA_BUCKET = 'exercise-media';

export const OWN_EXERCISE_LIMIT = 300;
export const FRAME_LIMIT = 4;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** The browser scales photos down to this long side before upload. */
export const IMAGE_UPLOAD_MAX_SIDE = 1600;
export const DESCRIPTION_MAX = 500;
export const STEP_MAX = 200;
export const STEPS_MAX_COUNT = 10;
export const MISTAKES_MAX_COUNT = 5;
export const EXERCISE_USER_MEDIA_BUCKET = 'exercise-user-media';
export const SIGNED_URL_TTL_SECONDS = 3600;
