import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import type { Measurement, PutMeasurementInput } from '@/shared/schemas/measurement';
import type { LocalMeasurement, PampojoDb } from './db';
import { enqueue, notifyOutbox } from './outbox';

export async function listLocalMeasurements(db: PampojoDb): Promise<Measurement[]> {
  return db.measurements.toArray();
}

/**
 * Measurement writes for the device. They follow the server rule of one live row per type and
 * day, so the device and the server agree on which row a save changes.
 */
export function createMeasurementRepository(db: PampojoDb) {
  async function write<T>(fn: () => Promise<T>): Promise<T> {
    const result = await db.transaction('rw', [db.measurements, db.outbox], fn);
    notifyOutbox();
    return result;
  }

  const sameDay = (type: string, measuredOn: string) =>
    db.measurements.where('[type+measuredOn]').equals([type, measuredOn]).toArray();

  async function put(row: LocalMeasurement): Promise<void> {
    await db.measurements.put(row);
    await enqueue(db, {
      type: SYNC_MUTATION_TYPE.MEASUREMENT_PUT,
      entityId: row.id,
      payload: { type: row.type, value: row.value, measuredOn: row.measuredOn },
    });
  }

  return {
    /** A save on a day that already has a row of the type updates that row and keeps its id. */
    save(input: PutMeasurementInput): Promise<LocalMeasurement> {
      return write(async () => {
        const [existing] = await sameDay(input.type, input.measuredOn);
        const row: LocalMeasurement = {
          id: existing?.id ?? crypto.randomUUID(),
          ...input,
          updatedAt: new Date().toISOString(),
        };
        await put(row);
        return row;
      });
    },

    /** Moving a row onto a day with another row of the type replaces that row, as the server does. */
    update(id: string, input: PutMeasurementInput): Promise<void> {
      return write(async () => {
        for (const other of await sameDay(input.type, input.measuredOn)) {
          if (other.id !== id) await db.measurements.delete(other.id);
        }
        await put({ id, ...input, updatedAt: new Date().toISOString() });
      });
    },

    remove(id: string): Promise<void> {
      return write(async () => {
        await db.measurements.delete(id);
        await enqueue(db, { type: SYNC_MUTATION_TYPE.MEASUREMENT_DELETE, entityId: id });
      });
    },
  };
}

export type MeasurementRepository = ReturnType<typeof createMeasurementRepository>;
