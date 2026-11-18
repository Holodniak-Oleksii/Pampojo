import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { bodyMeasurement, profile, user } from '@/server/db/schema';
import { addDays } from '@/shared/plan/occurrences';
import { putMeasurementInputSchema } from '@/shared/schemas/measurement';
import { deleteUsersByEmail, testPrefix } from '@/test/db';
import { deleteMeasurement, listMeasurements, putMeasurement } from '../service';

const PREFIX = testPrefix('measurements');
const ZONE = 'Europe/Kyiv';

// Every case talks to the remote database.
vi.setConfig({ testTimeout: 30_000 });

async function createUser() {
  const [row] = await getDb()
    .insert(user)
    .values({ name: 'test', email: `${PREFIX}-${randomUUID()}@example.com` })
    .returning();
  if (!row) throw new Error('No user');
  await getDb().insert(profile).values({
    userId: row.id,
    displayName: 'John Smith',
    avatarEmoji: 'fox',
    avatarColor: 1,
    sex: 'male',
    birthDate: '1990-05-15',
    heightCm: 183,
    timeZone: ZONE,
    onboardingCompletedAt: new Date(),
  });
  return row.id;
}

const today = () => todayIn(ZONE);
const input = (override: Record<string, unknown> = {}) =>
  putMeasurementInputSchema.parse({ type: 'waist', value: 86.5, measuredOn: today(), ...override });

async function liveRows(userId: string, type = 'waist') {
  return getDb()
    .select()
    .from(bodyMeasurement)
    .where(
      and(
        eq(bodyMeasurement.userId, userId),
        eq(bodyMeasurement.type, type),
        isNull(bodyMeasurement.deletedAt),
      ),
    );
}

let userId: string;

beforeEach(async () => {
  userId = await createUser();
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

describe('putMeasurement', () => {
  it('creates a row and answers a repeat with the same row (AC6)', async () => {
    const id = randomUUID();
    const first = await putMeasurement(userId, id, input());
    const second = await putMeasurement(userId, id, input());
    expect(first.created).toBe(true);
    expect(second.item).toMatchObject({ id, type: 'waist', value: 86.5 });
    expect(await liveRows(userId)).toHaveLength(1);
  });

  it('replaces the value of the day with a new id (AC7)', async () => {
    const first = await putMeasurement(userId, randomUUID(), input({ value: 87 }));
    const second = await putMeasurement(userId, randomUUID(), input({ value: 85.75 }));
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
    const rows = await liveRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toBe(85.75);
  });

  it('keeps one live row when two saves of a day run in parallel (AC7)', async () => {
    await Promise.all([
      putMeasurement(userId, randomUUID(), input({ value: 80 })),
      putMeasurement(userId, randomUUID(), input({ value: 81 })),
    ]);
    expect(await liveRows(userId)).toHaveLength(1);
  });

  it('edits the value and the date, and replaces a row on the new day', async () => {
    const yesterday = addDays(today(), -1);
    const old = await putMeasurement(userId, randomUUID(), input({ measuredOn: yesterday }));
    const other = await putMeasurement(userId, randomUUID(), input({ value: 90 }));
    const edited = await putMeasurement(userId, old.item.id, input({ value: 88.25 }));
    expect(edited.item).toMatchObject({ id: old.item.id, value: 88.25, measuredOn: today() });
    const rows = await liveRows(userId);
    expect(rows.map((row) => row.id)).toEqual([old.item.id]);
    expect(rows.some((row) => row.id === other.item.id)).toBe(false);
  });

  it('keeps one live row when an edit and a create meet on one day (review fix)', async () => {
    const yesterday = addDays(today(), -1);
    const old = await putMeasurement(userId, randomUUID(), input({ measuredOn: yesterday }));
    await Promise.all([
      putMeasurement(userId, old.item.id, input({ value: 80 })),
      putMeasurement(userId, randomUUID(), input({ value: 81 })),
    ]);
    expect(await liveRows(userId)).toHaveLength(1);
  });

  it('rejects a type change on an edit', async () => {
    const { item } = await putMeasurement(userId, randomUUID(), input());
    await expect(putMeasurement(userId, item.id, input({ type: 'hips' }))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('rejects a date after today in the profile zone (AC9)', async () => {
    await expect(
      putMeasurement(userId, randomUUID(), input({ measuredOn: addDays(today(), 1) })),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: [{ path: ['measuredOn'], message: 'measurement_future' }],
    });
  });

  it('reports another user’s measurement as not found (AC20)', async () => {
    const { item } = await putMeasurement(userId, randomUUID(), input());
    const stranger = await createUser();
    await expect(putMeasurement(stranger, item.id, input())).rejects.toMatchObject({
      code: 'MEASUREMENT_NOT_FOUND',
    });
    expect((await liveRows(userId))[0]?.value).toBe(86.5);
  });
});

describe('deleteMeasurement', () => {
  it('soft deletes and answers a repeat without an error', async () => {
    const { item } = await putMeasurement(userId, randomUUID(), input());
    await deleteMeasurement(userId, item.id);
    await deleteMeasurement(userId, item.id);
    expect(await liveRows(userId)).toHaveLength(0);
  });

  it('reports an unknown or foreign id as not found (AC20)', async () => {
    const { item } = await putMeasurement(userId, randomUUID(), input());
    const stranger = await createUser();
    await expect(deleteMeasurement(stranger, item.id)).rejects.toMatchObject({
      code: 'MEASUREMENT_NOT_FOUND',
    });
    await expect(deleteMeasurement(userId, randomUUID())).rejects.toMatchObject({
      code: 'MEASUREMENT_NOT_FOUND',
    });
    expect(await liveRows(userId)).toHaveLength(1);
  });
});

describe('listMeasurements', () => {
  it('returns only the user’s live rows, the newest first (AC20)', async () => {
    const yesterday = addDays(today(), -1);
    await putMeasurement(userId, randomUUID(), input({ measuredOn: yesterday, value: 87 }));
    await putMeasurement(userId, randomUUID(), input({ type: 'weight', value: 82.4 }));
    const gone = await putMeasurement(userId, randomUUID(), input({ type: 'neck', value: 40 }));
    await deleteMeasurement(userId, gone.item.id);
    const stranger = await createUser();
    await putMeasurement(stranger, randomUUID(), input());

    const { items } = await listMeasurements(userId);
    expect(items.map((item) => [item.type, item.measuredOn])).toEqual([
      ['weight', today()],
      ['waist', yesterday],
    ]);
  });
});
