import { describe, expect, it } from 'vitest';
import { GYM_EQUIPMENT, GYM_EQUIPMENT_KEYS } from '@/constants/gym';
import { isAvailableInGym } from '../gym';

describe('GYM_EQUIPMENT_KEYS', () => {
  it('lists every item once', () => {
    expect(GYM_EQUIPMENT_KEYS).toHaveLength(38);
    expect(new Set(GYM_EQUIPMENT_KEYS).size).toBe(38);
    expect([...GYM_EQUIPMENT_KEYS].sort()).toEqual(Object.values(GYM_EQUIPMENT).sort());
  });
});

describe('isAvailableInGym', () => {
  it.each([
    { name: 'empty requirement', req: [], gym: ['barbell'], expected: true },
    { name: 'empty requirement, empty gym', req: [], gym: [], expected: true },
    { name: 'single item present', req: [['barbell']], gym: ['barbell'], expected: true },
    { name: 'single item missing', req: [['barbell']], gym: ['dumbbells'], expected: false },
    {
      name: 'alternatives met by the first item',
      req: [['dumbbells', 'kettlebells']],
      gym: ['dumbbells'],
      expected: true,
    },
    {
      name: 'alternatives met by the second item',
      req: [['dumbbells', 'kettlebells']],
      gym: ['kettlebells'],
      expected: true,
    },
    {
      name: 'several groups, all met',
      req: [['barbell'], ['flat_bench'], ['squat_rack']],
      gym: ['barbell', 'flat_bench', 'squat_rack'],
      expected: true,
    },
    {
      name: 'several groups, one missing',
      req: [['barbell'], ['flat_bench'], ['squat_rack']],
      gym: ['barbell', 'flat_bench'],
      expected: false,
    },
    { name: 'empty gym', req: [['dumbbells', 'kettlebells']], gym: [], expected: false },
  ])('$name', ({ req, gym, expected }) => {
    expect(isAvailableInGym(req, gym)).toBe(expected);
  });
});
