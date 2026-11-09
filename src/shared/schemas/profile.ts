import { z } from 'zod';
import { AVATAR_COLORS, AVATAR_EMOJI } from '@/constants/avatar';
import { HEIGHT_CM, NAME_MAX, SEX, UNIT_SYSTEM, WEIGHT_KG } from '@/constants/profile';
import { AGE_ERROR, isRealDate, isValidTimeZone } from '@/lib/dates';
import { round1 } from '@/lib/units';
import { enumOf } from './utils';

// Messages are codes; forms translate them, so the schema stays shared with the server.
export const PROFILE_FIELD_ERROR = {
  NAME_REQUIRED: 'name_required',
  NAME_TOO_LONG: 'name_too_long',
  SEX_REQUIRED: 'sex_required',
  DATE_INVALID: 'date_invalid',
  TOO_YOUNG: AGE_ERROR.TOO_YOUNG,
  TOO_OLD: AGE_ERROR.TOO_OLD,
  HEIGHT_RANGE: 'height_range',
  WEIGHT_RANGE: 'weight_range',
} as const;

const avatarEmojiIds = Object.fromEntries(Object.keys(AVATAR_EMOJI).map((id) => [id, id])) as {
  [K in keyof typeof AVATAR_EMOJI]: K;
};

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: PROFILE_FIELD_ERROR.NAME_REQUIRED })
  .max(NAME_MAX, { error: PROFILE_FIELD_ERROR.NAME_TOO_LONG });

export const avatarEmojiSchema = enumOf(avatarEmojiIds);

export const avatarColorSchema = z.literal([...AVATAR_COLORS]);

export const sexSchema = enumOf(SEX, { error: PROFILE_FIELD_ERROR.SEX_REQUIRED });

export const unitSystemSchema = enumOf(UNIT_SYSTEM);

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: PROFILE_FIELD_ERROR.DATE_INVALID })
  .refine(
    (value) => {
      const [y, m, d] = value.split('-').map(Number);
      return isRealDate(y ?? 0, m ?? 0, d ?? 0);
    },
    { error: PROFILE_FIELD_ERROR.DATE_INVALID },
  );

export const heightCmSchema = z
  .number({ error: PROFILE_FIELD_ERROR.HEIGHT_RANGE })
  .transform(round1)
  .pipe(
    z
      .number()
      .min(HEIGHT_CM.min, { error: PROFILE_FIELD_ERROR.HEIGHT_RANGE })
      .max(HEIGHT_CM.max, { error: PROFILE_FIELD_ERROR.HEIGHT_RANGE }),
  );

export const weightKgSchema = z
  .number({ error: PROFILE_FIELD_ERROR.WEIGHT_RANGE })
  .transform(round1)
  .pipe(
    z
      .number()
      .min(WEIGHT_KG.min, { error: PROFILE_FIELD_ERROR.WEIGHT_RANGE })
      .max(WEIGHT_KG.max, { error: PROFILE_FIELD_ERROR.WEIGHT_RANGE }),
  );

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone);

export const completeOnboardingInputSchema = z
  .object({
    displayName: displayNameSchema,
    avatarEmoji: avatarEmojiSchema,
    avatarColor: avatarColorSchema,
    sex: sexSchema,
    birthDate: birthDateSchema,
    heightCm: heightCmSchema,
    weightKg: weightKgSchema,
    unitSystem: unitSystemSchema,
    timeZone: timeZoneSchema,
  })
  .strict();

export const updateProfileInputSchema = completeOnboardingInputSchema
  .omit({ timeZone: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: 'empty_update' });

export const profileSchema = z.object({
  displayName: z.string(),
  avatarEmoji: avatarEmojiSchema,
  avatarColor: avatarColorSchema,
  sex: enumOf(SEX),
  birthDate: z.string(),
  age: z.number().int(),
  heightCm: z.number(),
  latestWeightKg: z.number().nullable(),
  latestWeightOn: z.string().nullable(),
  unitSystem: unitSystemSchema,
  timeZone: z.string(),
  onboardingCompletedAt: z.string(),
});

export type CompleteOnboardingInput = z.input<typeof completeOnboardingInputSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileInputSchema>;
export type ParsedCompleteOnboardingInput = z.output<typeof completeOnboardingInputSchema>;
export type ParsedUpdateProfileInput = z.output<typeof updateProfileInputSchema>;
export type Profile = z.infer<typeof profileSchema>;
