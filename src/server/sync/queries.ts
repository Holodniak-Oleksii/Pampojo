import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import type { SyncMutationType } from '@/constants/sync';
import type { Db } from '@/server/db/client';
import { syncMutation } from '@/server/db/schema';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export async function findAppliedIds(
  db: Executor,
  userId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: syncMutation.id })
    .from(syncMutation)
    .where(and(eq(syncMutation.userId, userId), inArray(syncMutation.id, [...ids])));
  return new Set(rows.map((row) => row.id));
}

export async function insertApplied(
  db: Executor,
  row: { id: string; userId: string; type: SyncMutationType },
): Promise<void> {
  await db.insert(syncMutation).values(row);
}
