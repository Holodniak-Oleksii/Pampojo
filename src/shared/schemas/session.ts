import { z } from 'zod';
import {
  SESSION_EXERCISES_MAX,
  SESSION_NOTE_MAX,
  SESSION_SETS_MAX,
  SESSION_STATUS,
  SET_RANGE,
} from '@/constants/session';
import { TARGET_RANGE, WORKOUT_NAME_MAX, WORKOUT_NOTE_MAX } from '@/constants/workout';
import { lateralitySchema, trackingTypeSchema } from './exercise';
import { calendarDateSchema, enumOf } from './utils';

export const sessionIdParamsSchema = z.object({ id: z.uuid() });
export const setIdParamsSchema = z.object({ id: z.uuid() });

export const sessionStatusSchema = enumOf(SESSION_STATUS);

const isoDate = z.iso.datetime({ offset: true });

const target = (range: { min: number; max: number }) =>
  z.number().int().min(range.min).max(range.max).nullable();

const targetFields = {
  targetSets: target(TARGET_RANGE.sets),
  targetRepsMin: target(TARGET_RANGE.reps),
  targetRepsMax: target(TARGET_RANGE.reps),
  targetWeightKg: z
    .number()
    .min(TARGET_RANGE.weightKg.min)
    .max(TARGET_RANGE.weightKg.max)
    .multipleOf(TARGET_RANGE.weightKg.step)
    .nullable(),
  targetDurationSec: target(TARGET_RANGE.durationSec),
  targetDistanceM: target(TARGET_RANGE.distanceM),
  notes: z.string().max(WORKOUT_NOTE_MAX).nullable(),
};

/** What a session needs to render an exercise without a catalog lookup. */
export const sessionExerciseInfoSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(200),
    trackingType: trackingTypeSchema,
    laterality: lateralitySchema.nullable(),
    thumbnailUrl: z.string().max(2000).nullable(),
  })
  .strict();

export type SessionExerciseInfo = z.infer<typeof sessionExerciseInfoSchema>;

export const snapshotExerciseSchema = z
  .object({
    id: z.uuid(),
    exerciseId: z.uuid(),
    ...targetFields,
    exercise: sessionExerciseInfoSchema,
  })
  .strict();

export const workoutSnapshotSchema = z
  .object({
    workoutId: z.uuid(),
    name: z.string().min(1).max(WORKOUT_NAME_MAX),
    description: z.string().max(500).nullable(),
    exercises: z.array(snapshotExerciseSchema).max(SESSION_EXERCISES_MAX),
  })
  .strict();

export type WorkoutSnapshot = z.infer<typeof workoutSnapshotSchema>;

export const sessionExerciseSchema = z
  .object({
    id: z.uuid(),
    exerciseId: z.uuid(),
    plannedSets: z.number().int().min(1).max(SESSION_SETS_MAX),
    ...targetFields,
    exercise: sessionExerciseInfoSchema,
  })
  .strict()
  .refine((value) => value.exercise.id === value.exerciseId, {
    error: 'Exercise info does not match exerciseId',
    path: ['exercise', 'id'],
  });

export type SessionExercise = z.infer<typeof sessionExerciseSchema>;

const sessionExercisesSchema = z
  .array(sessionExerciseSchema)
  .min(1)
  .max(SESSION_EXERCISES_MAX)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    error: 'Exercise entry ids must be unique',
  });

export const putSessionInputSchema = z
  .object({
    workoutId: z.uuid(),
    workoutSnapshot: workoutSnapshotSchema,
    exercises: sessionExercisesSchema,
    startedAt: isoDate,
    /** The planned date this session fulfils (spec 11). */
    scheduledFor: calendarDateSchema.nullable().optional(),
  })
  .strict();

export type PutSessionInput = z.infer<typeof putSessionInputSchema>;

