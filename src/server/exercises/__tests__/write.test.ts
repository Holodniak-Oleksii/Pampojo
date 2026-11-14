import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSearch } from '@/lib/search';
import { exercise, exerciseTranslation, gymProfile, user } from '@/server/db/schema';
import {
  createExerciseInputSchema,
  listExercisesQuerySchema,
  updateExerciseInputSchema,
} from '@/shared/schemas/exercise';
import { withRollback } from '@/test/db';
import type { Tx } from '../queries';
import { findExercise, listExercises } from '../service';
import {
  createOwnExercise,
  deleteFrame,
  deleteOwnExercise,
  putFrame,
  updateOwnExercise,
} from '../write-service';

// Storage is external I/O: network calls are mocked, image conversion stays real.
vi.mock('@/server/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/storage')>();
  return {
    ...actual,
    ensureBucket: vi.fn(async () => {}),
    putObject: vi.fn(async () => {}),
    copyObject: vi.fn(async () => {}),
    removeObjects: vi.fn(async () => {}),
    isStorageConfigured: vi.fn(() => true),
    signUrls: vi.fn(async (_bucket: string, keys: readonly string[]) => {
      return new Map(keys.map((key) => [key, `https://signed.example.com/${key}`]));
    }),
  };
});

const storage = await import('@/server/storage');

vi.setConfig({ testTimeout: 30_000 });

const create = (input: Record<string, unknown> = {}) =>
  createExerciseInputSchema.parse({
    name: `Fixture ${randomUUID().slice(0, 8)}`,
    primaryMuscles: ['chest'],
    equipment: ['band'],
    trackingType: 'weight_reps',
    ...input,
  });

async function newUser(tx: Tx): Promise<string> {
  const [row] = await tx
    .insert(user)
    .values({ name: 'test', email: `test-exercises-write-${randomUUID()}@example.com` })
    .returning({ id: user.id });
  if (!row) throw new Error('No user');
  return row.id;
}

async function systemExercise(tx: Tx, frames = 2): Promise<string> {
  const [row] = await tx
    .insert(exercise)
    .values({
      slug: `test-${randomUUID()}`,
      primaryMuscles: ['chest'],
      equipment: ['barbell'],
      trackingType: 'weight_reps',
      popularity: 50,
      media: {
        frames: Array.from({ length: frames }, (_, n) => ({
          thumb: `system/x/${n}-thumb.webp`,
          full: `system/x/${n}-full.webp`,
        })),
      },
    })
    .returning({ id: exercise.id });
  if (!row) throw new Error('No exercise');
  await tx.insert(exerciseTranslation).values({
    exerciseId: row.id,
    locale: 'en',
    name: 'Fixture System Press',
    searchName: normalizeSearch('Fixture System Press'),
  });
  return row.id;
}

