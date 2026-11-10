import 'server-only';
import { z } from 'zod';
import {
  DIFFICULTIES,
  EQUIPMENT_LIST,
  LATERALITY,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUPS,
  TRACKING_TYPE,
  type Difficulty,
  type Equipment,
  type Laterality,
  type Mechanic,
  type MovementPattern,
  type MuscleGroup,
  type TrackingType,
} from '@/constants/exercise';
import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/search';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import type {
  Exercise,
  ExerciseListItem,
  ExerciseListResponse,
  ListExercisesQuery,
} from '@/shared/schemas/exercise';
import { EXERCISE_ERROR } from './errors';
import { firstFrame, toFrames } from './media';
import { findExerciseRow, listExerciseRows, type Executor } from './queries';

const cursorSchema = z.object({ o: z.number().int().min(0).max(100_000) }).strict();

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))).o;
  } catch {
    // Same envelope as a Zod failure, so clients handle it like any invalid query param.
    throw new DomainError('VALIDATION_FAILED', 'Validation failed', [
      { code: 'custom', path: ['cursor'], message: 'Invalid cursor' },
    ]);
  }
}

function isOneOf<T extends string | number>(values: readonly T[], value: unknown): value is T {
  return values.some((allowed) => allowed === value);
}

// Check constraints guarantee these values; the guards only narrow the column types.
function only<T extends string>(values: readonly T[], items: readonly string[]): T[] {
  return items.filter((item): item is T => isOneOf(values, item));
}

function orNull<T extends string | number>(values: readonly T[], value: unknown): T | null {
  return isOneOf(values, value) ? value : null;
}

export async function listExercises(
  userId: string,
  locale: Locale,
  query: ListExercisesQuery,
  db: Executor = getDb(),
): Promise<ExerciseListResponse> {
  const offset = decodeCursor(query.cursor);
  const q = query.q ? normalizeSearch(query.q) : '';
  const rows = await listExerciseRows(db, {
    userId,
    locale,
    q: q === '' ? null : q,
    muscles: query.muscle,
    equipment: query.equipment,
    pattern: query.pattern ?? null,
    offset,
    limit: query.limit,
  });

  const items: ExerciseListItem[] = rows.slice(0, query.limit).map((row) => ({
    id: row.id,
    name: row.name,
    primaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, row.primary_muscles),
    equipment: only<Equipment>(EQUIPMENT_LIST, row.equipment),
    ...firstFrame(row.media),
    frames: toFrames(row.media),
    section: orNull<MuscleGroup>(MUSCLE_GROUPS, row.section),
    isOwn: row.owner_id === userId,
  }));
  return {
    items,
    nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
  };
}

export async function findExercise(
  userId: string,
  locale: Locale,
  id: string,
  db: Executor = getDb(),
): Promise<Exercise | null> {
  const row = await findExerciseRow(db, { userId, locale, id });
  if (!row) return null;
  const trackingType = orNull<TrackingType>(Object.values(TRACKING_TYPE), row.tracking_type);
  if (!trackingType) throw new Error('Exercise row has an unexpected tracking type');
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    description: row.description,
    instructions: row.instructions,
    commonMistakes: row.common_mistakes,
    primaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, row.primary_muscles),
    secondaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, row.secondary_muscles),
    equipment: only<Equipment>(EQUIPMENT_LIST, row.equipment),
    movementPattern: orNull<MovementPattern>(Object.values(MOVEMENT_PATTERN), row.movement_pattern),
    mechanic: orNull<Mechanic>(Object.values(MECHANIC), row.mechanic),
    laterality: orNull<Laterality>(Object.values(LATERALITY), row.laterality),
    trackingType,
    difficulty: orNull<Difficulty>(DIFFICULTIES, row.difficulty),
    frames: toFrames(row.media),
    isOwn: row.owner_id === userId,
  };
}

export async function getExercise(userId: string, locale: Locale, id: string): Promise<Exercise> {
  const exercise = await findExercise(userId, locale, id);
  if (!exercise) throw new DomainError(EXERCISE_ERROR.NOT_FOUND, 'Exercise not found');
  return exercise;
}
