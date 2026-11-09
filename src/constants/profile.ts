import type { ValueOf } from '@/types/utils';

export const SEX = {
  MALE: 'male',
  FEMALE: 'female',
} as const;

export type Sex = ValueOf<typeof SEX>;

export const UNIT_SYSTEM = {
  METRIC: 'metric',
  IMPERIAL: 'imperial',
} as const;

export type UnitSystem = ValueOf<typeof UNIT_SYSTEM>;

export const NAME_MAX = 40;
export const AGE_MIN = 16;
export const AGE_MAX = 100;
export const HEIGHT_CM = { min: 100, max: 250 } as const;
export const WEIGHT_KG = { min: 30, max: 300 } as const;

// Imperial limits for error messages only; validation always runs on the converted metric value.
export const HEIGHT_FT_IN = { min: { feet: 3, inches: 4 }, max: { feet: 8, inches: 2 } } as const;
export const WEIGHT_LB = { min: 67, max: 661 } as const;
