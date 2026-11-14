import type { Exercise, ExerciseListItem } from '@/shared/schemas/exercise';
import type { Gym } from '@/shared/schemas/gym';
import type { Profile } from '@/shared/schemas/profile';
import type { Workout, WorkoutExercise, WorkoutListItem } from '@/shared/schemas/workout';
import type { DeepPartial } from '@/types/utils';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function merge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = merge(base[key], value);
  }
  return result;
}

// Mock factories for API and domain shapes build on this; arrays in an override replace the base.
export function mergeMock<T>(base: T, override?: DeepPartial<T>): T {
  return merge(base, override) as T;
}

export function getProfileMock(override?: DeepPartial<Profile>): Profile {
  return mergeMock<Profile>(
    {
      displayName: 'John Smith',
      avatarEmoji: 'fox',
      avatarColor: 1,
      sex: 'male',
      birthDate: '1990-05-15',
      age: 36,
      heightCm: 180,
      latestWeightKg: 79.8,
      latestWeightOn: '2026-11-09',
      unitSystem: 'metric',
      timeZone: 'Europe/Kyiv',
      onboardingCompletedAt: '2026-11-09T10:00:00Z',
    },
    override,
  );
}

export function getExerciseListItemMock(
  override?: DeepPartial<ExerciseListItem>,
): ExerciseListItem {
  return mergeMock<ExerciseListItem>(
    {
      id: '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f',
      name: 'Bench Press',
      primaryMuscles: ['chest'],
      equipment: ['barbell'],
      thumbnailUrl: 'https://example.com/bench-0-thumb.webp',
      imageUrl: 'https://example.com/bench-0-full.webp',
      frames: [
        {
          id: null,
          thumbUrl: 'https://example.com/bench-0-thumb.webp',
          fullUrl: 'https://example.com/bench-0-full.webp',
        },
        {
          id: null,
          thumbUrl: 'https://example.com/bench-1-thumb.webp',
          fullUrl: 'https://example.com/bench-1-full.webp',
        },
      ],
      section: 'chest',
      isOwn: false,
      gymEquipment: [['barbell'], ['flat_bench'], ['squat_rack']],
      trackingType: 'weight_reps',
      laterality: 'bilateral',
    },
    override,
  );
}

export function getExerciseMock(override?: DeepPartial<Exercise>): Exercise {
  return mergeMock<Exercise>(
    {
      id: '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f',
      name: 'Bench Press',
      aliases: ['Flat bench press'],
      description: 'Press a barbell from your chest while lying on a flat bench.',
      instructions: ['Lie on the bench.', 'Lower the bar to your chest.', 'Press it back up.'],
      commonMistakes: ['Bouncing the bar off the chest.'],
      primaryMuscles: ['chest'],
      secondaryMuscles: ['shoulders', 'triceps'],
      equipment: ['barbell'],
      movementPattern: 'horizontal_push',
      mechanic: 'compound',
      laterality: 'bilateral',
      trackingType: 'weight_reps',
      difficulty: 2,
      frames: [
        {
          id: null,
          thumbUrl: 'https://example.com/0-thumb.webp',
          fullUrl: 'https://example.com/0-full.webp',
        },
        {
          id: null,
          thumbUrl: 'https://example.com/1-thumb.webp',
          fullUrl: 'https://example.com/1-full.webp',
        },
      ],
      isOwn: false,
      sourceExerciseId: null,
      gymEquipment: [['barbell'], ['flat_bench'], ['squat_rack']],
    },
    override,
  );
}

export function getGymMock(override?: DeepPartial<Gym>): Gym {
  return mergeMock<Gym>(
    { equipment: ['dumbbells', 'flat_bench'], updatedAt: '2026-11-12T10:00:00Z' },
    override,
  );
}

export function getWorkoutExerciseMock(override?: DeepPartial<WorkoutExercise>): WorkoutExercise {
  return mergeMock<WorkoutExercise>(
    {
      id: '00000000-0000-4000-8000-0000000000e1',
      exerciseId: '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f',
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetWeightKg: 80,
      targetDurationSec: null,
      targetDistanceM: null,
      notes: null,
      exercise: {
        id: '6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f',
        name: 'Bench Press',
        trackingType: 'weight_reps',
        laterality: 'bilateral',
        primaryMuscles: ['chest'],
        thumbnailUrl: 'https://example.com/bench-0-thumb.webp',
        isOwn: false,
      },
    },
    override,
  );
}

export function getWorkoutMock(override?: DeepPartial<Workout>): Workout {
  return mergeMock<Workout>(
    {
      id: '00000000-0000-4000-8000-00000000a001',
      name: 'Push Day',
      description: null,
      updatedAt: '2026-11-14T10:00:00Z',
      exercises: [getWorkoutExerciseMock()],
    },
    override,
  );
}

export function getWorkoutListItemMock(override?: DeepPartial<WorkoutListItem>): WorkoutListItem {
  return mergeMock<WorkoutListItem>(
    {
      id: '00000000-0000-4000-8000-00000000a001',
      name: 'Push Day',
      updatedAt: '2026-11-14T10:00:00Z',
      exerciseCount: 5,
      exerciseIds: ['6f1c2b9e-3a4d-4c5b-8e7f-9a0b1c2d3e4f'],
      primaryMuscles: ['chest', 'shoulders', 'triceps'],
      thumbnailUrls: ['https://example.com/bench-0-thumb.webp'],
    },
    override,
  );
}
