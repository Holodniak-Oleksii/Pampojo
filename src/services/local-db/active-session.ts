import { SESSION_STATUS } from '@/constants/session';
import { EMPTY_SYNC_META, type LocalSession, type PampojoDb } from './db';

async function activeId(db: PampojoDb): Promise<string | null> {
  const row = await db.meta.get('sync');
  return row?.key === 'sync' ? (row.value.activeSessionId ?? null) : null;
}

/** See `useLocalInProgress`: the session this device shows as active, if any. */
export async function findActiveSession(db: PampojoDb): Promise<LocalSession | undefined> {
  const rows = (
    await db.sessions.where('status').equals(SESSION_STATUS.IN_PROGRESS).toArray()
  ).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const id = await activeId(db);
  return (
    rows.find((row) => row.id === id) ?? rows.find((row) => row.deviceOwned !== false) ?? rows[0]
  );
}

/** Marks a session as the active one of this device. Call inside a transaction over sessions and meta. */
export async function setActiveSession(db: PampojoDb, sessionId: string | null): Promise<void> {
  const row = await db.meta.get('sync');
  const meta = row?.key === 'sync' ? { ...EMPTY_SYNC_META, ...row.value } : EMPTY_SYNC_META;
  if (sessionId === null && meta.activeSessionId === null) return;
  await db.meta.put({ key: 'sync', value: { ...meta, activeSessionId: sessionId } });
  if (sessionId) await db.sessions.update(sessionId, { deviceOwned: true });
}

/** Clears the active session when it is the one that ended. */
export async function clearActiveSession(db: PampojoDb, sessionId: string): Promise<void> {
  if ((await activeId(db)) === sessionId) await setActiveSession(db, null);
}
