import 'server-only';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '@/server/db/client';
import { bodyMeasurement } from '@/server/db/schema';
import { touch } from '@/server/db/utils';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;
export type MeasurementRow = typeof bodyMeasurement.$inferSelect;

export async function listLive(db: Executor, userId: string): Promise<MeasurementRow[]> {
  return db
    .select()
    .from(bodyMeasurement)
    .where(and(eq(bodyMeasurement.userId, userId), isNull(bodyMeasurement.deletedAt)))
    .orderBy(desc(bodyMeasurement.measuredOn), desc(bodyMeasurement.createdAt));
}

/** Locks the row by id; the caller checks that it belongs to the user. */
export async function lockById(tx: Tx, id: string): Promise<MeasurementRow | undefined> {
  const [row] = await tx
    .select()
    .from(bodyMeasurement)
    .where(eq(bodyMeasurement.id, id))
    .for('update')
    .limit(1);
  return row;
}

/**
 * Inserts the measurement, or updates the live row that already holds that user, type and day.
 * The returned row can have another id than `values.id`.
 */
export async function upsertDay(
  db: Executor,
  userId: string,
  values: { id: string; type: string; value: number; measuredOn: string },
): Promise<{ row: MeasurementRow; inserted: boolean }> {
  const [row] = await db
    .insert(bodyMeasurement)
    .values({ ...values, userId })
    .onConflictDoUpdate({
      target: [bodyMeasurement.userId, bodyMeasurement.type, bodyMeasurement.measuredOn],
      targetWhere: sql`${bodyMeasurement.deletedAt} is null`,
      set: { value: values.value, ...touch() },
    })
    .returning();
  if (!row) throw new Error('Upsert returned no row');
  return { row, inserted: row.id === values.id };
}

export async function softDeleteOtherOnDay(
  tx: Tx,
  userId: string,
  type: string,
  measuredOn: string,
  exceptId: string,
) {
  await tx
    .update(bodyMeasurement)
    .set({ deletedAt: new Date(), ...touch() })
    .where(
      and(
        eq(bodyMeasurement.userId, userId),
        eq(bodyMeasurement.type, type),
        eq(bodyMeasurement.measuredOn, measuredOn),
        isNull(bodyMeasurement.deletedAt),
        ne(bodyMeasurement.id, exceptId),
      ),
    );
}

export async function updateValueAndDate(
  tx: Tx,
  userId: string,
  id: string,
  value: number,
  measuredOn: string,
): Promise<MeasurementRow> {
  const [row] = await tx
    .update(bodyMeasurement)
    .set({ value, measuredOn, ...touch() })
    .where(and(eq(bodyMeasurement.id, id), eq(bodyMeasurement.userId, userId)))
    .returning();
  if (!row) throw new Error('Update returned no row');
  return row;
}

export async function softDelete(tx: Tx, userId: string, id: string) {
  await tx
    .update(bodyMeasurement)
    .set({ deletedAt: new Date(), ...touch() })
    .where(and(eq(bodyMeasurement.id, id), eq(bodyMeasurement.userId, userId)));
}
