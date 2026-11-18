import 'server-only';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import { userToday } from '@/server/plan/today';
import {
  MEASUREMENT_FIELD_ERROR,
  type Measurement,
  type MeasurementListResponse,
  type PutMeasurementInput,
} from '@/shared/schemas/measurement';
import { MEASUREMENT_ERROR } from './errors';
import {
  listLive,
  lockById,
  softDelete,
  softDeleteOtherOnDay,
  updateValueAndDate,
  upsertDay,
  type Executor,
  type MeasurementRow,
} from './queries';

function notFound(): DomainError {
  return new DomainError(MEASUREMENT_ERROR.NOT_FOUND, 'Measurement not found');
}

function invalid(path: string, message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 'Validation failed', [{ path: [path], message }]);
}

function toMeasurement(row: MeasurementRow): Measurement {
  return {
    id: row.id,
    type: row.type as Measurement['type'],
    value: row.value,
    measuredOn: row.measuredOn,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMeasurements(
  userId: string,
  db: Executor = getDb(),
): Promise<MeasurementListResponse> {
  return { items: (await listLive(db, userId)).map(toMeasurement) };
}

/**
 * Creates or edits a measurement with a client id. A create on a day that already has a live row
 * of the type updates that row; an edit onto such a day replaces the other row.
 */
export async function putMeasurement(
  userId: string,
  id: string,
  input: PutMeasurementInput,
  db: Executor = getDb(),
): Promise<{ item: Measurement; created: boolean }> {
  try {
    return await putOnce(userId, id, input, db);
  } catch (error) {
    // A parallel save of the same day can win the unique index between our read and write; the
    // second attempt then sees that row and updates it.
    if (!isUniqueViolation(error)) throw error;
    return putOnce(userId, id, input, db);
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
  return code(error) === '23505' || code((error as { cause?: unknown })?.cause) === '23505';
}

async function putOnce(
  userId: string,
  id: string,
  input: PutMeasurementInput,
  db: Executor,
): Promise<{ item: Measurement; created: boolean }> {
  return db.transaction(async (tx) => {
    const existing = await lockById(tx, id);
    if (existing && (existing.userId !== userId || existing.deletedAt)) throw notFound();
    if (input.measuredOn > (await userToday(tx, userId))) {
      throw invalid('measuredOn', MEASUREMENT_FIELD_ERROR.FUTURE);
    }
    if (existing) {
      if (existing.type !== input.type) throw invalid('type', 'The type cannot change');
      await softDeleteOtherOnDay(tx, userId, input.type, input.measuredOn, id);
      const row = await updateValueAndDate(tx, userId, id, input.value, input.measuredOn);
      return { item: toMeasurement(row), created: false };
    }
    const { row, inserted } = await upsertDay(tx, userId, { id, ...input });
    return { item: toMeasurement(row), created: inserted };
  });
}

/** Soft deletes an own measurement. A repeat on an own deleted row is a no-op. */
export async function deleteMeasurement(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockById(tx, id);
    if (!row || row.userId !== userId) throw notFound();
    if (row.deletedAt) return;
    await softDelete(tx, userId, id);
  });
}
