import { describe, expect, it } from 'vitest';
import { exerciseIdParamsSchema, listExercisesQuerySchema } from '../exercise';

describe('listExercisesQuerySchema', () => {
  it('defaults to no filters and the API list limit', () => {
    expect(listExercisesQuerySchema.parse({})).toEqual({ muscle: [], equipment: [], limit: 50 });
  });

  it('accepts a single value or repeated values for muscle and equipment', () => {
    expect(listExercisesQuerySchema.parse({ muscle: 'chest' }).muscle).toEqual(['chest']);
    expect(
      listExercisesQuerySchema.parse({ muscle: ['chest', 'triceps'], equipment: ['barbell'] }),
    ).toMatchObject({ muscle: ['chest', 'triceps'], equipment: ['barbell'] });
  });

  it('coerces limit and trims the query', () => {
    expect(listExercisesQuerySchema.parse({ limit: '30', q: '  bench ' })).toMatchObject({
      limit: 30,
      q: 'bench',
    });
  });

  it('rejects unknown values, out-of-range limits and unknown keys', () => {
    expect(listExercisesQuerySchema.safeParse({ muscle: 'wings' }).success).toBe(false);
    expect(listExercisesQuerySchema.safeParse({ equipment: ['barbell', 'rope'] }).success).toBe(
      false,
    );
    expect(listExercisesQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(listExercisesQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
    expect(listExercisesQuerySchema.safeParse({ q: 'x'.repeat(61) }).success).toBe(false);
    expect(listExercisesQuerySchema.safeParse({ sort: 'name' }).success).toBe(false);
  });
});

describe('exerciseIdParamsSchema', () => {
  it('accepts a uuid only', () => {
    expect(
      exerciseIdParamsSchema.safeParse({ id: '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f' }).success,
    ).toBe(true);
    expect(exerciseIdParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
  });
});
