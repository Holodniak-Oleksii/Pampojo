import 'server-only';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/server/db/client';
import { gymProfile } from '@/server/db/schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export type GymRow = typeof gymProfile.$inferSelect;

export async function findGymRow(db: Executor, userId: string): Promise<GymRow | undefined> {
  const [row] = await db.select().from(gymProfile).where(eq(gymProfile.userId, userId)).limit(1);
  return row;
}

/** One statement, so a repeat or a concurrent save never needs a read first. */
export async function upsertGymRow(
  db: Executor,
  userId: string,
  equipment: string[],
): Promise<GymRow> {
  const [row] = await db
    .insert(gymProfile)
    .values({ userId, equipment })
    .onConflictDoUpdate({
      target: gymProfile.userId,
      set: { equipment, updatedAt: sql`now()` },
    })
    .returning();
  if (!row) throw new Error('Gym upsert returned no row');
  return row;
}
