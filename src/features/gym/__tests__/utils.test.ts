import { describe, expect, it } from 'vitest';
import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';
import { canonical, formatRequirementGroup, sameEquipment } from '../utils';

const labels = Object.fromEntries(
  GYM_EQUIPMENT_KEYS.map((key) => [key, key.replace(/_/g, ' ')]),
) as Record<GymEquipment, string>;
describe('formatRequirementGroup', () => {
  it('names a single item and joins alternatives with "or"', () => {
    expect(formatRequirementGroup(['barbell'], labels, 'or')).toBe('barbell');
    expect(formatRequirementGroup(['dumbbells', 'kettlebells'], labels, 'or')).toBe(
      'dumbbells or kettlebells',
    );
  });
});

describe('canonical', () => {
  it('drops duplicates and sorts in display order', () => {
    expect(canonical(['flat_bench', 'barbell', 'flat_bench'])).toEqual(['barbell', 'flat_bench']);
    expect(sameEquipment(canonical(['dumbbells', 'barbell']), ['barbell', 'dumbbells'])).toBe(true);
  });
});
