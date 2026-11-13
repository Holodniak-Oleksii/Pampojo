import { z } from 'zod';
import {
  DESCRIPTION_MAX,
  DIFFICULTIES,
  EQUIPMENT,
  EQUIPMENT_LIST,
  EXERCISE_NAME_MAX,
  EXERCISE_SEARCH_MAX,
  FRAME_LIMIT,
  MISTAKES_MAX_COUNT,
  LATERALITY,
  LIST_LIMIT,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUP,
  MUSCLE_GROUPS,
  STEP_MAX,
  STEPS_MAX_COUNT,
  TRACKING_TYPE,
} from '@/constants/exercise';
import { gymEquipmentSchema, gymRequirementsSchema } from './gym';
import { enumOf, repeatable } from './utils';

export const muscleGroupSchema = enumOf(MUSCLE_GROUP);
export const equipmentSchema = enumOf(EQUIPMENT);
export const movementPatternSchema = enumOf(MOVEMENT_PATTERN);
export const mechanicSchema = enumOf(MECHANIC);
export const lateralitySchema = enumOf(LATERALITY);
export const trackingTypeSchema = enumOf(TRACKING_TYPE);
export const difficultySchema = z.literal([...DIFFICULTIES]);

/** Storage keys of each frame in two sizes. Own frames carry an id; system frames do not. */
export const exerciseMediaSchema = z.object({
  frames: z.array(z.object({ id: z.uuid().optional(), thumb: z.string(), full: z.string() })),
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
    mine: z.enum(['1']).optional(),
    gym: z.enum(['1']).optional(),
  })
  .strict();

export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export const exerciseIdParamsSchema = z.object({ id: z.uuid() });

export const exerciseFrameParamsSchema = z.object({ id: z.uuid(), frameId: z.uuid() });

/** `id` is null for system frames, which cannot be changed. */
export const exerciseFrameSchema = z.object({
  id: z.uuid().nullable(),
  thumbUrl: z.string(),
  fullUrl: z.string(),
});

export type ExerciseFrame = z.infer<typeof exerciseFrameSchema>;

export const exerciseListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  primaryMuscles: z.array(muscleGroupSchema),
  equipment: z.array(equipmentSchema),
  thumbnailUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /** Every frame, so cards can animate on hover like the details page. */
  frames: z.array(exerciseFrameSchema),
  section: muscleGroupSchema.nullable(),
  isOwn: z.boolean(),
  gymEquipment: z.array(z.array(gymEquipmentSchema)),
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
  frames: z.array(exerciseFrameSchema),
  isOwn: z.boolean(),
  sourceExerciseId: z.uuid().nullable(),
  gymEquipment: z.array(z.array(gymEquipmentSchema)),
});

export type Exercise = z.infer<typeof exerciseSchema>;

// Messages are codes; the form translates them, so the schema stays shared with the server.
export const EXERCISE_FIELD_ERROR = {
  NAME_REQUIRED: 'name_required',
  NAME_TOO_LONG: 'name_too_long',
  NAME_TAKEN: 'name_taken',
  PRIMARY_REQUIRED: 'primary_required',
  EQUIPMENT_REQUIRED: 'equipment_required',
  TEXT_TOO_LONG: 'text_too_long',
} as const;

/** A list of short texts; empty items are dropped, so a blank step in the form is not an error. */
function textList(maxCount: number) {
  return z
    .array(z.string())
    .transform((items) => items.map((item) => item.trim()).filter((item) => item !== ''))
    .pipe(
      z
        .array(z.string().max(STEP_MAX, { error: EXERCISE_FIELD_ERROR.TEXT_TOO_LONG }))
        .max(maxCount),
    );
}

const uniqueMuscles = z.array(muscleGroupSchema).transform((muscles) => [...new Set(muscles)]);

/** Field rules without defaults: a PATCH must leave missing fields untouched. */
const exerciseFieldShape = {
  name: z
    .string()
    .trim()
    .min(1, { error: EXERCISE_FIELD_ERROR.NAME_REQUIRED })
    .max(EXERCISE_NAME_MAX, { error: EXERCISE_FIELD_ERROR.NAME_TOO_LONG }),
  primaryMuscles: uniqueMuscles.pipe(
    z.array(muscleGroupSchema).min(1, { error: EXERCISE_FIELD_ERROR.PRIMARY_REQUIRED }),
  ),
  secondaryMuscles: uniqueMuscles,
  equipment: z
    .array(equipmentSchema)
    .transform((items) => [...new Set(items)])
    .pipe(z.array(equipmentSchema).min(1, { error: EXERCISE_FIELD_ERROR.EQUIPMENT_REQUIRED })),
  trackingType: trackingTypeSchema,
  movementPattern: movementPatternSchema.nullable(),
  mechanic: mechanicSchema.nullable(),
  laterality: lateralitySchema.nullable(),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX, { error: EXERCISE_FIELD_ERROR.TEXT_TOO_LONG }),
  instructions: textList(STEPS_MAX_COUNT),
  commonMistakes: textList(MISTAKES_MAX_COUNT),
  gymEquipment: gymRequirementsSchema,
};

/** The form and create body: optional fields default to empty. */
export const exerciseFieldsSchema = z.object({
  ...exerciseFieldShape,
  secondaryMuscles: exerciseFieldShape.secondaryMuscles.default([]),
  movementPattern: exerciseFieldShape.movementPattern.default(null),
  mechanic: exerciseFieldShape.mechanic.default(null),
  laterality: exerciseFieldShape.laterality.default(null),
  description: exerciseFieldShape.description.default(''),
  instructions: exerciseFieldShape.instructions.default([]),
  commonMistakes: exerciseFieldShape.commonMistakes.default([]),
  gymEquipment: exerciseFieldShape.gymEquipment.default([]),
});

/** Secondary muscles never repeat a primary one; the extra ones are dropped. */
function withoutPrimaryInSecondary<
  T extends { primaryMuscles?: string[]; secondaryMuscles?: string[] },
>(value: T): T {
  if (!value.primaryMuscles || !value.secondaryMuscles) return value;
  const primary = new Set(value.primaryMuscles);
  return { ...value, secondaryMuscles: value.secondaryMuscles.filter((m) => !primary.has(m)) };
}

export const createExerciseInputSchema = exerciseFieldsSchema
  .extend({ sourceExerciseId: z.uuid().nullable().default(null) })
  .strict()
  .transform(withoutPrimaryInSecondary);

export type CreateExerciseInput = z.input<typeof createExerciseInputSchema>;
export type ParsedCreateExerciseInput = z.output<typeof createExerciseInputSchema>;

export const updateExerciseInputSchema = z
  .object(exerciseFieldShape)
  .partial()
  .extend({ frameOrder: z.array(z.uuid()).max(FRAME_LIMIT).optional() })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'At least one field is required',
  })
  .transform(withoutPrimaryInSecondary);

export type UpdateExerciseInput = z.input<typeof updateExerciseInputSchema>;
export type ParsedUpdateExerciseInput = z.output<typeof updateExerciseInputSchema>;
