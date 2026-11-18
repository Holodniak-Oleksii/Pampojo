import { describe, expect, it } from 'vitest';
import { hasDecimals, putMeasurementInputSchema } from '../measurement';

const parse = (type: string, value: number) =>
  putMeasurementInputSchema.safeParse({ type, value, measuredOn: '2026-11-16' });

describe('putMeasurementInputSchema', () => {
  it('accepts weight in 30–300 kg with one decimal', () => {
    expect(parse('weight', 30).success).toBe(true);
    expect(parse('weight', 82.4).success).toBe(true);
    expect(parse('weight', 300).success).toBe(true);
  });

  it('rejects weight outside the limits or with two decimals', () => {
    expect(parse('weight', 29.9).success).toBe(false);
    expect(parse('weight', 300.1).success).toBe(false);
    const result = parse('weight', 82.45);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('measurement_decimals');
  });

  it('accepts girths in 10–250 cm with two decimals', () => {
    expect(parse('chest', 104.25).success).toBe(true);
    expect(parse('calf_left', 10).success).toBe(true);
    expect(parse('shoulders', 250).success).toBe(true);
  });

  it('rejects girths outside the limits or with three decimals', () => {
    expect(parse('neck', 9.99).success).toBe(false);
    expect(parse('neck', 250.01).success).toBe(false);
    expect(parse('waist', 86.125).success).toBe(false);
  });

  it('accepts body fat in 2–75 % with two decimals', () => {
    expect(parse('body_fat_pct', 24.75).success).toBe(true);
    expect(parse('body_fat_pct', 1.99).success).toBe(false);
    expect(parse('body_fat_pct', 75.01).success).toBe(false);
  });

  it('rejects an unknown type, a bad date and unknown keys', () => {
    expect(parse('knee', 40).success).toBe(false);
    expect(
      putMeasurementInputSchema.safeParse({ type: 'neck', value: 40, measuredOn: '2026-02-31' })
        .success,
    ).toBe(false);
    expect(
      putMeasurementInputSchema.safeParse({
        type: 'neck',
        value: 40,
        measuredOn: '2026-11-16',
        userId: 'x',
      }).success,
    ).toBe(false);
  });
});

describe('hasDecimals', () => {
  it('handles floating point noise', () => {
    expect(hasDecimals(0.1 + 0.2, 1)).toBe(true);
    expect(hasDecimals(38.74, 2)).toBe(true);
    expect(hasDecimals(38.745, 2)).toBe(false);
  });
});
