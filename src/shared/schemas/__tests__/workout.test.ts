import { describe, expect, it } from 'vitest';
import { putWorkoutInputSchema, type PutWorkoutInput } from '../workout';

const ID = '00000000-0000-4000-8000-000000000001';
const EXERCISE = '00000000-0000-4000-8000-0000000000aa';

const row = (override: Record<string, unknown> = {}) => ({
  id: ID,
  exerciseId: EXERCISE,
  ...override,
});
const input = (override: Partial<PutWorkoutInput> = {}): PutWorkoutInput => ({
  name: 'Push Day',
  exercises: [row()],
  ...override,
});

describe('putWorkoutInputSchema', () => {
  it('trims text, turns blanks into null and defaults missing targets to null', () => {
    const parsed = putWorkoutInputSchema.parse(
      input({ name: '  Push Day ', description: '  ', exercises: [row({ notes: ' ' })] }),
    );
    expect(parsed.name).toBe('Push Day');
    expect(parsed.description).toBeNull();
    expect(parsed.exercises[0]).toEqual({
      id: ID,
      exerciseId: EXERCISE,
      targetSets: null,
      targetRepsMin: null,
      targetRepsMax: null,
      targetWeightKg: null,
      targetDurationSec: null,
      targetDistanceM: null,
      notes: null,
    });
  });

  it('enforces the text lengths and the exercise count', () => {
    expect(putWorkoutInputSchema.safeParse(input({ name: ' ' })).success).toBe(false);
    expect(putWorkoutInputSchema.safeParse(input({ name: 'a'.repeat(81) })).success).toBe(false);
    expect(putWorkoutInputSchema.safeParse(input({ name: 'a'.repeat(80) })).success).toBe(true);
    expect(putWorkoutInputSchema.safeParse(input({ description: 'a'.repeat(501) })).success).toBe(
      false,
    );
    expect(
      putWorkoutInputSchema.safeParse(input({ exercises: [row({ notes: 'a'.repeat(301) })] }))
        .success,
    ).toBe(false);
    expect(putWorkoutInputSchema.safeParse(input({ exercises: [] })).success).toBe(false);
    expect(
      putWorkoutInputSchema.safeParse(input({ exercises: Array.from({ length: 31 }, () => row()) }))
        .success,
    ).toBe(false);
    expect(
      putWorkoutInputSchema.safeParse(input({ exercises: Array.from({ length: 30 }, () => row()) }))
        .success,
    ).toBe(true);
  });

  it('enforces the target ranges', () => {
    const ok = (targets: Record<string, unknown>) =>
      putWorkoutInputSchema.safeParse(input({ exercises: [row(targets)] })).success;
    expect(ok({ targetSets: 20 })).toBe(true);
    expect(ok({ targetSets: 21 })).toBe(false);
    expect(ok({ targetSets: 0 })).toBe(false);
    expect(ok({ targetWeightKg: 82.25 })).toBe(true);
    expect(ok({ targetWeightKg: 82.3 })).toBe(false);
    expect(ok({ targetWeightKg: 501 })).toBe(false);
    expect(ok({ targetDurationSec: 4 })).toBe(false);
    expect(ok({ targetDurationSec: 3600 })).toBe(true);
    expect(ok({ targetDistanceM: 9 })).toBe(false);
    expect(ok({ targetDistanceM: 100_000 })).toBe(true);
  });

  it('needs both reps values in order', () => {
    const ok = (targets: Record<string, unknown>) =>
      putWorkoutInputSchema.safeParse(input({ exercises: [row(targets)] })).success;
    expect(ok({ targetRepsMin: 8, targetRepsMax: 12 })).toBe(true);
    expect(ok({ targetRepsMin: 10, targetRepsMax: 10 })).toBe(true);
    expect(ok({ targetRepsMin: 12, targetRepsMax: 8 })).toBe(false);
    expect(ok({ targetRepsMin: 8 })).toBe(false);
    expect(ok({ targetRepsMin: 0, targetRepsMax: 5 })).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(putWorkoutInputSchema.safeParse({ ...input(), owner: 'x' }).success).toBe(false);
    expect(
      putWorkoutInputSchema.safeParse(input({ exercises: [row({ restSec: 90 })] })).success,
    ).toBe(false);
  });
});
