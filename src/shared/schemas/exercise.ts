import { z } from 'zod';
import {
  DIFFICULTIES,
  EQUIPMENT,
  EQUIPMENT_LIST,
  EXERCISE_SEARCH_MAX,
  LATERALITY,
  LIST_LIMIT,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUP,
  MUSCLE_GROUPS,
  TRACKING_TYPE,
} from '@/constants/exercise';
import { enumOf, repeatable } from './utils';

export const muscleGroupSchema = enumOf(MUSCLE_GROUP);
export const equipmentSchema = enumOf(EQUIPMENT);
export const movementPatternSchema = enumOf(MOVEMENT_PATTERN);
export const mechanicSchema = enumOf(MECHANIC);
export const lateralitySchema = enumOf(LATERALITY);
export const trackingTypeSchema = enumOf(TRACKING_TYPE);
export const difficultySchema = z.literal([...DIFFICULTIES]);

/** Storage keys of the start and end frames, each in two sizes. */
export const exerciseMediaSchema = z.object({
  frames: z.array(z.object({ thumb: z.string(), full: z.string() })),
});

export type ExerciseMedia = z.infer<typeof exerciseMediaSchema>;

export const listExercisesQuerySchema = z
  .object({
    q: z.string().trim().max(EXERCISE_SEARCH_MAX).optional(),
    muscle: repeatable(muscleGroupSchema, MUSCLE_GROUPS.length).default([]),
    equipment: repeatable(equipmentSchema, EQUIPMENT_LIST.length).default([]),
    pattern: movementPatternSchema.optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(LIST_LIMIT.max).default(LIST_LIMIT.default),
  })
  .strict();

export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export const exerciseIdParamsSchema = z.object({ id: z.uuid() });

export const exerciseListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  primaryMuscles: z.array(muscleGroupSchema),
  equipment: z.array(equipmentSchema),
  thumbnailUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** Both frames, so cards can animate on hover like the details page. */
  frames: z.array(z.object({ thumbUrl: z.string(), fullUrl: z.string() })),
  section: muscleGroupSchema.nullable(),
  isOwn: z.boolean(),
});

export type ExerciseListItem = z.infer<typeof exerciseListItemSchema>;

export const exerciseListResponseSchema = z.object({
  items: z.array(exerciseListItemSchema),
  nextCursor: z.string().nullable(),
});

export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>;

export const exerciseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  instructions: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  primaryMuscles: z.array(muscleGroupSchema),
  secondaryMuscles: z.array(muscleGroupSchema),
  equipment: z.array(equipmentSchema),
  movementPattern: movementPatternSchema.nullable(),
  mechanic: mechanicSchema.nullable(),
  laterality: lateralitySchema.nullable(),
  trackingType: trackingTypeSchema,
  difficulty: difficultySchema.nullable(),
  frames: z.array(z.object({ thumbUrl: z.string(), fullUrl: z.string() })),
  isOwn: z.boolean(),
});

export type Exercise = z.infer<typeof exerciseSchema>;
