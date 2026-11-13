import { describe, expect, it } from 'vitest';
import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';
import { canonical, formatRequirements, sameEquipment } from '../utils';

const labels = Object.fromEntries(
  GYM_EQUIPMENT_KEYS.map((key) => [key, key.replace(/_/g, ' ')]),
) as Record<GymEquipment, string>;
const words = { or: 'or', nothing: 'Nothing special' };

describe('formatRequirements', () => {
  it('joins groups with a dot and alternatives with "or"', () => {
    expect(formatRequirements([['barbell'], ['flat_bench'], ['squat_rack']], labels, words)).toBe(
      'barbell · flat bench · squat rack',
    );
    expect(formatRequirements([['dumbbells', 'kettlebells']], labels, words)).toBe(
      'dumbbells or kettlebells',
    );
  });

  it('says nothing special for an empty requirement', () => {
    expect(formatRequirements([], labels, words)).toBe('Nothing special');
  });
});

describe('canonical', () => {
  it('drops duplicates and sorts in display order', () => {
    expect(canonical(['flat_bench', 'barbell', 'flat_bench'])).toEqual(['barbell', 'flat_bench']);
    expect(sameEquipment(canonical(['dumbbells', 'barbell']), ['barbell', 'dumbbells'])).toBe(true);
  });
});