export const patchSessionInputSchema = z
  .object({
    exercises: sessionExercisesSchema.optional(),
    notes: z.string().max(SESSION_NOTE_MAX).nullable().optional(),
    status: z.enum([SESSION_STATUS.COMPLETED, SESSION_STATUS.ABANDONED]).optional(),
    finishedAt: isoDate.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to update' })
  .refine((value) => value.status !== SESSION_STATUS.COMPLETED || value.finishedAt !== undefined, {
    error: 'finishedAt is required to complete a session',
    path: ['finishedAt'],
  });

export type PatchSessionInput = z.infer<typeof patchSessionInputSchema>;

const setValueFields = {
  weightKg: z
    .number()
    .min(SET_RANGE.weightKg.min)
    .max(SET_RANGE.weightKg.max)
    .multipleOf(SET_RANGE.weightKg.step)
    .nullable(),
  reps: z.number().int().min(SET_RANGE.reps.min).max(SET_RANGE.reps.max).nullable(),
  durationSec: z
    .number()
    .int()
    .min(SET_RANGE.durationSec.min)
    .max(SET_RANGE.durationSec.max)
    .nullable(),
  distanceM: z.number().int().min(SET_RANGE.distanceM.min).max(SET_RANGE.distanceM.max).nullable(),
};

export const setValuesSchema = z.object(setValueFields).strict();

export type SetValues = z.infer<typeof setValuesSchema>;

export const putSetInputSchema = z
  .object({
    sessionId: z.uuid(),
    sessionExerciseId: z.uuid(),
    exerciseId: z.uuid(),
    setIndex: z
      .number()
      .int()
      .min(0)
      .max(SESSION_SETS_MAX - 1),
    ...setValueFields,
    completedAt: isoDate,
  })
  .strict();

export type PutSetInput = z.infer<typeof putSetInputSchema>;

export const patchSetInputSchema = z
  .object({
    weightKg: setValueFields.weightKg.optional(),
    reps: setValueFields.reps.optional(),
    durationSec: setValueFields.durationSec.optional(),
    distanceM: setValueFields.distanceM.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'Nothing to update' });

export type PatchSetInput = z.infer<typeof patchSetInputSchema>;

export const setLogSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  sessionExerciseId: z.uuid(),
  exerciseId: z.uuid(),
  setIndex: z.number().int(),
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
  durationSec: z.number().nullable(),
  distanceM: z.number().nullable(),
  completedAt: z.string(),
});

export type SetLog = z.infer<typeof setLogSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  workoutId: z.uuid().nullable(),
  workoutSnapshot: workoutSnapshotSchema,
  exercises: z.array(sessionExerciseSchema),
  scheduledFor: z.string().nullable(),
  status: sessionStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  notes: z.string().nullable(),
  updatedAt: z.string(),
  setLogs: z.array(setLogSchema),
});

export type Session = z.infer<typeof sessionSchema>;

export const sessionListQuerySchema = z
  .object({
    status: z.enum([SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.COMPLETED]).optional(),
    exerciseId: z.uuid().optional(),
    scheduledFor: calendarDateSchema.optional(),
  })
  .strict();

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

export const sessionListItemSchema = z.object({
  id: z.uuid(),
  workoutId: z.uuid().nullable(),
  workoutName: z.string(),
  scheduledFor: z.string().nullable(),
  status: sessionStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export type SessionListItem = z.infer<typeof sessionListItemSchema>;

export const sessionListResponseSchema = z.object({ items: z.array(sessionListItemSchema) });

export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

export const lastPerformanceSetSchema = z.object({
  setIndex: z.number().int(),
  weightKg: z.number().nullable(),
  reps: z.number().nullable(),
  durationSec: z.number().nullable(),
  distanceM: z.number().nullable(),
});

export type LastPerformanceSet = z.infer<typeof lastPerformanceSetSchema>;

export const lastPerformanceSchema = z.object({
  sessionId: z.uuid(),
  finishedAt: z.string(),
  sets: z.array(lastPerformanceSetSchema),
});

export type LastPerformance = z.infer<typeof lastPerformanceSchema>;

export const lastPerformanceResponseSchema = z.object({ item: lastPerformanceSchema.nullable() });

export type LastPerformanceResponse = z.infer<typeof lastPerformanceResponseSchema>;
