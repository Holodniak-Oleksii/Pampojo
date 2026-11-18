import type { ValueOf } from '@/types/utils';

// The key order is the display order of the add sheet.
export const MEASUREMENT_TYPE = {
  WEIGHT: 'weight',
  NECK: 'neck',
  SHOULDERS: 'shoulders',
  CHEST: 'chest',
  WAIST: 'waist',
  HIPS: 'hips',
  BICEPS_LEFT: 'biceps_left',
  BICEPS_RIGHT: 'biceps_right',
  FOREARM_LEFT: 'forearm_left',
  FOREARM_RIGHT: 'forearm_right',
  THIGH_LEFT: 'thigh_left',
  THIGH_RIGHT: 'thigh_right',
  CALF_LEFT: 'calf_left',
  CALF_RIGHT: 'calf_right',
  BODY_FAT_PCT: 'body_fat_pct',
} as const;

export type MeasurementType = ValueOf<typeof MEASUREMENT_TYPE>;

export const MEASUREMENT_TYPES: readonly MeasurementType[] = Object.values(MEASUREMENT_TYPE);

export type GirthType = Exclude<MeasurementType, 'weight' | 'body_fat_pct'>;

export const GIRTH_TYPES = MEASUREMENT_TYPES.filter(
  (type): type is GirthType =>
    type !== MEASUREMENT_TYPE.WEIGHT && type !== MEASUREMENT_TYPE.BODY_FAT_PCT,
);

export const MEASUREMENT_KIND = { WEIGHT: 'weight', GIRTH: 'girth', BODY_FAT: 'bodyFat' } as const;
export type MeasurementKind = ValueOf<typeof MEASUREMENT_KIND>;

/** Canonical units: kg, cm and %. */
export const MEASUREMENT_LIMITS = {
  weight: { min: 30, max: 300, decimals: 1 },
  girth: { min: 10, max: 250, decimals: 2 },
  bodyFat: { min: 2, max: 75, decimals: 2 },
} as const satisfies Record<MeasurementKind, { min: number; max: number; decimals: number }>;

// Imperial limits for error messages only; validation runs on the canonical value.
export const MEASUREMENT_LIMITS_IMPERIAL = {
  weight: { min: 67, max: 661 },
  girth: { min: 4, max: 98 },
} as const;

export function kindOf(type: MeasurementType): MeasurementKind {
  if (type === MEASUREMENT_TYPE.WEIGHT) return MEASUREMENT_KIND.WEIGHT;
  if (type === MEASUREMENT_TYPE.BODY_FAT_PCT) return MEASUREMENT_KIND.BODY_FAT;
  return MEASUREMENT_KIND.GIRTH;
}

export function limitsOf(type: MeasurementType) {
  return MEASUREMENT_LIMITS[kindOf(type)];
}
