import 'server-only';
import { removeExerciseFromWorkouts } from '@/server/workouts/queries';
import { randomUUID } from 'node:crypto';
import {
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_USER_MEDIA_BUCKET,
  FRAME_LIMIT,
  OWN_EXERCISE_LIMIT,
} from '@/constants/exercise';
import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/search';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import {
  copyObject,
  ensureBucket,
  isStorageConfigured,
  putObject,
  removeObjects,
  toWebpFrames,
} from '@/server/storage';
import type {
  Exercise,
  ExerciseMedia,
  ParsedCreateExerciseInput,
  ParsedUpdateExerciseInput,
} from '@/shared/schemas/exercise';
import { EXERCISE_ERROR } from './errors';
import { ownFrameKeys } from './media';
import {
  countOwnExercises,
  findSystemExerciseMedia,
  insertOwnExercise,
  insertTranslation,
  lockExerciseRow,
  lockOwner,
  ownNameTaken,
  updateExerciseColumns,
  updateOwnTranslation,
  type Executor,
  type LockedExercise,
  type Tx,
} from './queries';
import { getExercise } from './service';

type Fields = Partial<Omit<ParsedCreateExerciseInput, 'sourceExerciseId'>>;

/** A system row is read-only (403); a missing, deleted or foreign row is not found (404). */
function assertOwn(row: LockedExercise | undefined, userId: string): LockedExercise {
  if (!row || row.deleted_at) throw new DomainError(EXERCISE_ERROR.NOT_FOUND, 'Exercise not found');
  if (row.owner_id === null) {
    throw new DomainError(EXERCISE_ERROR.READ_ONLY, 'System exercises cannot be changed');
  }
  if (row.owner_id !== userId)
    throw new DomainError(EXERCISE_ERROR.NOT_FOUND, 'Exercise not found');
  return row;
}

function frameKeys(media: ExerciseMedia): string[] {
  return media.frames.flatMap((frame) => [frame.thumb, frame.full]);
}

/** Storage cleanup after a commit: a failure leaves orphan files, never a failed request. */
async function removeQuietly(keys: string[]): Promise<void> {
  try {
    await removeObjects(EXERCISE_USER_MEDIA_BUCKET, keys);
  } catch (error) {
    console.error('[storage] cleanup failed', error);
  }
}

/** Writes only the given fields; a new name must be free among the user's own exercises. */
async function writeFields(
  tx: Tx,
  userId: string,
  row: LockedExercise,
  fields: Fields,
): Promise<void> {
  if (fields.name !== undefined) {
    const searchName = normalizeSearch(fields.name);
    if (await ownNameTaken(tx, userId, searchName, row.id)) {
      throw new DomainError(EXERCISE_ERROR.NAME_TAKEN, 'Name already used');
    }
    await updateOwnTranslation(tx, row.id, { name: fields.name, searchName });
  }
  const primary = fields.primaryMuscles ?? row.primary_muscles;
  const columns = {
    primaryMuscles: fields.primaryMuscles,
    secondaryMuscles: fields.secondaryMuscles?.filter((muscle) => !primary.includes(muscle)),
    equipment: fields.equipment,
    trackingType: fields.trackingType,
    movementPattern: fields.movementPattern,
    mechanic: fields.mechanic,
    laterality: fields.laterality,
    gymEquipment: fields.gymEquipment,
  };
  const presentColumns = Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(presentColumns).length > 0) {
    await updateExerciseColumns(tx, row.id, presentColumns);
  }
  const text = {
    description: fields.description,
    instructions: fields.instructions,
    commonMistakes: fields.commonMistakes,
  };
  const presentText = Object.fromEntries(
    Object.entries(text).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(presentText).length > 0) await updateOwnTranslation(tx, row.id, presentText);
}

/**
 * Idempotent create with a client id: a replay of the same request updates the row to the same
 * values and returns it, so retries never create a second exercise.
 */
