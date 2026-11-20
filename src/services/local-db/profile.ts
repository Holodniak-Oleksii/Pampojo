import { MEASUREMENT_TYPE } from '@/constants/measurement';
import { ageOn, todayIn } from '@/lib/dates';
import type { Gym } from '@/shared/schemas/gym';
import type { Profile } from '@/shared/schemas/profile';
import type { PampojoDb } from './db';

/**
 * The pulled profile with the latest weight from the local measurements, so a weight saved
 * offline shows at once. `null` before the first pull.
 */
export async function getLocalProfile(db: PampojoDb): Promise<Profile | null> {
  const row = await db.meta.get('profile');
  if (row?.key !== 'profile') return null;
  const profile = row.value;
  const weights = (await db.measurements.toArray())
    .filter((item) => item.type === MEASUREMENT_TYPE.WEIGHT)
    .sort(
      (a, b) => b.measuredOn.localeCompare(a.measuredOn) || b.updatedAt.localeCompare(a.updatedAt),
    );
  const latest = weights[0];
  return {
    ...profile,
    age: ageOn(profile.birthDate, todayIn(profile.timeZone)),
    latestWeightKg: latest?.value ?? null,
    latestWeightOn: latest?.measuredOn ?? null,
  };
}

export async function putLocalProfile(db: PampojoDb, profile: Profile): Promise<void> {
  await db.meta.put({ key: 'profile', value: profile });
}

/** `undefined` before the first pull, `null` when the user has no gym profile. */
export async function getLocalGym(db: PampojoDb): Promise<Gym | null | undefined> {
  const row = await db.meta.get('gym');
  return row?.key === 'gym' ? row.value : undefined;
}

export async function putLocalGym(db: PampojoDb, gym: Gym | null): Promise<void> {
  await db.meta.put({ key: 'gym', value: gym });
}
