import { describe, expect, it } from 'vitest';
import { completeOnboardingInputSchema, updateProfileInputSchema } from '../profile';

const valid = {
  displayName: 'John Smith',
  avatarEmoji: 'fox',
  avatarColor: 3,
  sex: 'male',
  birthDate: '1990-05-15',
  heightCm: 180,
  weightKg: 79.8,
  unitSystem: 'metric',
  timeZone: 'Europe/Kyiv',
};

function firstMessage(input: unknown, path: string): string | undefined {
  const result = completeOnboardingInputSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('completeOnboardingInputSchema', () => {
  it('accepts a full valid body and trims the name', () => {
    const result = completeOnboardingInputSchema.parse({ ...valid, displayName: '  John  ' });
    expect(result.displayName).toBe('John');
  });

  it('checks the name length after trim', () => {
    expect(firstMessage({ ...valid, displayName: '   ' }, 'displayName')).toBe('name_required');
    expect(firstMessage({ ...valid, displayName: 'a'.repeat(40) }, 'displayName')).toBeUndefined();
    expect(firstMessage({ ...valid, displayName: 'a'.repeat(41) }, 'displayName')).toBe(
      'name_too_long',
    );
  });

  it('requires sex', () => {
    expect(firstMessage({ ...valid, sex: undefined }, 'sex')).toBe('sex_required');
    expect(firstMessage({ ...valid, sex: 'other' }, 'sex')).toBe('sex_required');
  });

  it('rejects dates that do not exist', () => {
    expect(firstMessage({ ...valid, birthDate: '2000-02-31' }, 'birthDate')).toBe('date_invalid');
    expect(firstMessage({ ...valid, birthDate: '15.05.1990' }, 'birthDate')).toBe('date_invalid');
  });

  it('checks height and weight ranges', () => {
    expect(firstMessage({ ...valid, heightCm: 99.9 }, 'heightCm')).toBe('height_range');
    expect(firstMessage({ ...valid, heightCm: 250 }, 'heightCm')).toBeUndefined();
    expect(firstMessage({ ...valid, heightCm: 251 }, 'heightCm')).toBe('height_range');
    expect(firstMessage({ ...valid, weightKg: 29.9 }, 'weightKg')).toBe('weight_range');
    expect(firstMessage({ ...valid, weightKg: 300.04 }, 'weightKg')).toBeUndefined();
    expect(firstMessage({ ...valid, weightKg: 300.1 }, 'weightKg')).toBe('weight_range');
  });

  it('rounds height and weight to 0.1', () => {
    const result = completeOnboardingInputSchema.parse({
      ...valid,
      heightCm: 180.34,
      weightKg: 79.83,
    });
    expect(result.heightCm).toBe(180.3);
    expect(result.weightKg).toBe(79.8);
  });

  it('rejects unknown avatars, colors, zones and keys', () => {
    expect(
      completeOnboardingInputSchema.safeParse({ ...valid, avatarEmoji: 'dragon' }).success,
    ).toBe(false);
    expect(completeOnboardingInputSchema.safeParse({ ...valid, avatarColor: 9 }).success).toBe(
      false,
    );
    expect(
      completeOnboardingInputSchema.safeParse({ ...valid, timeZone: 'Mars/Olympus' }).success,
    ).toBe(false);
    expect(completeOnboardingInputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});

describe('updateProfileInputSchema', () => {
  it('accepts a single field', () => {
    expect(updateProfileInputSchema.parse({ displayName: 'Jane' })).toEqual({
      displayName: 'Jane',
    });
  });

  it('rejects an empty body and timeZone', () => {
    expect(updateProfileInputSchema.safeParse({}).success).toBe(false);
    expect(updateProfileInputSchema.safeParse({ timeZone: 'UTC' }).success).toBe(false);
  });
});
