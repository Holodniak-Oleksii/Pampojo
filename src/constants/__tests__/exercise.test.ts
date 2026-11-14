import { describe, expect, it } from 'vitest';
import { MUSCLE_FAMILY, MUSCLE_FAMILY_OF, MUSCLE_GROUPS } from '../exercise';

describe('MUSCLE_FAMILY_OF', () => {
  it('maps every muscle group to exactly one known family', () => {
    expect(Object.keys(MUSCLE_FAMILY_OF).sort()).toEqual([...MUSCLE_GROUPS].sort());
    const families = Object.values(MUSCLE_FAMILY);
    for (const group of MUSCLE_GROUPS) expect(families).toContain(MUSCLE_FAMILY_OF[group]);
  });

  it('gives every family at least one group', () => {
    const used = new Set(Object.values(MUSCLE_FAMILY_OF));
    expect([...used].sort()).toEqual(Object.values(MUSCLE_FAMILY).sort());
  });
});
