import type { TFunction } from 'i18next';
import {
  kindOf,
  MEASUREMENT_KIND,
  MEASUREMENT_LIMITS_IMPERIAL,
  MEASUREMENT_TYPE,
  limitsOf,
  type MeasurementType,
} from '@/constants/measurement';
import { UNIT_SYSTEM, type UnitSystem } from '@/constants/profile';
import type { Locale } from '@/i18n/config';
import { formatNumber } from '@/i18n/format';
import {
  cmFromIn,
  inFromCm,
  kgFromLb,
  lbFromKg,
  parseDecimal,
  parseDecimal2,
  round1,
  round2,
} from '@/lib/units';
import type { Measurement } from '@/shared/schemas/measurement';

export const BMI_CATEGORY = {
  UNDERWEIGHT: 'underweight',
  NORMAL: 'normal',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
} as const;
export type BmiCategory = (typeof BMI_CATEGORY)[keyof typeof BMI_CATEGORY];

export const BMI_SCALE = { min: 15, max: 40 } as const;

export function bmi(weightKg: number, heightCm: number): number {
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}

/** WHO adult ranges. */
export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return BMI_CATEGORY.UNDERWEIGHT;
  if (value < 25) return BMI_CATEGORY.NORMAL;
  if (value < 30) return BMI_CATEGORY.OVERWEIGHT;
  return BMI_CATEGORY.OBESE;
}

/** 0–1 on the 15–40 scale; values outside sit at the nearest end. */
export function bmiScalePosition(value: number): number {
  const clamped = Math.min(BMI_SCALE.max, Math.max(BMI_SCALE.min, value));
  return (clamped - BMI_SCALE.min) / (BMI_SCALE.max - BMI_SCALE.min);
}

export function bmiCategoryName(t: TFunction, category: BmiCategory): string {
  switch (category) {
    case BMI_CATEGORY.UNDERWEIGHT:
      return t('Underweight');
    case BMI_CATEGORY.NORMAL:
      return t('Normal', { context: 'bmi' });
    case BMI_CATEGORY.OVERWEIGHT:
      return t('Overweight');
    case BMI_CATEGORY.OBESE:
      return t('Obese');
  }
}

/** Live rows grouped by type, each list newest first. */
export function byType(items: readonly Measurement[]): Map<MeasurementType, Measurement[]> {
  const map = new Map<MeasurementType, Measurement[]>();
  for (const item of items) {
    const list = map.get(item.type) ?? [];
    list.push(item);
    map.set(item.type, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.measuredOn < b.measuredOn ? 1 : a.measuredOn > b.measuredOn ? -1 : 0));
  }
  return map;
}

/** Latest − previous, or null with fewer than 2 rows. `list` is newest first. */
export function changeOf(list: readonly Measurement[]): number | null {
  const [latest, previous] = list;
  if (!latest || !previous) return null;
  return round2(latest.value - previous.value);
}

/** The value in the unit the user sees: lb and in for imperial, else canonical. */
export function displayValue(type: MeasurementType, value: number, units: UnitSystem): number {
  if (units !== UNIT_SYSTEM.IMPERIAL) return value;
  const kind = kindOf(type);
  if (kind === MEASUREMENT_KIND.WEIGHT) return lbFromKg(value);
  if (kind === MEASUREMENT_KIND.GIRTH) return inFromCm(value);
  return value;
}

function digits(type: MeasurementType): Intl.NumberFormatOptions {
  return kindOf(type) === MEASUREMENT_KIND.WEIGHT
    ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
    : { minimumFractionDigits: 1, maximumFractionDigits: 2 };
}

/** The number only, in the user's unit: "104,25". */
export function formatNumberOf(
  locale: Locale,
  type: MeasurementType,
  value: number,
  units: UnitSystem,
): string {
  return formatNumber(locale, displayValue(type, value, units), digits(type));
}

export function withUnit(
  t: TFunction,
  type: MeasurementType,
  value: string,
  units: UnitSystem,
): string {
  const imperial = units === UNIT_SYSTEM.IMPERIAL;
  switch (kindOf(type)) {
    case MEASUREMENT_KIND.WEIGHT:
      return imperial ? t('{{value}} lb', { value }) : t('{{value}} kg', { value });
    case MEASUREMENT_KIND.GIRTH:
      return imperial ? t('{{value}} in', { value }) : t('{{value}} cm', { value });
    case MEASUREMENT_KIND.BODY_FAT:
      return t('{{value}} %', { value });
  }
}

export function unitLabel(t: TFunction, type: MeasurementType, units: UnitSystem): string {
  const imperial = units === UNIT_SYSTEM.IMPERIAL;
  switch (kindOf(type)) {
    case MEASUREMENT_KIND.WEIGHT:
      return imperial ? t('lb') : t('kg');
    case MEASUREMENT_KIND.GIRTH:
      return imperial ? t('in') : t('cm');
    case MEASUREMENT_KIND.BODY_FAT:
      return '%';
  }
}

