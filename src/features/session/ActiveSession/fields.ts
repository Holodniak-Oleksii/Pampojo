import { SET_FIELDS, SET_RANGE, type SetValueField } from '@/constants/session';
import type { TrackingType } from '@/constants/exercise';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DECIMAL = /^\d{1,6}([.,]\d{0,3})?$/;
const INTEGER = /^\d{1,6}$/;

/** Blank is `null`; text that is not a number yet is `undefined`, so typing is not interrupted. */
export function parseField(
  field: SetValueField,
  text: string,
  km: boolean,
): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const decimal = field === 'weightKg' || (field === 'distanceM' && km);
  if (!(decimal ? DECIMAL : INTEGER).test(trimmed)) return undefined;
  const value = Number(trimmed.replace(',', '.'));
  switch (field) {
    case 'weightKg': {
      const { min, max, step } = SET_RANGE.weightKg;
      return clamp(Math.round(value / step) * step, min, max);
    }
    case 'reps':
      return clamp(value, SET_RANGE.reps.min, SET_RANGE.reps.max);
    case 'durationSec':
      return clamp(value, SET_RANGE.durationSec.min, SET_RANGE.durationSec.max);
    case 'distanceM':
      return clamp(
        Math.round(km ? value * 1000 : value),
        SET_RANGE.distanceM.min,
        SET_RANGE.distanceM.max,
      );
  }
}

export function formatField(
  field: SetValueField,
  value: number,
  km: boolean,
  locale: string,
): string {
  const shown = field === 'distanceM' && km ? value / 1000 : value;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(
    shown,
  );
}

export function fieldsOf(trackingType: TrackingType): readonly SetValueField[] {
  return SET_FIELDS[trackingType];
}
