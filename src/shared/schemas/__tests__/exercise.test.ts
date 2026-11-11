import { describe, expect, it } from 'vitest';
import {
  createExerciseInputSchema,
  exerciseIdParamsSchema,
  listExercisesQuerySchema,
  updateExerciseInputSchema,
} from '../exercise';

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

describe('createExerciseInputSchema', () => {
  const base = {
    name: ' Cable Hug ',
    primaryMuscles: ['chest'],
    equipment: ['cable'],
    trackingType: 'weight_reps',
  };

  it('fills optional fields, trims text and drops blank list items', () => {
    expect(
      createExerciseInputSchema.parse({ ...base, instructions: ['  Step one ', '', '  '] }),
    ).toMatchObject({
      name: 'Cable Hug',
      secondaryMuscles: [],
      movementPattern: null,
      description: '',
      instructions: ['Step one'],
      commonMistakes: [],
      sourceExerciseId: null,
    });
  });

  it('drops secondary muscles that repeat a primary one', () => {
    expect(
      createExerciseInputSchema.parse({
        ...base,
        secondaryMuscles: ['chest', 'triceps', 'triceps'],
      }).secondaryMuscles,
    ).toEqual(['triceps']);
  });

  it('returns field error codes for the form', () => {
    const result = createExerciseInputSchema.safeParse({
      ...base,
      name: ' ',
      primaryMuscles: [],
      equipment: [],
      instructions: ['x'.repeat(201)],
    });
    expect(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message])).toEqual(
      expect.arrayContaining([
        ['name', 'name_required'],
        ['primaryMuscles', 'primary_required'],
        ['equipment', 'equipment_required'],
        ['instructions.0', 'text_too_long'],
      ]),
    );
    expect(
      createExerciseInputSchema.safeParse({ ...base, instructions: Array(11).fill('a') }).success,
    ).toBe(false);
  });
});

describe('updateExerciseInputSchema', () => {
  it('keeps missing fields missing, so a PATCH never resets them', () => {
    expect(updateExerciseInputSchema.parse({ name: 'New' })).toEqual({ name: 'New' });
  });

  it('needs at least one field and caps frameOrder at 4', () => {
    expect(updateExerciseInputSchema.safeParse({}).success).toBe(false);
    const ids = Array.from({ length: 5 }, () => '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f');
    expect(updateExerciseInputSchema.safeParse({ frameOrder: ids }).success).toBe(false);
  });
});

describe('listExercisesQuerySchema mine', () => {
  it('accepts mine=1 only', () => {
    expect(listExercisesQuerySchema.parse({ mine: '1' }).mine).toBe('1');
    expect(listExercisesQuerySchema.safeParse({ mine: 'true' }).success).toBe(false);
  });
});
