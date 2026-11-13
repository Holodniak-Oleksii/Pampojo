import 'server-only';
import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import type { Gym } from '@/shared/schemas/gym';
import { GYM_ERROR } from './errors';
import { findGymRow, upsertGymRow, type Executor, type GymRow } from './queries';

// The check constraint guarantees known keys; the filter only narrows the column type.
function toGym(row: GymRow): Gym {
  return {
    equipment: GYM_EQUIPMENT_KEYS.filter((key: GymEquipment) => row.equipment.includes(key)),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findGym(userId: string, db: Executor = getDb()): Promise<Gym | null> {
  const row = await findGymRow(db, userId);
  return row ? toGym(row) : null;
}

export async function getGym(userId: string, db: Executor = getDb()): Promise<Gym> {
  const gym = await findGym(userId, db);
  if (!gym) throw new DomainError(GYM_ERROR.NOT_FOUND, 'Gym profile not found');
  return gym;
}

/** `equipment` is already unique and in display order (putGymInputSchema). */
export async function saveGym(
  userId: string,
  equipment: GymEquipment[],
  db: Executor = getDb(),
): Promise<Gym> {
  return toGym(await upsertGymRow(db, userId, equipment));
}
