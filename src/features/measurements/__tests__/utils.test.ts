import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { Measurement } from '@/shared/schemas/measurement';
import { diagramRings, relax } from '../BodyDiagram/geometry';
import {
  bmi,
  bmiCategory,
  bmiScalePosition,
  byType,
  changeOf,
  formatChange,
  formatMeasurement,
  toCanonical,
} from '../utils';

const t = ((key: string, options?: { value?: string }) =>
  key.replace('{{value}}', options?.value ?? '')) as unknown as TFunction;

const row = (type: Measurement['type'], value: number, measuredOn: string): Measurement => ({
  id: crypto.randomUUID(),
  type,
  value,
  measuredOn,
  updatedAt: '2026-11-16T10:00:00.000Z',
});

describe('bmi (AC1)', () => {
  it('divides kg by m² and rounds to one decimal', () => {
    expect(bmi(82.4, 183)).toBe(24.6);
    expect(bmi(61.8, 165)).toBe(22.7);
  });
});

describe('bmiCategory (AC2)', () => {
  it.each([
    [18.4, 'underweight'],
    [18.5, 'normal'],
    [24.9, 'normal'],
    [25.0, 'overweight'],
    [29.9, 'overweight'],
    [30.0, 'obese'],
  ])('puts %s in %s', (value, category) => {
    expect(bmiCategory(value)).toBe(category);
  });

  it('clamps the scale position to 15–40', () => {
    expect(bmiScalePosition(10)).toBe(0);
    expect(bmiScalePosition(45)).toBe(1);
    expect(bmiScalePosition(25)).toBeCloseTo(0.4);
  });
});

describe('changeOf (AC3)', () => {
  it('returns latest minus previous, or null for one row', () => {
    const list = byType([row('waist', 86.5, '2026-11-02'), row('waist', 85.75, '2026-11-16')]);
    expect(changeOf(list.get('waist') ?? [])).toBe(-0.75);
    expect(changeOf([row('neck', 40, '2026-11-16')])).toBeNull();
  });

  it('formats the change with a sign, and 0 without one', () => {
    expect(formatChange(t, 'uk', 'waist', -0.75, 'metric')).toBe('−0,75 cm');
    expect(formatChange(t, 'uk', 'chest', 1.25, 'metric')).toBe('+1,25 cm');
    expect(formatChange(t, 'uk', 'weight', 0, 'metric')).toBe('0 kg');
  });
});

describe('formatMeasurement', () => {
  it('shows girths with 1–2 decimals and weight with one', () => {
    expect(formatMeasurement(t, 'uk', 'chest', 104.25, 'metric')).toBe('104,25 cm');
    expect(formatMeasurement(t, 'uk', 'calf_left', 39, 'metric')).toBe('39,0 cm');
    expect(formatMeasurement(t, 'uk', 'weight', 82.4, 'metric')).toBe('82,4 kg');
  });

  it('shows imperial values in lb and in', () => {
    expect(formatMeasurement(t, 'en', 'weight', 79.8, 'imperial')).toBe('175.9 lb');
    expect(formatMeasurement(t, 'en', 'waist', 101.6, 'imperial')).toBe('40.0 in');
  });
});

describe('toCanonical (AC9)', () => {
  it('reads metric text', () => {
    expect(toCanonical('chest', '104,25', 'metric')).toBe(104.25);
    expect(toCanonical('weight', '82,4', 'metric')).toBe(82.4);
    expect(toCanonical('weight', '82,45', 'metric')).toBeNull();
    expect(toCanonical('chest', 'x', 'metric')).toBeNull();
  });

  it('converts imperial text: kg at 0.1 and cm at 0.01', () => {
    expect(toCanonical('weight', '176', 'imperial')).toBe(79.8);
    expect(toCanonical('waist', '15,25', 'imperial')).toBe(38.74);
    expect(toCanonical('body_fat_pct', '24,5', 'imperial')).toBe(24.5);
  });
});

describe('relax', () => {
  it('keeps targets that are far apart', () => {
    expect(relax([50, 150, 250])).toEqual([50, 150, 250]);
  });

  it('pushes close chips down by the gap', () => {
    expect(relax([100, 110, 120])).toEqual([100, 142, 184]);
  });

  it('moves chips up from the end when the column overflows', () => {
    expect(relax([300, 330, 370])).toEqual([297, 339, 381]);
  });

  it('places 13 rings for both figures inside the block', () => {
    for (const sex of ['male', 'female'] as const) {
      const rings = diagramRings(sex);
      expect(rings).toHaveLength(13);
      for (const ring of rings) {
        expect(ring.chipY).toBeGreaterThanOrEqual(19);
        expect(ring.chipY).toBeLessThanOrEqual(381);
      }
    }
  });
});
