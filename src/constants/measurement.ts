import type { ValueOf } from '@/types/utils';

export const MEASUREMENT_TYPE = {
  WEIGHT: 'weight',
  CHEST: 'chest',
  WAIST: 'waist',
  HIPS: 'hips',
  BICEPS_LEFT: 'biceps_left',
  BICEPS_RIGHT: 'biceps_right',
  THIGH_LEFT: 'thigh_left',
  THIGH_RIGHT: 'thigh_right',
  BODY_FAT_PCT: 'body_fat_pct',
} as const;

export type MeasurementType = ValueOf<typeof MEASUREMENT_TYPE>;
