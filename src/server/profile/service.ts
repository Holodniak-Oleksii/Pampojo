import 'server-only';
import {
  AVATAR_COLORS,
  AVATAR_EMOJI_IDS,
  type AvatarColor,
  type AvatarEmojiId,
} from '@/constants/avatar';
import { NAME_MAX, SEX, UNIT_SYSTEM, type Sex, type UnitSystem } from '@/constants/profile';
import { ageOn, todayIn, validateAge } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import type {
  ParsedCompleteOnboardingInput,
  ParsedUpdateProfileInput,
  Profile,
} from '@/shared/schemas/profile';
import { PROFILE_ERROR } from './errors';
import {
  findLatestWeight,
  findProfileRow,
  hasGoogleAccount,
  insertProfileIfAbsent,
  insertWeight,
  lockProfileRow,
  profileExists,
  setUserName,
  updateProfileFields,
  upsertDayWeight,
  type ProfileFields,
  type ProfileRow,
} from './queries';

function assertAge(birthDate: string, timeZone: string) {
  const error = validateAge(birthDate, todayIn(timeZone));
  if (error) {
    // Same shape as a Zod failure, so the client maps it to the field like any other issue.
    throw new DomainError('VALIDATION_FAILED', 'Validation failed', [
      { code: 'custom', path: ['birthDate'], message: error },
    ]);
  }
}

function isOneOf<T extends string | number>(values: readonly T[], value: unknown): value is T {
  return values.some((allowed) => allowed === value);
}

// Check constraints guarantee these values; the guards only narrow the column types.
function toProfile(
  row: ProfileRow,
  weight: { value: number; measuredOn: string } | undefined,
): Profile {
  if (
    !isOneOf<AvatarEmojiId>(AVATAR_EMOJI_IDS, row.avatarEmoji) ||
    !isOneOf<AvatarColor>(AVATAR_COLORS, row.avatarColor) ||
    !isOneOf<Sex>(Object.values(SEX), row.sex) ||
    !isOneOf<UnitSystem>(Object.values(UNIT_SYSTEM), row.unitSystem)
  ) {
    throw new Error('Profile row has an unexpected enum value');
  }
  return {
    displayName: row.displayName,
    avatarEmoji: row.avatarEmoji,
    avatarColor: row.avatarColor,
    sex: row.sex,
    birthDate: row.birthDate,
    age: ageOn(row.birthDate, todayIn(row.timeZone)),
    heightCm: row.heightCm,
    latestWeightKg: weight?.value ?? null,
    latestWeightOn: weight?.measuredOn ?? null,
    unitSystem: row.unitSystem,
    timeZone: row.timeZone,
    onboardingCompletedAt: row.onboardingCompletedAt.toISOString(),
  };
}

export async function getProfile(userId: string): Promise<Profile> {
  const db = getDb();
  const [row, weight] = await Promise.all([
    findProfileRow(db, userId),
    findLatestWeight(db, userId),
  ]);
  if (!row) throw new DomainError(PROFILE_ERROR.NOT_FOUND, 'Profile not found');
  return toProfile(row, weight);
}

export async function completeOnboarding(
  userId: string,
  input: ParsedCompleteOnboardingInput,
): Promise<Profile> {
  assertAge(input.birthDate, input.timeZone);
  const { weightKg, ...values } = input;
  await getDb().transaction(async (tx) => {
    // `on conflict do nothing` makes a repeated or concurrent finish a no-op: no second weight.
    const inserted = await insertProfileIfAbsent(tx, userId, {
      ...values,
      onboardingCompletedAt: new Date(),
    });
    if (!inserted) return;
    await insertWeight(tx, userId, weightKg, todayIn(input.timeZone));
    await setUserName(tx, userId, input.displayName);
  });
  return getProfile(userId);
}

export async function updateProfile(
  userId: string,
  input: ParsedUpdateProfileInput,
): Promise<Profile> {
  await getDb().transaction(async (tx) => {
    // The row lock serializes one user's edits, so two same-day weight saves cannot both insert.
    const locked = await lockProfileRow(tx, userId);
    if (!locked) throw new DomainError(PROFILE_ERROR.NOT_FOUND, 'Profile not found');
    if (input.birthDate !== undefined) assertAge(input.birthDate, locked.timeZone);

    const { weightKg, ...rest } = input;
    const fields: ProfileFields = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(fields).length > 0) await updateProfileFields(tx, userId, fields);
    if (input.displayName !== undefined) await setUserName(tx, userId, input.displayName);
    if (weightKg !== undefined)
      await upsertDayWeight(tx, userId, weightKg, todayIn(locked.timeZone));
  });
  return getProfile(userId);
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  return profileExists(getDb(), userId);
}

export async function getOnboardingPrefill(
  userId: string,
  userName: string,
): Promise<{ name: string }> {
  return { name: (await hasGoogleAccount(getDb(), userId)) ? userName.slice(0, NAME_MAX) : '' };
}