/** "104,25 см" in the user's unit. */
export function formatMeasurement(
  t: TFunction,
  locale: Locale,
  type: MeasurementType,
  value: number,
  units: UnitSystem,
): string {
  return withUnit(t, type, formatNumberOf(locale, type, value, units), units);
}

/** "+1,25 см", "−0,6 кг" or "0 см". The change is in canonical units. */
export function formatChange(
  t: TFunction,
  locale: Locale,
  type: MeasurementType,
  change: number,
  units: UnitSystem,
): string {
  const shown = round2(displayValue(type, Math.abs(change), units));
  const number = formatNumber(locale, shown, { maximumFractionDigits: 2 });
  const sign = change > 0 ? '+' : change < 0 ? '−' : '';
  return withUnit(t, type, `${sign}${number}`, units);
}

/** The canonical value of the typed text, or null when the text is not a number. */
export function toCanonical(type: MeasurementType, text: string, units: UnitSystem): number | null {
  const kind = kindOf(type);
  const parsed =
    kind === MEASUREMENT_KIND.WEIGHT && units !== UNIT_SYSTEM.IMPERIAL
      ? parseDecimal(text)
      : parseDecimal2(text);
  if (parsed === null) return null;
  if (units !== UNIT_SYSTEM.IMPERIAL) return parsed;
  if (kind === MEASUREMENT_KIND.WEIGHT) return kgFromLb(parsed);
  if (kind === MEASUREMENT_KIND.GIRTH) return cmFromIn(parsed);
  return parsed;
}

/** The limits in the user's unit, for error messages. */
export function displayLimits(type: MeasurementType, units: UnitSystem) {
  const kind = kindOf(type);
  if (units === UNIT_SYSTEM.IMPERIAL && kind !== MEASUREMENT_KIND.BODY_FAT) {
    return MEASUREMENT_LIMITS_IMPERIAL[kind];
  }
  const { min, max } = limitsOf(type);
  return { min, max };
}

/** The value as the input shows it: no unit, no grouping. */
export function inputText(
  locale: Locale,
  type: MeasurementType,
  value: number,
  units: UnitSystem,
): string {
  const shown = displayValue(type, value, units);
  const rounded = kindOf(type) === MEASUREMENT_KIND.WEIGHT ? round1(shown) : round2(shown);
  return formatNumber(locale, rounded, { maximumFractionDigits: 2, useGrouping: false });
}

export function typeName(t: TFunction, type: MeasurementType): string {
  switch (type) {
    case MEASUREMENT_TYPE.WEIGHT:
      return t('Weight');
    case MEASUREMENT_TYPE.NECK:
      return t('Neck');
    case MEASUREMENT_TYPE.SHOULDERS:
      return t('Shoulders');
    case MEASUREMENT_TYPE.CHEST:
      return t('Chest');
    case MEASUREMENT_TYPE.WAIST:
      return t('Waist');
    case MEASUREMENT_TYPE.HIPS:
      return t('Hips');
    case MEASUREMENT_TYPE.BICEPS_LEFT:
      return t('Biceps, left');
    case MEASUREMENT_TYPE.BICEPS_RIGHT:
      return t('Biceps, right');
    case MEASUREMENT_TYPE.FOREARM_LEFT:
      return t('Forearm, left');
    case MEASUREMENT_TYPE.FOREARM_RIGHT:
      return t('Forearm, right');
    case MEASUREMENT_TYPE.THIGH_LEFT:
      return t('Thigh, left');
    case MEASUREMENT_TYPE.THIGH_RIGHT:
      return t('Thigh, right');
    case MEASUREMENT_TYPE.CALF_LEFT:
      return t('Calf, left');
    case MEASUREMENT_TYPE.CALF_RIGHT:
      return t('Calf, right');
    case MEASUREMENT_TYPE.BODY_FAT_PCT:
      return t('Body fat');
  }
}

/** The chip name on the figure: the side comes from the column header. */
export function shortName(t: TFunction, type: MeasurementType): string {
  switch (type) {
    case MEASUREMENT_TYPE.BICEPS_LEFT:
    case MEASUREMENT_TYPE.BICEPS_RIGHT:
      return t('Biceps');
    case MEASUREMENT_TYPE.FOREARM_LEFT:
    case MEASUREMENT_TYPE.FOREARM_RIGHT:
      return t('Forearm');
    case MEASUREMENT_TYPE.THIGH_LEFT:
    case MEASUREMENT_TYPE.THIGH_RIGHT:
      return t('Thigh');
    case MEASUREMENT_TYPE.CALF_LEFT:
    case MEASUREMENT_TYPE.CALF_RIGHT:
      return t('Calf');
    default:
      return typeName(t, type);
  }
}

export function measurementHref(type: MeasurementType): string {
  return `/profile/measurements/${type}`;
}
