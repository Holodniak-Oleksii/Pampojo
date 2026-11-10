import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { account, bodyMeasurement, profile, user } from '@/server/db/schema';
import { completeOnboardingInputSchema } from '@/shared/schemas/profile';
import { deleteUsersByEmail } from '@/test/db';
import {
  completeOnboarding,
  findProfile,
  getOnboardingPrefill,
  getProfile,
  isOnboardingComplete,
  updateProfile,
} from '../service';

// Every case talks to the remote database.
vi.setConfig({ testTimeout: 30_000 });

const ZONE = 'Europe/Kyiv';

const input = (override: Record<string, unknown> = {}) =>
  completeOnboardingInputSchema.parse({
    displayName: 'John Smith',
    avatarEmoji: 'fox',
    avatarColor: 3,
    sex: 'male',
    birthDate: '1990-05-15',
    heightCm: 180,
    weightKg: 79.8,
    unitSystem: 'metric',
    timeZone: ZONE,
    ...override,
  });

// This file owns the `test-profile-` prefix, because test files run in parallel and clean up by pattern.
async function createUser(name = 'test') {
  const [row] = await getDb()
    .insert(user)
    .values({ name, email: `test-profile-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  return row.id;
}

async function weights(userId: string) {
  return getDb()
    .select()
    .from(bodyMeasurement)
    .where(and(eq(bodyMeasurement.userId, userId), eq(bodyMeasurement.type, 'weight')));
}

afterAll(async () => {
  await deleteUsersByEmail('test-profile-%@example.com');
});

describe('completeOnboarding', () => {
  it('creates the profile and the first weight and replaces user.name', async () => {
    const userId = await createUser('john.smith');

    const result = await completeOnboarding(userId, input());

    expect(result).toMatchObject({
      displayName: 'John Smith',
      heightCm: 180,
      latestWeightKg: 79.8,
      latestWeightOn: todayIn(ZONE),
      timeZone: ZONE,
    });
    expect(await weights(userId)).toHaveLength(1);
    const [row] = await getDb().select().from(user).where(eq(user.id, userId));
    expect(row?.name).toBe('John Smith');
    expect(await isOnboardingComplete(userId)).toBe(true);
  });

  it('is a no-op when repeated, sequentially or concurrently', async () => {
    const first = await createUser();
    await completeOnboarding(first, input());
    const again = await completeOnboarding(first, input({ displayName: 'Other', weightKg: 90 }));
    expect(again.displayName).toBe('John Smith');
    expect(await weights(first)).toHaveLength(1);

    const second = await createUser();
    await Promise.all([completeOnboarding(second, input()), completeOnboarding(second, input())]);
    expect(await weights(second)).toHaveLength(1);
    expect(await getDb().select().from(profile).where(eq(profile.userId, second))).toHaveLength(1);
  });

  it('rejects a user younger than 16 in the given time zone', async () => {
    const userId = await createUser();
    const today = todayIn(ZONE);
    const [y, m, d] = today.split('-');
    const turns16Tomorrow = new Date(Date.UTC(Number(y) - 16, Number(m) - 1, Number(d) + 1))
      .toISOString()
      .slice(0, 10);

    await expect(
      completeOnboarding(userId, input({ birthDate: turns16Tomorrow })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await isOnboardingComplete(userId)).toBe(false);
  });
});

describe('getProfile', () => {
  it('throws PROFILE_NOT_FOUND before onboarding and never returns another user', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    await completeOnboarding(owner, input());

    await expect(getProfile(stranger)).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND' });
  });
});

describe('findProfile', () => {
  it('returns null before onboarding and the profile after', async () => {
    const userId = await createUser();
    expect(await findProfile(userId)).toBeNull();

    await completeOnboarding(userId, input());

    expect(await findProfile(userId)).toMatchObject({ displayName: 'John Smith' });
  });
});

describe('updateProfile', () => {
  it('updates only the given fields and the user name', async () => {
    const userId = await createUser();
    await completeOnboarding(userId, input());

    const result = await updateProfile(userId, { displayName: 'Jane Doe' });

    expect(result).toMatchObject({ displayName: 'Jane Doe', heightCm: 180, avatarEmoji: 'fox' });
    const [row] = await getDb().select().from(user).where(eq(user.id, userId));
    expect(row?.name).toBe('Jane Doe');
  });

  it('keeps one weight per day and adds a row on another day', async () => {
    const userId = await createUser();
    await completeOnboarding(userId, input());

    await Promise.all([
      updateProfile(userId, { weightKg: 80.5 }),
      updateProfile(userId, { weightKg: 81 }),
    ]);
    let rows = await weights(userId);
    expect(rows).toHaveLength(1);
    await updateProfile(userId, { weightKg: 81.2 });
    rows = await weights(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(81.2);

    await getDb()
      .update(bodyMeasurement)
      .set({ measuredOn: '2020-01-01' })
      .where(eq(bodyMeasurement.userId, userId));
    const result = await updateProfile(userId, { weightKg: 82 });
    rows = await weights(userId);
    expect(rows).toHaveLength(2);
    expect(result.latestWeightKg).toBe(82);
  });

  it('throws PROFILE_NOT_FOUND before onboarding', async () => {
    const userId = await createUser();
    await expect(updateProfile(userId, { displayName: 'Jane' })).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});

describe('getOnboardingPrefill', () => {
  it('prefills the name only for Google users', async () => {
    const emailUser = await createUser('john.smith');
    const googleUser = await createUser('John Smith');
    await getDb().insert(account).values({
      accountId: randomUUID(),
      providerId: 'google',
      userId: googleUser,
      updatedAt: new Date(),
    });

    expect(await getOnboardingPrefill(emailUser, 'john.smith')).toEqual({ name: '' });
    expect(await getOnboardingPrefill(googleUser, 'John Smith')).toEqual({ name: 'John Smith' });
  });
});
