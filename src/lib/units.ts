export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;
const INCHES_PER_FOOT = 12;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function cmFromFeetInches(feet: number, inches: number): number {
  return round1((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH);
}

export function feetInchesFromCm(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / INCHES_PER_FOOT), inches: total % INCHES_PER_FOOT };
}

export function kgFromLb(lb: number): number {
  return round1(lb * KG_PER_LB);
}

export function lbFromKg(kg: number): number {
  return round1(kg / KG_PER_LB);
}

/** A non-negative number with at most one decimal; comma or dot as separator. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}([.,]\d)?$/.test(trimmed)) return null;
  return Number(trimmed.replace(',', '.'));
}

/** A non-negative whole number. */
export function parseInteger(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function formatFeetInches({ feet, inches }: { feet: number; inches: number }): string {
  return `${feet}′${inches}″`;
}
