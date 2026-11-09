import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { MEASUREMENT_TYPE } from '@/constants/measurement';
import type { Db } from '@/server/db/client';
import { account, bodyMeasurement, profile, user } from '@/server/db/schema';
import { touch } from '@/server/db/utils';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

export type ProfileRow = typeof profile.$inferSelect;
export type NewProfileValues = Omit<
  typeof profile.$inferInsert,
  'userId' | 'createdAt' | 'updatedAt'
>;
export type ProfileFields = Partial<
  Pick<
    ProfileRow,
    'displayName' | 'avatarEmoji' | 'avatarColor' | 'sex' | 'birthDate' | 'heightCm' | 'unitSystem'
  >
>;

export async function findProfileRow(
  db: Executor,
  userId: string,
): Promise<ProfileRow | undefined> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  return row;
}

export async function findLatestWeight(
  db: Executor,
  userId: string,
): Promise<{ value: number; measuredOn: string } | undefined> {
  const [row] = await db
    .select({ value: bodyMeasurement.value, measuredOn: bodyMeasurement.measuredOn })
    .from(bodyMeasurement)
    .where(
      and(
        eq(bodyMeasurement.userId, userId),
        eq(bodyMeasurement.type, MEASUREMENT_TYPE.WEIGHT),
        isNull(bodyMeasurement.deletedAt),
      ),
    )
    .orderBy(desc(bodyMeasurement.measuredOn), desc(bodyMeasurement.createdAt))
    .limit(1);
  return row;
}

/** Returns the inserted row, or undefined when the user already has a profile. */
export async function insertProfileIfAbsent(
  tx: Tx,
  userId: string,
  values: NewProfileValues,
): Promise<ProfileRow | undefined> {
  const [row] = await tx
    .insert(profile)
    .values({ ...values, userId })
    .onConflictDoNothing({ target: profile.userId })
    .returning();
  return row;
}

export async function lockProfileRow(tx: Tx, userId: string): Promise<ProfileRow | undefined> {
  const [row] = await tx
    .select()
    .from(profile)
    .where(eq(profile.userId, userId))
    .for('update')
    .limit(1);
  return row;
}

export async function updateProfileFields(tx: Tx, userId: string, fields: ProfileFields) {
  await tx
    .update(profile)
    .set({ ...fields, ...touch() })
    .where(eq(profile.userId, userId));
}

export async function insertWeight(tx: Tx, userId: string, kg: number, measuredOn: string) {
  await tx
    .insert(bodyMeasurement)
    .values({ userId, type: MEASUREMENT_TYPE.WEIGHT, value: kg, measuredOn });
}

/** Updates the user's weight for that day if one exists, otherwise adds one. Call under the profile lock. */
export async function upsertDayWeight(tx: Tx, userId: string, kg: number, measuredOn: string) {
  const [existing] = await tx
    .select({ id: bodyMeasurement.id })
    .from(bodyMeasurement)
    .where(
      and(
        eq(bodyMeasurement.userId, userId),
        eq(bodyMeasurement.type, MEASUREMENT_TYPE.WEIGHT),
        eq(bodyMeasurement.measuredOn, measuredOn),
        isNull(bodyMeasurement.deletedAt),
      ),
    )
    .orderBy(desc(bodyMeasurement.createdAt))
    .limit(1);
  if (existing) {
    await tx
      .update(bodyMeasurement)
      .set({ value: kg, ...touch() })
      .where(and(eq(bodyMeasurement.id, existing.id), eq(bodyMeasurement.userId, userId)));
    return;
  }
  await insertWeight(tx, userId, kg, measuredOn);
}

export async function setUserName(tx: Tx, userId: string, name: string) {
  await tx.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId));
}

export async function hasGoogleAccount(db: Executor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'google')))
    .limit(1);
  return Boolean(row);
}

export async function profileExists(db: Executor, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: profile.userId })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);
  return Boolean(row);
}
