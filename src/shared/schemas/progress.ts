import { z } from 'zod';
import { DEFAULT_PROGRESS_RANGE, PROGRESS_RANGE, RECORD_TYPE } from '@/constants/progress';
import { trackingTypeSchema } from './exercise';
import { enumOf } from './utils';

export const progressRangeSchema = enumOf(PROGRESS_RANGE);
export const recordTypeSchema = enumOf(RECORD_TYPE);

export const progressQuerySchema = z.object({
  range: progressRangeSchema.default(DEFAULT_PROGRESS_RANGE),
});

export type ProgressQuery = z.infer<typeof progressQuerySchema>;

export const pointValuesSchema = z.object({
  topWeightKg: z.number().nullable(),
  e1rmKg: z.number().nullable(),
  volumeKg: z.number().nullable(),
  reps: z.number().nullable(),
  durationSec: z.number().nullable(),
  distanceM: z.number().nullable(),
});

export type PointValues = z.infer<typeof pointValuesSchema>;

export const progressPointSchema = pointValuesSchema.extend({
  sessionId: z.uuid(),
  /** Start date in the profile time zone, `YYYY-MM-DD`. */
  date: z.string(),
});

export type ProgressPoint = z.infer<typeof progressPointSchema>;

export const progressRecordSchema = z.object({
  type: recordTypeSchema,
  value: z.number(),
  /** The set weight for `most_reps` and `best_e1rm`. */
  weightKg: z.number().nullable(),
  /** The set reps for `best_e1rm`. */
  reps: z.number().nullable(),
  sessionId: z.uuid(),
  date: z.string(),
});

export type ProgressRecord = z.infer<typeof progressRecordSchema>;

export const exerciseProgressResponseSchema = z.object({
  trackingType: trackingTypeSchema,
  points: z.array(progressPointSchema),
  records: z.array(progressRecordSchema),
});

export type ExerciseProgressResponse = z.infer<typeof exerciseProgressResponseSchema>;

export const progressExerciseItemSchema = z.object({
  exerciseId: z.uuid(),
  name: z.string(),
  trackingType: trackingTypeSchema,
  thumbnailUrl: z.string().nullable(),
  lastTrainedAt: z.string(),
});

export type ProgressExerciseItem = z.infer<typeof progressExerciseItemSchema>;

export const progressExercisesResponseSchema = z.object({
  items: z.array(progressExerciseItemSchema),
  month: z.object({ workouts: z.number().int(), volumeKg: z.number() }),
});

export type ProgressExercisesResponse = z.infer<typeof progressExercisesResponseSchema>;

/** All-time bests of one exercise; a field is null when no set gave it. */
export const bestsSchema = z.object({
  heaviestWeightKg: z.number().nullable(),
  bestE1rmKg: z.number().nullable(),
  mostReps: z.object({ reps: z.number(), weightKg: z.number().nullable() }).nullable(),
  bestVolumeKg: z.number().nullable(),
  longestDurationSec: z.number().nullable(),
  longestDistanceM: z.number().nullable(),
});

export type Bests = z.infer<typeof bestsSchema>;

export const newRecordSchema = z.object({
  exerciseId: z.string(),
  type: recordTypeSchema,
  value: z.number(),
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
});

export type NewRecord = z.infer<typeof newRecordSchema>;
