import { describe, expect, it } from 'vitest';
import { putGymInputSchema } from '../gym';

describe('putGymInputSchema', () => {
  it('drops duplicates and stores the list in display order', () => {
    expect(
      putGymInputSchema.parse({ equipment: ['flat_bench', 'barbell', 'flat_bench'] }).equipment,
    ).toEqual(['barbell', 'flat_bench']);
  });

  it('accepts an empty list', () => {
    expect(putGymInputSchema.parse({ equipment: [] })).toEqual({ equipment: [] });
  });

  it('rejects unknown keys and extra fields', () => {
    expect(putGymInputSchema.safeParse({ equipment: ['treadmill'] }).success).toBe(false);
    expect(putGymInputSchema.safeParse({ equipment: [], name: 'Home' }).success).toBe(false);
    expect(putGymInputSchema.safeParse({}).success).toBe(false);
  });
});
