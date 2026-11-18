import type { TrackingType } from './exercise';
import type { ValueOf } from '@/types/utils';

export const PROGRESS_RANGE = { M1: '1m', M3: '3m', M6: '6m', Y1: '1y', ALL: 'all' } as const;

export type ProgressRange = ValueOf<typeof PROGRESS_RANGE>;

export const PROGRESS_RANGES: readonly ProgressRange[] = Object.values(PROGRESS_RANGE);

export const DEFAULT_PROGRESS_RANGE: ProgressRange = PROGRESS_RANGE.M3;

/** Months back from today for each range; null is the whole history. */
export const PROGRESS_RANGE_MONTHS: Record<ProgressRange, number | null> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
  all: null,
};

export const RECORD_TYPE = {
  HEAVIEST_WEIGHT: 'heaviest_weight',
  BEST_E1RM: 'best_e1rm',
  MOST_REPS: 'most_reps',
  BEST_VOLUME: 'best_volume',
  LONGEST_DURATION: 'longest_duration',
  LONGEST_DISTANCE: 'longest_distance',
} as const;

export type RecordType = ValueOf<typeof RECORD_TYPE>;

export const PROGRESS_METRIC = {
  E1RM: 'e1rmKg',
  TOP_WEIGHT: 'topWeightKg',
  VOLUME: 'volumeKg',
  REPS: 'reps',
  DURATION: 'durationSec',
  DISTANCE: 'distanceM',
} as const;

export type ProgressMetric = ValueOf<typeof PROGRESS_METRIC>;

/** Chart metrics per tracking type; the first one is the default. */
export const METRICS_BY_TRACKING: Record<TrackingType, readonly ProgressMetric[]> = {
  weight_reps: [PROGRESS_METRIC.E1RM, PROGRESS_METRIC.TOP_WEIGHT, PROGRESS_METRIC.VOLUME],
  reps: [PROGRESS_METRIC.REPS],
  time: [PROGRESS_METRIC.DURATION],
  distance: [PROGRESS_METRIC.DISTANCE],
};

/** Records per tracking type, in display order. */
export const RECORDS_BY_TRACKING: Record<TrackingType, readonly RecordType[]> = {
  weight_reps: [
    RECORD_TYPE.HEAVIEST_WEIGHT,
    RECORD_TYPE.BEST_E1RM,
    RECORD_TYPE.MOST_REPS,
    RECORD_TYPE.BEST_VOLUME,
  ],
  reps: [RECORD_TYPE.MOST_REPS],
  time: [RECORD_TYPE.LONGEST_DURATION],
  distance: [RECORD_TYPE.LONGEST_DISTANCE],
};

/** Epley is used only in this rep range. */
export const E1RM_REPS = { min: 1, max: 12 } as const;

/** How long a progress view stays fresh, and how long it stays in memory for offline use. */
export const PROGRESS_STALE_MS = 5 * 60_000;
export const PROGRESS_GC_MS = 24 * 60 * 60_000;
