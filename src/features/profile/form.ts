import { z } from 'zod';
import {
  AVATAR_COLORS,
  AVATAR_EMOJI_IDS,
  type AvatarColor,
  type AvatarEmojiId,
} from '@/constants/avatar';
import {
  HEIGHT_CM,
  NAME_MAX,
  SEX,
  UNIT_SYSTEM,
  WEIGHT_KG,
  type Sex,
  type UnitSystem,
} from '@/constants/profile';
import { isoDate, isRealDate, todayIn, validateAge } from '@/lib/dates';
import {
  cmFromFeetInches,
  feetInchesFromCm,
  kgFromLb,
  lbFromKg,
  parseDecimal,
  parseInteger,
  round1,
} from '@/lib/units';
import {
  PROFILE_FIELD_ERROR,
  avatarColorSchema,
  avatarEmojiSchema,
  unitSystemSchema,
  type CompleteOnboardingInput,
  type Profile,
  type UpdateProfileInput,
} from '@/shared/schemas/profile';
import { enumOf } from '@/shared/schemas/utils';

/** What the inputs hold: numbers stay strings until the form is submitted. */
export interface ProfileFormValues {
  displayName: string;
  avatarEmoji: AvatarEmojiId;
  avatarColor: AvatarColor;
  sex: Sex | null;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  unitSystem: UnitSystem;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  /** kg or lb, following `unitSystem`. */
  weight: string;
}

export type ProfileFormField = keyof ProfileFormValues;

export const FIELD_GROUP = {
  NAME: 'name',
  SEX_BIRTH: 'sexBirth',
  BODY: 'body',
} as const;

export type FieldGroup = (typeof FIELD_GROUP)[keyof typeof FIELD_GROUP];

export const profileFormValuesSchema = z.object({
  displayName: z.string().max(200),
  avatarEmoji: avatarEmojiSchema,
  avatarColor: avatarColorSchema,
  sex: enumOf(SEX).nullable(),
  birthDay: z.string().max(4),
  birthMonth: z.string().max(4),
  birthYear: z.string().max(8),
  unitSystem: unitSystemSchema,
  heightCm: z.string().max(8),
  heightFt: z.string().max(4),
  heightIn: z.string().max(4),
  weight: z.string().max(8),
});

export function randomAvatar(): { avatarEmoji: AvatarEmojiId; avatarColor: AvatarColor } {
  const emoji = AVATAR_EMOJI_IDS[Math.floor(Math.random() * AVATAR_EMOJI_IDS.length)];
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  return { avatarEmoji: emoji ?? 'fox', avatarColor: color ?? 1 };
}

export function emptyFormValues(displayName: string): ProfileFormValues {
  return {
    displayName,
    ...randomAvatar(),
    sex: null,
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    unitSystem: UNIT_SYSTEM.METRIC,
    heightCm: '',
    heightFt: '',
    heightIn: '',
    weight: '',
  };
}

function formatOneDecimal(value: number): string {
  return String(round1(value));
}

export function heightFieldsFromCm(
  cm: number,
): Pick<ProfileFormValues, 'heightCm' | 'heightFt' | 'heightIn'> {
  const { feet, inches } = feetInchesFromCm(cm);
  return { heightCm: String(Math.round(cm)), heightFt: String(feet), heightIn: String(inches) };
}

export function weightFieldFromKg(kg: number, unitSystem: UnitSystem): string {
  return formatOneDecimal(unitSystem === UNIT_SYSTEM.METRIC ? kg : lbFromKg(kg));
}

export function formValuesFromProfile(profile: Profile): ProfileFormValues {
  const [year = '', month = '', day = ''] = profile.birthDate.split('-');
  return {
    displayName: profile.displayName,
    avatarEmoji: profile.avatarEmoji,
    avatarColor: profile.avatarColor,
    sex: profile.sex,
    birthDay: day,
    birthMonth: month,
    birthYear: year,
    unitSystem: profile.unitSystem,
    ...heightFieldsFromCm(profile.heightCm),
    weight:
      profile.latestWeightKg === null
        ? ''
        : weightFieldFromKg(profile.latestWeightKg, profile.unitSystem),
  };
}

/** Canonical height in cm, or null when the inputs do not parse. */
export function parseHeightCm(values: ProfileFormValues): number | null {
  if (values.unitSystem === UNIT_SYSTEM.METRIC) return parseInteger(values.heightCm);
  const feet = parseInteger(values.heightFt);
  const inches = parseInteger(values.heightIn);
  if (feet === null || inches === null || inches > 11) return null;
  return cmFromFeetInches(feet, inches);
}

/** Canonical weight in kg rounded to 0.1, or null when the input does not parse. */
export function parseWeightKg(values: ProfileFormValues): number | null {
  const value = parseDecimal(values.weight);
  if (value === null) return null;
  return values.unitSystem === UNIT_SYSTEM.METRIC ? round1(value) : kgFromLb(value);
}

export function parseBirthDate(values: ProfileFormValues): string | null {
  if (!/^\d{1,2}$/.test(values.birthDay.trim()) || !/^\d{1,2}$/.test(values.birthMonth.trim())) {
    return null;
  }
  if (!/^\d{4}$/.test(values.birthYear.trim())) return null;
  const day = Number(values.birthDay);
  const month = Number(values.birthMonth);
  const year = Number(values.birthYear);
  return isRealDate(year, month, day) ? isoDate(year, month, day) : null;
}

