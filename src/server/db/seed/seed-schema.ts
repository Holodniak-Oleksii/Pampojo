// Runs under plain Node (`pnpm db:seed`): package imports and relative `.ts` paths only.
import { z } from 'zod';
import {
  DIFFICULTIES,
  EQUIPMENT_LIST,
  EXERCISE_NAME_MAX,
  LATERALITY,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUPS,
  POPULARITY,
  TRACKING_TYPE,
} from '../../../constants/exercise.ts';
import { GYM_EQUIPMENT_KEYS } from '../../../constants/gym.ts';

const nonEmpty = z.string().trim().min(1);
const muscles = z.array(z.enum(MUSCLE_GROUPS));

/** Every group must be met; any item inside a group meets it. `[]` means always available. */
const gymRequirements = z.array(
  z
    .array(z.enum(GYM_EQUIPMENT_KEYS))
    .min(1)
    .refine((group) => new Set(group).size === group.length, { error: 'Repeated item in a group' }),
);

const translationSchema = z
  .object({
    name: nonEmpty.max(EXERCISE_NAME_MAX),
    aliases: z.array(nonEmpty.max(EXERCISE_NAME_MAX)).max(5),
    description: nonEmpty.max(400),
    instructions: z.array(nonEmpty).min(1).max(8),
    commonMistakes: z.array(nonEmpty).min(1).max(5),
  })
  .strict();

export const seedExerciseSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    sourceId: nonEmpty,
    primaryMuscles: muscles.min(1),
    secondaryMuscles: muscles,
    movementPattern: z.enum(Object.values(MOVEMENT_PATTERN)),
    equipment: z.array(z.enum(EQUIPMENT_LIST)).min(1),
    gymEquipment: gymRequirements,
    mechanic: z.enum(Object.values(MECHANIC)),
    laterality: z.enum(Object.values(LATERALITY)),
    trackingType: z.enum(Object.values(TRACKING_TYPE)),
    difficulty: z.literal([...DIFFICULTIES]),
    popularity: z.number().int().min(POPULARITY.min).max(POPULARITY.max),
    translations: z.object({ en: translationSchema, uk: translationSchema }).strict(),
  })
  .strict();

export type SeedExercise = z.infer<typeof seedExerciseSchema>;

export const seedCatalogSchema = z.array(seedExerciseSchema).superRefine((entries, ctx) => {
  const seen = { slug: new Set<string>(), name: new Set<string>() };
  entries.forEach((entry, index) => {
    if (seen.slug.has(entry.slug)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'slug'],
        message: `Duplicate slug ${entry.slug}`,
      });
    }
    const name = entry.translations.en.name.toLowerCase();
    if (seen.name.has(name)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'translations', 'en', 'name'],
        message: `Duplicate name ${name}`,
      });
    }
    seen.slug.add(entry.slug);
    seen.name.add(name);
  });
});

/** Storage keys of the two frames, each in two sizes. The media script uploads to the same keys. */
export function mediaKeys(slug: string) {
  return {
    frames: [0, 1].map((frame) => ({
      thumb: `system/${slug}/${frame}-thumb.webp`,
      full: `system/${slug}/${frame}-full.webp`,
    })),
  };
}
