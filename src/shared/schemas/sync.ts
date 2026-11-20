import { z } from 'zod';
import { LOCALES } from '@/i18n/config';
import {
  SYNC_COUNTED_PHASES,
  SYNC_CURSOR_MAX,
  SYNC_MUTATION_TYPE,
  SYNC_PUSH_BATCH_MAX,
  SYNC_PUSH_STATUS,
} from '@/constants/sync';
import {
  difficultySchema,
  equipmentSchema,
  exerciseFrameSchema,
  lateralitySchema,
  mechanicSchema,
  movementPatternSchema,
  muscleGroupSchema,
  trackingTypeSchema,
} from './exercise';
import { gymEquipmentSchema, gymSchema } from './gym';
import { measurementSchema } from './measurement';
import { profileSchema } from './profile';
import { bestsSchema } from './progress';
import { lastPerformanceSchema, sessionSchema, setLogSchema } from './session';
import { enumOf } from './utils';

export const syncMutationTypeSchema = enumOf(SYNC_MUTATION_TYPE);

/** `payload` is parsed per type on the server, so one bad payload rejects only its mutation. */
export const syncMutationSchema = z
  .object({
    id: z.uuid(),
    type: syncMutationTypeSchema,
    entityId: z.uuid(),
    payload: z.unknown().optional(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const pushRequestSchema = z
  .object({ mutations: z.array(syncMutationSchema).min(1).max(SYNC_PUSH_BATCH_MAX) })
  .strict();

export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResultSchema = z.object({
  id: z.uuid(),
  status: enumOf(SYNC_PUSH_STATUS),
  error: z.string().optional(),
});

export type PushResult = z.infer<typeof pushResultSchema>;

export const pushResponseSchema = z.object({ results: z.array(pushResultSchema) });

export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullQuerySchema = z.object({ since: z.string().max(SYNC_CURSOR_MAX).optional() });

export const syncWorkoutExerciseSchema = z.object({
  id: z.uuid(),
  exerciseId: z.uuid(),
  targetSets: z.number().nullable(),
  targetRepsMin: z.number().nullable(),
  targetRepsMax: z.number().nullable(),
  targetWeightKg: z.number().nullable(),
  targetDurationSec: z.number().nullable(),
  targetDistanceM: z.number().nullable(),
  notes: z.string().nullable(),
});

export type SyncWorkoutExercise = z.infer<typeof syncWorkoutExerciseSchema>;

export const syncWorkoutSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  exercises: z.array(syncWorkoutExerciseSchema),
});

export type SyncWorkout = z.infer<typeof syncWorkoutSchema>;

export const syncScheduleRuleSchema = z.object({
  id: z.uuid(),
  workoutId: z.uuid(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  weekdays: z.array(z.number().int()),
  intervalWeeks: z.number().int(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type SyncScheduleRule = z.infer<typeof syncScheduleRuleSchema>;

export const syncExerciseTranslationSchema = z.object({
  locale: z.enum(LOCALES),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  instructions: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  searchName: z.string(),
  searchAliases: z.string(),
});

export type SyncExerciseTranslation = z.infer<typeof syncExerciseTranslationSchema>;

export const syncExerciseSchema = z.object({
  id: z.uuid(),
  isOwn: z.boolean(),
  primaryMuscles: z.array(muscleGroupSchema),
  secondaryMuscles: z.array(muscleGroupSchema),
  equipment: z.array(equipmentSchema),
  movementPattern: movementPatternSchema.nullable(),
  mechanic: mechanicSchema.nullable(),
  laterality: lateralitySchema.nullable(),
  trackingType: trackingTypeSchema,
  difficulty: difficultySchema.nullable(),
  popularity: z.number().nullable(),
  frames: z.array(exerciseFrameSchema),
  gymEquipment: z.array(z.array(gymEquipmentSchema)),
  sourceExerciseId: z.uuid().nullable(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  translations: z.array(syncExerciseTranslationSchema),
});

export type SyncExercise = z.infer<typeof syncExerciseSchema>;

export const syncSessionSchema = sessionSchema.omit({ setLogs: true });

export type SyncSession = z.infer<typeof syncSessionSchema>;

export const syncSetLogSchema = setLogSchema.extend({ deletedAt: z.string().nullable() });

export type SyncSetLog = z.infer<typeof syncSetLogSchema>;

export const syncMeasurementSchema = measurementSchema.extend({
  deletedAt: z.string().nullable(),
});

export type SyncMeasurement = z.infer<typeof syncMeasurementSchema>;

export const syncLastPerformanceSchema = z.object({
  exerciseId: z.uuid(),
  item: lastPerformanceSchema.nullable(),
  bests: bestsSchema.nullable(),
});

export type SyncLastPerformance = z.infer<typeof syncLastPerformanceSchema>;

export const syncTotalsSchema = z.object(
  Object.fromEntries(SYNC_COUNTED_PHASES.map((phase) => [phase, z.number().int().min(0)])) as {
    [K in (typeof SYNC_COUNTED_PHASES)[number]]: z.ZodNumber;
  },
);

export type SyncTotals = z.infer<typeof syncTotalsSchema>;

export const syncChangesSchema = z.object({
  profile: profileSchema.nullable(),
  gym: gymSchema.nullable(),
  gymChanged: z.boolean(),
  workouts: z.array(syncWorkoutSchema),
  scheduleRules: z.array(syncScheduleRuleSchema),
  exercises: z.array(syncExerciseSchema),
  lastPerformance: z.array(syncLastPerformanceSchema),
  sessions: z.array(syncSessionSchema),
  setLogs: z.array(syncSetLogSchema),
  measurements: z.array(syncMeasurementSchema),
});

export type SyncChanges = z.infer<typeof syncChangesSchema>;

export const pullResponseSchema = z.object({
  changes: syncChangesSchema,
  nextCursor: z.string().nullable(),
  cursor: z.string().nullable(),
  totals: syncTotalsSchema.optional(),
});

export type PullResponse = z.infer<typeof pullResponseSchema>;
