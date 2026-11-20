import { EMPTY_SYNC_META, type PampojoDb, type SyncMeta } from '@/services/local-db/db';

export async function readSyncMeta(db: PampojoDb): Promise<SyncMeta> {
  const row = await db.meta.get('sync');
  return row?.key === 'sync' ? { ...EMPTY_SYNC_META, ...row.value } : EMPTY_SYNC_META;
}

/** Call inside a transaction that includes `db.meta` when the change must commit with other rows. */
export async function updateSyncMeta(db: PampojoDb, change: Partial<SyncMeta>): Promise<SyncMeta> {
  const next = { ...(await readSyncMeta(db)), ...change };
  await db.meta.put({ key: 'sync', value: next });
  return next;
}
