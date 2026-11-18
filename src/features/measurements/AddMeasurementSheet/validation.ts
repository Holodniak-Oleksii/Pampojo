import type { TFunction } from 'i18next';
import type { FieldErrors, Resolver } from 'react-hook-form';
import { limitsOf, type MeasurementType } from '@/constants/measurement';
import type { UnitSystem } from '@/constants/profile';
import { parseDecimal2 } from '@/lib/units';
import { hasDecimals } from '@/shared/schemas/measurement';
import { displayLimits, toCanonical, unitLabel } from '../utils';

/** The canonical value of the text, or the error to show under the field. */
export function validateEntry(
  t: TFunction,
  type: MeasurementType,
  text: string,
  units: UnitSystem,
): { value: number | null; error: string | null } {
  const value = toCanonical(type, text, units);
  if (value === null) {
    // A number that only has too many decimals gets the precise message.
    const loose = parseDecimal2(text) ?? Number(text.trim().replace(',', '.'));
    if (Number.isFinite(loose) && text.trim() !== '') {
      const decimals = limitsOf(type).decimals;
      if (!hasDecimals(loose, decimals)) {
        return { value: null, error: t('At most {{count}} decimal places.', { count: decimals }) };
      }
    }
    return { value: null, error: t('Enter a number.') };
  }
  const limits = limitsOf(type);
  if (value < limits.min || value > limits.max) {
    const shown = displayLimits(type, units);
    return {
      value: null,
      error: t('From {{min}} to {{max}} {{unit}}.', {
        min: shown.min,
        max: shown.max,
        unit: unitLabel(t, type, units),
      }),
    };
  }
  return { value, error: null };
}

export function validateDate(t: TFunction, date: string, today: string): string | null {
  if (!date) return t('Choose a date.');
  if (date > today) return t("The date can't be in the future.");
  return null;
}

/**
 * A React Hook Form resolver: `measuredOn` is the date and every other key is the text of one
 * measurement type. Empty texts are skipped.
 */
export function measurementResolver<V extends { measuredOn: string }>(
  t: TFunction,
  units: UnitSystem,
  today: string,
  typeOf: (key: string) => MeasurementType | null,
): Resolver<V> {
  return async (values) => {
    const errors: Record<string, { type: string; message: string }> = {};
    const dateError = validateDate(t, values.measuredOn, today);
    if (dateError) errors.measuredOn = { type: 'validate', message: dateError };
    for (const [key, raw] of Object.entries(values)) {
      const type = typeOf(key);
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!type || !text) continue;
      const { error } = validateEntry(t, type, text, units);
      if (error) errors[key] = { type: 'validate', message: error };
    }
    return Object.keys(errors).length > 0
      ? { values: {}, errors: errors as FieldErrors<V> }
      : { values, errors: {} };
  };
}
