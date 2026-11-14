import { z } from 'zod';
import {
  TARGET_RANGE,
  WORKOUT_DESCRIPTION_MAX,
  WORKOUT_EXERCISES_MAX,
  WORKOUT_NAME_MAX,
  WORKOUT_NOTE_MAX,
} from '@/constants/workout';
import { lateralitySchema, muscleGroupSchema, trackingTypeSchema } from './exercise';

export const workoutIdParamsSchema = z.object({ id: z.uuid() });

const int = (range: { min: number; max: number }) =>
  z.number().int().min(range.min).max(range.max).nullable().default(null);

/** Optional text: trimmed, and blank becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value === '' ? null : value));

export const workoutExerciseInputSchema = z
  .object({
    id: z.uuid(),
    exerciseId: z.uuid(),
    targetSets: int(TARGET_RANGE.sets),
    targetRepsMin: int(TARGET_RANGE.reps),
    targetRepsMax: int(TARGET_RANGE.reps),
    targetWeightKg: z
      .number()
      .min(TARGET_RANGE.weightKg.min)
      .max(TARGET_RANGE.weightKg.max)
      .multipleOf(TARGET_RANGE.weightKg.step)
      .nullable()
      .default(null),
    targetDurationSec: int(TARGET_RANGE.durationSec),
    targetDistanceM: int(TARGET_RANGE.distanceM),
    notes: optionalText(WORKOUT_NOTE_MAX),
  })
  .strict()
  .refine((value) => (value.targetRepsMin === null) === (value.targetRepsMax === null), {
    error: 'Set both reps values or neither',
    path: ['targetRepsMax'],
  })
  .refine(
    (value) =>
      value.targetRepsMin === null ||
      value.targetRepsMax === null ||
      value.targetRepsMin <= value.targetRepsMax,
    { error: 'Min reps must not exceed max reps', path: ['targetRepsMax'] },
  );

export type WorkoutExerciseInput = z.input<typeof workoutExerciseInputSchema>;
export type ParsedWorkoutExerciseInput = z.output<typeof workoutExerciseInputSchema>;

export const putWorkoutInputSchema = z
  .object({
    name: z.string().trim().min(1).max(WORKOUT_NAME_MAX),
    description: optionalText(WORKOUT_DESCRIPTION_MAX),
    exercises: z.array(workoutExerciseInputSchema).min(1).max(WORKOUT_EXERCISES_MAX),
  })
  .strict();

export type PutWorkoutInput = z.input<typeof putWorkoutInputSchema>;
export type ParsedPutWorkoutInput = z.output<typeof putWorkoutInputSchema>;

export const workoutExerciseSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  trackingType: trackingTypeSchema,
  laterality: lateralitySchema.nullable(),
  primaryMuscles: z.array(muscleGroupSchema),
  thumbnailUrl: z.string().nullable(),
  isOwn: z.boolean(),
});

export type WorkoutExerciseSummary = z.infer<typeof workoutExerciseSummarySchema>;

export const workoutExerciseSchema = z.object({
  id: z.uuid(),
  exerciseId: z.uuid(),
  targetSets: z.number().nullable(),
  targetRepsMin: z.number().nullable(),
  targetRepsMax: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
  targetDurationSec: z.number().nullable(),
  targetDistanceM: z.number().nullable(),
  notes: z.string().nullable(),
  exercise: workoutExerciseSummarySchema,
});

export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>;

export const workoutSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
  exercises: z.array(workoutExerciseSchema),
});

export type Workout = z.infer<typeof workoutSchema>;

export const workoutListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  updatedAt: z.string(),
  exerciseCount: z.number().int(),
  exerciseIds: z.array(z.uuid()),
  primaryMuscles: z.array(muscleGroupSchema).max(3),
  thumbnailUrls: z.array(z.string()).max(4),
});

export type WorkoutListItem = z.infer<typeof workoutListItemSchema>;

export const workoutListResponseSchema = z.object({ items: z.array(workoutListItemSchema) });

export type WorkoutListResponse = z.infer<typeof workoutListResponseSchema>;