async function jpeg(): Promise<Uint8Array> {
  return sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 136, g: 136, b: 136 } },
  })
    .jpeg()
    .toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createOwnExercise', () => {
  it('creates an own exercise that lists under Mine, in one locale shown everywhere (AC1, AC12)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();

      const created = await createOwnExercise(userId, 'uk', id, create({ name: 'Моя вправа' }), tx);

      expect(created).toMatchObject({ id, name: 'Моя вправа', isOwn: true, frames: [] });
      const translations = await tx
        .select()
        .from(exerciseTranslation)
        .where(eq(exerciseTranslation.exerciseId, id));
      expect(translations.map((t) => t.locale)).toEqual(['uk']);
      expect(await findExercise(userId, 'en', id, tx)).toMatchObject({ name: 'Моя вправа' });

      const mine = await listExercises(
        userId,
        'en',
        { muscle: [], equipment: [], limit: 50, mine: '1' },
        tx,
      );
      expect(mine.items).toEqual([expect.objectContaining({ id, isOwn: true, section: 'chest' })]);
    });
  });

  it('is idempotent for the same request (AC10)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      const input = create();

      const first = await createOwnExercise(userId, 'en', id, input, tx);
      const second = await createOwnExercise(userId, 'en', id, input, tx);

      expect(second).toEqual(first);
      const [count] = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from exercise where id = ${id}`,
      );
      expect(count?.n).toBe(1);
    });
  });

  it('rejects a taken own name in any case or accents, but allows system and deleted names (AC8)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      await createOwnExercise(userId, 'en', randomUUID(), create({ name: 'Élévation Press' }), tx);

      await expect(
        createOwnExercise(userId, 'en', randomUUID(), create({ name: 'elevation PRESS' }), tx),
      ).rejects.toMatchObject({ code: 'EXERCISE_NAME_TAKEN' });

      await systemExercise(tx);
      await expect(
        createOwnExercise(userId, 'en', randomUUID(), create({ name: 'Fixture System Press' }), tx),
      ).resolves.toMatchObject({ isOwn: true });

      const deletedId = randomUUID();
      await createOwnExercise(userId, 'en', deletedId, create({ name: 'Gone Press' }), tx);
      await deleteOwnExercise(userId, deletedId, tx);
      await expect(
        createOwnExercise(userId, 'en', randomUUID(), create({ name: 'Gone Press' }), tx),
      ).resolves.toMatchObject({ name: 'Gone Press' });
    });
  });

  it('stops at 300 own exercises (AC9)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      await tx.insert(exercise).values(
        Array.from({ length: 300 }, () => ({
          ownerId: userId,
          primaryMuscles: ['chest'],
          equipment: ['band'],
          trackingType: 'weight_reps',
        })),
      );

      await expect(
        createOwnExercise(userId, 'en', randomUUID(), create(), tx),
      ).rejects.toMatchObject({
        code: 'EXERCISE_LIMIT_REACHED',
      });
    });
  });

  it('duplicates a system exercise with its frames copied (AC7)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const sourceId = await systemExercise(tx);
      const id = randomUUID();

      const copy = await createOwnExercise(
        userId,
        'en',
        id,
        create({ sourceExerciseId: sourceId }),
        tx,
      );

      expect(copy).toMatchObject({ sourceExerciseId: sourceId, isOwn: true });
      expect(copy.frames).toHaveLength(2);
      expect(storage.copyObject).toHaveBeenCalledTimes(4);
      expect(vi.mocked(storage.copyObject).mock.calls[0]).toEqual([
        'exercise-media',
        'system/x/0-thumb.webp',
        'exercise-user-media',
        expect.stringMatching(new RegExp(`^users/${userId}/${id}/[0-9a-f-]+-thumb\\.webp$`)),
      ]);
      const [source] = await tx.select().from(exercise).where(eq(exercise.id, sourceId));
      expect(source?.ownerId).toBeNull();
    });
  });

  it('duplicates without photos when Storage is not configured', async () => {
    vi.mocked(storage.isStorageConfigured).mockReturnValue(false);
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const sourceId = await systemExercise(tx);

      const copy = await createOwnExercise(
        userId,
        'en',
        randomUUID(),
        create({ sourceExerciseId: sourceId }),
        tx,
      );

      expect(copy).toMatchObject({ sourceExerciseId: sourceId, frames: [] });
      expect(storage.copyObject).not.toHaveBeenCalled();
    });
    vi.mocked(storage.isStorageConfigured).mockReturnValue(true);
  });

  it('rejects an own or unknown exercise as the duplicate source', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const ownId = randomUUID();
      await createOwnExercise(userId, 'en', ownId, create(), tx);

      for (const sourceExerciseId of [ownId, randomUUID()]) {
        await expect(
          createOwnExercise(userId, 'en', randomUUID(), create({ sourceExerciseId }), tx),
        ).rejects.toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
      }
    });
  });
});

describe('updateOwnExercise', () => {
  it('changes only the given fields (AC3)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      const before = await createOwnExercise(
        userId,
        'en',
        id,
        create({ description: 'Keep me', instructions: ['One'], laterality: 'unilateral' }),
        tx,
      );

      const after = await updateOwnExercise(
        userId,
        'en',
        id,
        updateExerciseInputSchema.parse({ name: 'Renamed' }),
        tx,
      );

      expect(after).toEqual({ ...before, name: 'Renamed' });
    });
  });

  it('refuses system rows with 403 and foreign rows with 404 (AC2, AC3)', async () => {
    await withRollback(async (tx) => {
      const owner = await newUser(tx);
      const stranger = await newUser(tx);
      const ownId = randomUUID();
      await createOwnExercise(owner, 'en', ownId, create(), tx);
      const systemId = await systemExercise(tx);
      const patch = updateExerciseInputSchema.parse({ name: 'X' });

      await expect(updateOwnExercise(owner, 'en', systemId, patch, tx)).rejects.toMatchObject({
        code: 'EXERCISE_READ_ONLY',
      });
      await expect(deleteOwnExercise(owner, systemId, tx)).rejects.toMatchObject({
        code: 'EXERCISE_READ_ONLY',
      });
      await expect(updateOwnExercise(stranger, 'en', ownId, patch, tx)).rejects.toMatchObject({
        code: 'EXERCISE_NOT_FOUND',
      });
      await expect(createOwnExercise(stranger, 'en', ownId, create(), tx)).rejects.toMatchObject({
        code: 'EXERCISE_NOT_FOUND',
      });
      expect(
        (
          await listExercises(
            stranger,
            'en',
            { muscle: [], equipment: [], limit: 50, mine: '1' },
            tx,
          )
        ).items,
      ).toEqual([]);
    });
  });

  it('rejects renaming onto another own name (AC8)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      await createOwnExercise(userId, 'en', randomUUID(), create({ name: 'Alpha' }), tx);
      const id = randomUUID();
      await createOwnExercise(userId, 'en', id, create({ name: 'Beta' }), tx);

      await expect(
        updateOwnExercise(userId, 'en', id, updateExerciseInputSchema.parse({ name: 'ALPHA' }), tx),
      ).rejects.toMatchObject({ code: 'EXERCISE_NAME_TAKEN' });
    });
  });
});

describe('frames', () => {
  it('stores up to 4 frames, keeps an order, removes frames, and replays in place (AC4, AC5, AC10)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      await createOwnExercise(userId, 'en', id, create(), tx);
      const file = { bytes: await jpeg(), type: 'image/jpeg' };
      const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

      for (const frameId of ids) await putFrame(userId, 'en', id, frameId, file, tx);
      expect(storage.putObject).toHaveBeenCalledWith(
        'exercise-user-media',
        `users/${userId}/${id}/${ids[0]}-thumb.webp`,
        expect.any(Buffer),
        'image/webp',
      );
      await expect(putFrame(userId, 'en', id, randomUUID(), file, tx)).rejects.toMatchObject({
        code: 'FRAME_LIMIT_REACHED',
      });

      const replay = await putFrame(userId, 'en', id, ids[1] ?? '', file, tx);
      expect(replay.frames.map((frame) => frame.id)).toEqual(ids);
      expect(replay.frames[0]?.thumbUrl).toMatch(/^https:\/\/signed\.example\.com\/users\//);

      const reversed = [...ids].reverse();
      const reordered = await updateOwnExercise(
        userId,
        'en',
        id,
        updateExerciseInputSchema.parse({ frameOrder: reversed }),
        tx,
      );
      expect(reordered.frames.map((frame) => frame.id)).toEqual(reversed);
      await expect(
        updateOwnExercise(
          userId,
          'en',
          id,
          updateExerciseInputSchema.parse({ frameOrder: ids.slice(0, 2) }),
          tx,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

      const removed = await deleteFrame(userId, 'en', id, ids[0] ?? '', tx);
      expect(removed.frames.map((frame) => frame.id)).toEqual(reversed.filter((f) => f !== ids[0]));
      expect(storage.removeObjects).toHaveBeenLastCalledWith('exercise-user-media', [
        `users/${userId}/${id}/${ids[0]}-thumb.webp`,
        `users/${userId}/${id}/${ids[0]}-full.webp`,
      ]);
      await expect(deleteFrame(userId, 'en', id, randomUUID(), tx)).rejects.toMatchObject({
        code: 'FRAME_NOT_FOUND',
      });
    });
  });

  it('rejects bytes that are not an image (AC4)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      await createOwnExercise(userId, 'en', id, create(), tx);

      await expect(
        putFrame(
          userId,
          'en',
          id,
          randomUUID(),
          { bytes: new Uint8Array([1, 2]), type: 'image/png' },
          tx,
        ),
      ).rejects.toMatchObject({ code: 'IMAGE_INVALID' });
    });
  });
});

describe('deleteOwnExercise', () => {
  it('soft deletes, hides the exercise and removes its files (AC6)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const id = randomUUID();
      await createOwnExercise(userId, 'en', id, create(), tx);
      const frameId = randomUUID();
      await putFrame(userId, 'en', id, frameId, { bytes: await jpeg(), type: 'image/jpeg' }, tx);

      await deleteOwnExercise(userId, id, tx);

      const [row] = await tx.select().from(exercise).where(eq(exercise.id, id));
      expect(row?.deletedAt).toBeInstanceOf(Date);
      expect(await findExercise(userId, 'en', id, tx)).toBeNull();
      expect(
        (await listExercises(userId, 'en', { muscle: [], equipment: [], limit: 50, mine: '1' }, tx))
          .items,
      ).toEqual([]);
      expect(storage.removeObjects).toHaveBeenLastCalledWith('exercise-user-media', [
        `users/${userId}/${id}/${frameId}-thumb.webp`,
        `users/${userId}/${id}/${frameId}-full.webp`,
      ]);
    });
  });
});

describe('gym equipment of own exercises', () => {
  it('stores ticked items, keeps them on an unrelated PATCH, and the gym filter respects them (AC11)', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      await tx.insert(gymProfile).values({ userId, equipment: ['dumbbells'] });
      const id = randomUUID();
      const created = await createOwnExercise(
        userId,
        'en',
        id,
        create({ gymEquipment: [['barbell']] }),
        tx,
      );
      expect(created.gymEquipment).toEqual([['barbell']]);

      const renamed = await updateOwnExercise(
        userId,
        'en',
        id,
        updateExerciseInputSchema.parse({ name: `Renamed ${randomUUID().slice(0, 6)}` }),
        tx,
      );
      expect(renamed.gymEquipment).toEqual([['barbell']]);

      const free = randomUUID();
      await createOwnExercise(userId, 'en', free, create(), tx);

      const mine = await listExercises(
        userId,
        'en',
        listExercisesQuerySchema.parse({ mine: '1', gym: '1' }),
        tx,
      );
      expect(mine.items.map((item) => item.id)).toEqual([free]);

      const cleared = await updateOwnExercise(
        userId,
        'en',
        id,
        updateExerciseInputSchema.parse({ gymEquipment: [] }),
        tx,
      );
      expect(cleared.gymEquipment).toEqual([]);
    });
  });

  it('keeps the alternatives a duplicate sends', async () => {
    await withRollback(async (tx) => {
      const userId = await newUser(tx);
      const source = await systemExercise(tx, 0);
      const created = await createOwnExercise(
        userId,
        'en',
        randomUUID(),
        create({ sourceExerciseId: source, gymEquipment: [['dumbbells', 'kettlebells']] }),
        tx,
      );
      expect(created.gymEquipment).toEqual([['dumbbells', 'kettlebells']]);
    });
  });
});
