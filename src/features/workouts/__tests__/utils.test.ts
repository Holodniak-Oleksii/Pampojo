import { createInstance, type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { i18nextOptions } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';
import { getWorkoutMock } from '@/test/mocks';
import type { DraftItem } from '../types';
import {
  defaultTargets,
  draftFromWorkout,
  duplicateInput,
  targetSummary,
  toPutInput,
} from '../utils';

let tEn: TFunction;
let tUk: TFunction;

beforeAll(async () => {
  const english = createInstance();
  await english.init(i18nextOptions('en', en));
  tEn = english.t;
  const ukrainian = createInstance();
  await ukrainian.init(i18nextOptions('uk', uk));
  tUk = ukrainian.t;
});

const item = (
  trackingType: DraftItem['exercise']['trackingType'],
  targets: Partial<DraftItem['targets']>,
  laterality: 'bilateral' | 'unilateral' = 'bilateral',
): DraftItem => ({
  key: 'k',
  notes: '',
  exercise: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'X',
    trackingType,
    laterality,
    primaryMuscles: ['chest'],
    thumbnailUrl: null,
    isOwn: false,
  },
  targets: {
    ...defaultTargets(trackingType),
    targetSets: null,
    targetRepsMin: null,
    targetRepsMax: null,
    targetDurationSec: null,
    ...targets,
  },
});

describe('defaultTargets', () => {
  it('prefills by tracking type and never prefills weight or distance', () => {
    expect(defaultTargets('weight_reps')).toMatchObject({
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetWeightKg: null,
    });
    expect(defaultTargets('reps')).toMatchObject({
      targetSets: 3,
      targetRepsMin: 10,
      targetRepsMax: 15,
    });
    expect(defaultTargets('time')).toMatchObject({
      targetSets: 3,
      targetDurationSec: 30,
      targetRepsMin: null,
    });
    expect(defaultTargets('distance')).toMatchObject({ targetSets: 1, targetDistanceM: null });
  });
});

describe('targetSummary', () => {
  it('writes sets, reps, weight, time and distance', () => {
    expect(
      targetSummary(
        item('weight_reps', {
          targetSets: 3,
          targetRepsMin: 8,
          targetRepsMax: 12,
          targetWeightKg: 80,
        }),
        tUk,
        'uk',
      ),
    ).toBe('3 × 8–12, 80 кг');
    expect(
      targetSummary(
        item('reps', { targetSets: 3, targetRepsMin: 10, targetRepsMax: 10 }),
        tUk,
        'uk',
      ),
    ).toBe('3 × 10');
    expect(targetSummary(item('time', { targetSets: 3, targetDurationSec: 45 }), tUk, 'uk')).toBe(
      '3 × 45 с',
    );
    expect(
      targetSummary(
        item('time', { targetSets: 2, targetDurationSec: 30 }, 'unilateral'),
        tUk,
        'uk',
      ),
    ).toBe('2 × 30 с на кожну сторону');
    expect(
      targetSummary(item('distance', { targetSets: 1, targetDistanceM: 5000 }), tUk, 'uk'),
    ).toBe('1 × 5 км');
    expect(
      targetSummary(item('distance', { targetSets: 1, targetDistanceM: 400 }), tEn, 'en'),
    ).toBe('1 × 400 m');
  });

  it('handles partial and empty targets', () => {
    expect(targetSummary(item('weight_reps', { targetSets: 3 }), tUk, 'uk')).toBe('3 підходи');
    expect(targetSummary(item('weight_reps', { targetSets: 5 }), tUk, 'uk')).toBe('5 підходів');
    expect(targetSummary(item('weight_reps', { targetWeightKg: 82.5 }), tUk, 'uk')).toBe('82,5 кг');
    expect(targetSummary(item('weight_reps', {}), tUk, 'uk')).toBe('');
  });

  it('ignores targets the tracking type does not allow', () => {
    expect(
      targetSummary(
        item('time', { targetSets: 3, targetDurationSec: 30, targetWeightKg: 50 }),
        tEn,
        'en',
      ),
    ).toBe('3 × 30 s');
  });
});

describe('toPutInput', () => {
  it('trims text, sends only allowed targets and fills an exact reps pair', () => {
    const draft = {
      id: '00000000-0000-4000-8000-00000000a001',
      name: ' Push Day ',
      description: '  ',
      items: [
        {
          ...item('time', { targetSets: 3, targetDurationSec: 30, targetWeightKg: 50 }),
          key: 'a',
          notes: ' slow ',
        },
        { ...item('reps', { targetRepsMin: 12, targetRepsMax: null }), key: 'b' },
      ],
    };
    const input = toPutInput(draft);
    expect(input.name).toBe('Push Day');
    expect(input.description).toBeNull();
    expect(input.exercises[0]).toMatchObject({
      id: 'a',
      targetWeightKg: null,
      targetDurationSec: 30,
      notes: 'slow',
    });
    expect(input.exercises[1]).toMatchObject({ targetRepsMin: 12, targetRepsMax: 12, notes: null });
  });
});

describe('duplicateInput', () => {
  it('names the copy and gives every row a new id', () => {
    const workout = getWorkoutMock();
    const input = duplicateInput(workout, tUk, 80);
    expect(input.name).toBe('Push Day (копія)');
    expect(input.exercises[0]?.id).not.toBe(workout.exercises[0]?.id);
    expect(draftFromWorkout(workout).items).toHaveLength(1);
    const long = duplicateInput(getWorkoutMock({ name: 'a'.repeat(80) }), tEn, 80);
    expect(long.name.length).toBeLessThanOrEqual(80);
    expect(long.name.endsWith(' (copy)')).toBe(true);
  });
});