export async function createOwnExercise(
  userId: string,
  locale: Locale,
  id: string,
  input: ParsedCreateExerciseInput,
  db: Executor = getDb(),
): Promise<Exercise> {
  const copied: string[] = [];
  try {
    await db.transaction(async (tx) => {
      await lockOwner(tx, userId);
      const existing = await lockExerciseRow(tx, id);
      if (existing) {
        await writeFields(tx, userId, assertOwn(existing, userId), input);
        return;
      }
      if ((await countOwnExercises(tx, userId)) >= OWN_EXERCISE_LIMIT) {
        throw new DomainError(EXERCISE_ERROR.LIMIT_REACHED, 'Own exercise limit reached');
      }
      const searchName = normalizeSearch(input.name);
      if (await ownNameTaken(tx, userId, searchName, id)) {
        throw new DomainError(EXERCISE_ERROR.NAME_TAKEN, 'Name already used');
      }

      const media: ExerciseMedia = { frames: [] };
      const copies: {
        from: { thumb: string; full: string };
        to: { thumb: string; full: string };
      }[] = [];
      if (input.sourceExerciseId) {
        const source = await findSystemExerciseMedia(tx, input.sourceExerciseId);
        if (!source) throw new DomainError(EXERCISE_ERROR.NOT_FOUND, 'Source exercise not found');
        // Without Storage the text is still copied; the duplicate just starts without photos.
        const frames = isStorageConfigured() ? source.frames.slice(0, FRAME_LIMIT) : [];
        for (const frame of frames) {
          const frameId = randomUUID();
          const keys = ownFrameKeys(userId, id, frameId);
          media.frames.push({ id: frameId, ...keys });
          copies.push({ from: frame, to: keys });
        }
      }

      await insertOwnExercise(tx, {
        id,
        ownerId: userId,
        primaryMuscles: input.primaryMuscles,
        secondaryMuscles: input.secondaryMuscles,
        equipment: input.equipment,
        trackingType: input.trackingType,
        movementPattern: input.movementPattern,
        mechanic: input.mechanic,
        laterality: input.laterality,
        gymEquipment: input.gymEquipment,
        media,
        sourceExerciseId: input.sourceExerciseId,
      });
      await insertTranslation(tx, {
        exerciseId: id,
        locale,
        name: input.name,
        description: input.description,
        instructions: input.instructions,
        commonMistakes: input.commonMistakes,
        searchName,
        searchAliases: '',
      });

      // Copies run before commit, so a failed copy rolls the new row back.
      if (copies.length > 0) await ensureBucket(EXERCISE_USER_MEDIA_BUCKET, false);
      for (const { from, to } of copies) {
        await copyObject(EXERCISE_MEDIA_BUCKET, from.thumb, EXERCISE_USER_MEDIA_BUCKET, to.thumb);
        copied.push(to.thumb);
        await copyObject(EXERCISE_MEDIA_BUCKET, from.full, EXERCISE_USER_MEDIA_BUCKET, to.full);
        copied.push(to.full);
      }
    });
  } catch (error) {
    if (copied.length > 0) await removeQuietly(copied);
    throw error;
  }
  return getExercise(userId, locale, id, db);
}

export async function updateOwnExercise(
  userId: string,
  locale: Locale,
  id: string,
  input: ParsedUpdateExerciseInput,
  db: Executor = getDb(),
): Promise<Exercise> {
  await db.transaction(async (tx) => {
    await lockOwner(tx, userId);
    const row = assertOwn(await lockExerciseRow(tx, id), userId);
    const { frameOrder, ...fields } = input;
    await writeFields(tx, userId, row, fields);
    if (frameOrder) {
      const current = row.media.frames.map((frame) => frame.id);
      const valid =
        frameOrder.length === current.length &&
        frameOrder.every((frameId) => current.includes(frameId));
      if (!valid) {
        throw new DomainError('VALIDATION_FAILED', 'Validation failed', [
          { code: 'custom', path: ['frameOrder'], message: 'Must list every current frame once' },
        ]);
      }
      const byId = new Map(row.media.frames.map((frame) => [frame.id, frame]));
      const frames = frameOrder.flatMap((frameId) => {
        const frame = byId.get(frameId);
        return frame ? [frame] : [];
      });
      await updateExerciseColumns(tx, id, { media: { frames } });
    }
  });
  return getExercise(userId, locale, id, db);
}

export async function deleteOwnExercise(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<void> {
  let keys: string[] = [];
  await db.transaction(async (tx) => {
    const row = assertOwn(await lockExerciseRow(tx, id), userId);
    keys = frameKeys(row.media);
    await updateExerciseColumns(tx, id, { deletedAt: new Date() });
    await removeExerciseFromWorkouts(tx, userId, id);
  });
  await removeQuietly(keys);
}

export async function putFrame(
  userId: string,
  locale: Locale,
  id: string,
  frameId: string,
  file: { bytes: Uint8Array; type: string },
  db: Executor = getDb(),
): Promise<Exercise> {
  await db.transaction(async (tx) => {
    const row = assertOwn(await lockExerciseRow(tx, id), userId);
    const exists = row.media.frames.some((frame) => frame.id === frameId);
    if (!exists && row.media.frames.length >= FRAME_LIMIT) {
      throw new DomainError(EXERCISE_ERROR.FRAME_LIMIT_REACHED, 'Frame limit reached');
    }
    const webp = await toWebpFrames(file.bytes, file.type);
    const keys = ownFrameKeys(userId, id, frameId);
    await ensureBucket(EXERCISE_USER_MEDIA_BUCKET, false);
    await putObject(EXERCISE_USER_MEDIA_BUCKET, keys.thumb, webp.thumb, 'image/webp');
    await putObject(EXERCISE_USER_MEDIA_BUCKET, keys.full, webp.full, 'image/webp');
    // A replay overwrites the files in place and keeps the frame's position.
    const frames = exists
      ? row.media.frames.map((frame) => (frame.id === frameId ? { id: frameId, ...keys } : frame))
      : [...row.media.frames, { id: frameId, ...keys }];
    await updateExerciseColumns(tx, id, { media: { frames } });
  });
  return getExercise(userId, locale, id, db);
}

export async function deleteFrame(
  userId: string,
  locale: Locale,
  id: string,
  frameId: string,
  db: Executor = getDb(),
): Promise<Exercise> {
  let keys: string[] = [];
  await db.transaction(async (tx) => {
    const row = assertOwn(await lockExerciseRow(tx, id), userId);
    const frame = row.media.frames.find((item) => item.id === frameId);
    if (!frame) throw new DomainError(EXERCISE_ERROR.FRAME_NOT_FOUND, 'Frame not found');
    keys = [frame.thumb, frame.full];
    await updateExerciseColumns(tx, id, {
      media: { frames: row.media.frames.filter((item) => item.id !== frameId) },
    });
  });
  await removeQuietly(keys);
  return getExercise(userId, locale, id, db);
}
