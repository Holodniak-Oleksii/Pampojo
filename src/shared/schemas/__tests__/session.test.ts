import { describe, expect, it } from 'vitest';
import {
  patchSessionInputSchema,
  patchSetInputSchema,
  putSessionInputSchema,
  putSetInputSchema,
  type PutSessionInput,
  type PutSetInput,
} from '../session';

const ID = '00000000-0000-4000-8000-000000000001';
const ENTRY = '00000000-0000-4000-8000-000000000002';
const EXERCISE = '00000000-0000-4000-8000-0000000000aa';
const WORKOUT = '00000000-0000-4000-8000-0000000000bb';

const info = {
  id: EXERCISE,
  name: 'Bench Press',
  trackingType: 'weight_reps',
  laterality: null,
  thumbnailUrl: null,
} as const;
const targets = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: null,
  targetDurationSec: null,
  targetDistanceM: null,
  notes: null,
};

const entry = (override: Record<string, unknown> = {}) => ({
  id: ENTRY,
  exerciseId: EXERCISE,
  plannedSets: 3,
  ...targets,
  exercise: info,
  ...override,
});

const session = (override: Partial<PutSessionInput> = {}): PutSessionInput => ({
  workoutId: WORKOUT,
  workoutSnapshot: {
    workoutId: WORKOUT,
    name: 'Push Day',
    description: null,
    exercises: [{ id: ENTRY, exerciseId: EXERCISE, ...targets, exercise: info }],
  },
  exercises: [entry() as PutSessionInput['exercises'][number]],
  startedAt: '2026-11-15T10:00:00.000Z',
  ...override,
});

const set = (override: Partial<PutSetInput> = {}): PutSetInput => ({
  sessionId: ID,
  sessionExerciseId: ENTRY,
  exerciseId: EXERCISE,
  setIndex: 0,
  weightKg: 80,
  reps: 8,
  durationSec: null,
  distanceM: null,
  completedAt: '2026-11-15T10:05:00.000Z',
  ...override,
});

describe('putSessionInputSchema', () => {
  it('accepts a session with a snapshot and a plan', () => {
    expect(putSessionInputSchema.safeParse(session()).success).toBe(true);
  });

  it('rejects duplicate entry ids, too many sets and a mismatched exercise', () => {
    const twice = [entry(), entry()] as PutSessionInput['exercises'];
    expect(putSessionInputSchema.safeParse(session({ exercises: twice })).success).toBe(false);
    const many = [entry({ plannedSets: 21 })] as PutSessionInput['exercises'];
    expect(putSessionInputSchema.safeParse(session({ exercises: many })).success).toBe(false);
    const other = [entry({ exerciseId: WORKOUT })] as PutSessionInput['exercises'];
    expect(putSessionInputSchema.safeParse(session({ exercises: other })).success).toBe(false);
  });

  it('rejects an empty plan and more than 30 exercises', () => {
    expect(putSessionInputSchema.safeParse(session({ exercises: [] })).success).toBe(false);
    const thirtyOne = Array.from({ length: 31 }, (_, index) =>
      entry({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }),
    ) as PutSessionInput['exercises'];
    expect(putSessionInputSchema.safeParse(session({ exercises: thirtyOne })).success).toBe(false);
  });
});

describe('patchSessionInputSchema', () => {
  it('requires finishedAt to complete and at least one field', () => {
    expect(patchSessionInputSchema.safeParse({}).success).toBe(false);
    expect(patchSessionInputSchema.safeParse({ status: 'completed' }).success).toBe(false);
    expect(
      patchSessionInputSchema.safeParse({ status: 'completed', finishedAt: '2026-11-15T11:00:00Z' })
        .success,
    ).toBe(true);
    expect(patchSessionInputSchema.safeParse({ status: 'abandoned' }).success).toBe(true);
  });

  it('caps the note at 1000 characters', () => {
    expect(patchSessionInputSchema.safeParse({ notes: 'a'.repeat(1000) }).success).toBe(true);
    expect(patchSessionInputSchema.safeParse({ notes: 'a'.repeat(1001) }).success).toBe(false);
  });
});

describe('putSetInputSchema', () => {
  it('enforces the value ranges', () => {
    expect(putSetInputSchema.safeParse(set()).success).toBe(true);
    expect(putSetInputSchema.safeParse(set({ weightKg: 80.1 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ weightKg: 500.25 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ reps: 0 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ reps: 101 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ durationSec: 3601 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ distanceM: 100_001 })).success).toBe(false);
    expect(putSetInputSchema.safeParse(set({ setIndex: 20 })).success).toBe(false);
  });

  it('accepts an empty weight', () => {
    expect(putSetInputSchema.safeParse(set({ weightKg: null })).success).toBe(true);
  });
});

describe('patchSetInputSchema', () => {
  it('needs at least one value', () => {
    expect(patchSetInputSchema.safeParse({}).success).toBe(false);
    expect(patchSetInputSchema.safeParse({ reps: 9 }).success).toBe(true);
  });
});