/** Converts the typed height and weight into the other unit system; unparsable values stay as typed. */
export function convertBodyFields(
  values: ProfileFormValues,
  to: UnitSystem,
): Partial<ProfileFormValues> {
  const cm = parseHeightCm(values);
  const kg = parseWeightKg(values);
  return {
    ...(cm === null ? {} : heightFieldsFromCm(cm)),
    ...(kg === null ? {} : { weight: weightFieldFromKg(kg, to) }),
  };
}

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function profileFormSchema(groups: readonly FieldGroup[]) {
  return profileFormValuesSchema.superRefine((values, ctx) => {
    const issue = (path: ProfileFormField, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (groups.includes(FIELD_GROUP.NAME)) {
      const name = values.displayName.trim();
      if (name.length === 0) issue('displayName', PROFILE_FIELD_ERROR.NAME_REQUIRED);
      else if (name.length > NAME_MAX) issue('displayName', PROFILE_FIELD_ERROR.NAME_TOO_LONG);
    }

    if (groups.includes(FIELD_GROUP.SEX_BIRTH)) {
      if (values.sex === null) issue('sex', PROFILE_FIELD_ERROR.SEX_REQUIRED);
      const birthDate = parseBirthDate(values);
      // One error for the whole date group; it is shown under the day field's group.
      if (birthDate === null) issue('birthDay', PROFILE_FIELD_ERROR.DATE_INVALID);
      else {
        const ageError = validateAge(birthDate, todayIn(deviceTimeZone()));
        if (ageError) issue('birthDay', ageError);
      }
    }

    if (groups.includes(FIELD_GROUP.BODY)) {
      const cm = parseHeightCm(values);
      const heightPath = values.unitSystem === UNIT_SYSTEM.METRIC ? 'heightCm' : 'heightFt';
      if (cm === null || cm < HEIGHT_CM.min || cm > HEIGHT_CM.max) {
        issue(heightPath, PROFILE_FIELD_ERROR.HEIGHT_RANGE);
      }
      const kg = parseWeightKg(values);
      if (kg === null || kg < WEIGHT_KG.min || kg > WEIGHT_KG.max) {
        issue('weight', PROFILE_FIELD_ERROR.WEIGHT_RANGE);
      }
    }
  });
}

function required<T>(value: T | null): T {
  if (value === null) throw new Error('Form values were not validated');
  return value;
}

export function toCompleteOnboardingInput(values: ProfileFormValues): CompleteOnboardingInput {
  return {
    displayName: values.displayName.trim(),
    avatarEmoji: values.avatarEmoji,
    avatarColor: values.avatarColor,
    sex: required(values.sex),
    birthDate: required(parseBirthDate(values)),
    heightCm: required(parseHeightCm(values)),
    weightKg: required(parseWeightKg(values)),
    unitSystem: values.unitSystem,
    timeZone: deviceTimeZone(),
  };
}

type DirtyFields = Partial<Record<ProfileFormField, boolean>>;

/**
 * The PATCH body: fields the user edited whose canonical value differs from the stored one.
 * Height and weight count only when typed, so converting units alone never resends them.
 */
export function toUpdateProfileInput(
  values: ProfileFormValues,
  profile: Profile,
  dirty: DirtyFields,
): UpdateProfileInput {
  const body: UpdateProfileInput = {};
  const name = values.displayName.trim();
  if (name !== profile.displayName) body.displayName = name;
  if (values.avatarEmoji !== profile.avatarEmoji) body.avatarEmoji = values.avatarEmoji;
  if (values.avatarColor !== profile.avatarColor) body.avatarColor = values.avatarColor;
  if (values.sex !== null && values.sex !== profile.sex) body.sex = values.sex;
  const birthDate = parseBirthDate(values);
  if (birthDate !== null && birthDate !== profile.birthDate) body.birthDate = birthDate;
  if (values.unitSystem !== profile.unitSystem) body.unitSystem = values.unitSystem;
  if (dirty.heightCm || dirty.heightFt || dirty.heightIn) {
    const cm = parseHeightCm(values);
    if (cm !== null && cm !== profile.heightCm) body.heightCm = cm;
  }
  if (dirty.weight) {
    const kg = parseWeightKg(values);
    if (kg !== null && kg !== profile.latestWeightKg) body.weightKg = kg;
  }
  return body;
}

const SERVER_FIELD: Record<string, ProfileFormField> = {
  displayName: 'displayName',
  avatarEmoji: 'avatarEmoji',
  avatarColor: 'avatarColor',
  sex: 'sex',
  birthDate: 'birthDay',
  heightCm: 'heightCm',
  weightKg: 'weight',
};

/** Maps `VALIDATION_FAILED` issues from the API onto form fields. */
export function fieldErrorsFromIssues(
  details: unknown,
  unitSystem: UnitSystem,
): { field: ProfileFormField; message: string }[] {
  const parsed = z
    .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
    .safeParse(details);
  if (!parsed.success) return [];
  return parsed.data.flatMap(({ path, message }) => {
    const key = path[0];
    let field = typeof key === 'string' ? SERVER_FIELD[key] : undefined;
    if (field === 'heightCm' && unitSystem === UNIT_SYSTEM.IMPERIAL) field = 'heightFt';
    return field ? [{ field, message }] : [];
  });
}
