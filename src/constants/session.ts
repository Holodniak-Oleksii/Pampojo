import type { TrackingType } from './exercise';
import type { ValueOf } from '@/types/utils';

export const SESSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const;

export type SessionStatus = ValueOf<typeof SESSION_STATUS>;

export const SESSION_STATUSES: readonly SessionStatus[] = Object.values(SESSION_STATUS);

export const SESSION_EXERCISES_MAX = 30;
export const SESSION_SETS_MAX = 20;
export const SESSION_NOTE_MAX = 1000;
export const DEFAULT_PLANNED_SETS = 3;

export const SET_RANGE = {
  weightKg: { min: 0, max: 500, step: 0.25 },
  reps: { min: 1, max: 100 },
  durationSec: { min: 1, max: 3600 },
  distanceM: { min: 1, max: 100_000 },
} as const;

export const REST = { defaultSec: 90, stepSec: 15, minSec: 15, maxSec: 600 } as const;

export const FORGOTTEN_AFTER_MS = 12 * 60 * 60 * 1000;
/** Client timestamps may be at most this far in the future. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const SESSION_LIST_LIMIT = 200;

export type SetValueField = 'weightKg' | 'reps' | 'durationSec' | 'distanceM';

export const SET_VALUE_FIELDS: readonly SetValueField[] = [
  'weightKg',
  'reps',
  'durationSec',
  'distanceM',
];

/** The value that must be filled before a set can be logged. */
export const MAIN_METRIC = {
  weight_reps: 'reps',
  reps: 'reps',
  time: 'durationSec',
  distance: 'distanceM',
} as const satisfies Record<TrackingType, SetValueField>;

/** Value fields per tracking type. */
export const SET_FIELDS = {
  weight_reps: ['weightKg', 'reps'],
  reps: ['reps'],
  time: ['durationSec'],
  distance: ['distanceM'],
} as const satisfies Record<TrackingType, readonly SetValueField[]>;
