import { SESSION_STATUS } from '@/constants/session';
import { localSessionSchema, type LocalSession, type PampojoDb } from './db';

/** Local sessions linked to a planned date, abandoned ones excluded. */
export async function findScheduledSessions(db: PampojoDb, date: string): Promise<LocalSession[]> {
  const rows = await db.sessions.toArray();
  return rows.flatMap((row) => {
    const parsed = localSessionSchema.safeParse(row);
    if (!parsed.success) return [];
    const session = parsed.data;
    return session.scheduledFor === date && session.status !== SESSION_STATUS.ABANDONED
      ? [session]
      : [];
  });
}
