import { SESSION_STATUS } from '@/constants/session';
import { instantRange, type StatusSession } from '@/shared/plan/statuses';
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

/**
 * Completed local sessions that started around `[from, to]` or are linked to a date in it, with
 * their live set count. The caller keeps those whose start date in the profile zone fits.
 */
export async function findCompletedSessionsBetween(
  db: PampojoDb,
  from: string,
  to: string,
): Promise<StatusSession[]> {
  const { fromInstant, toInstant } = instantRange(from, to);
  const low = fromInstant.toISOString();
  const high = toInstant.toISOString();
  const rows = await db.sessions.where('status').equals(SESSION_STATUS.COMPLETED).toArray();
  const sessions = rows.flatMap((row) => {
    const parsed = localSessionSchema.safeParse(row);
    if (!parsed.success) return [];
    const session = parsed.data;
    const started = session.startedAt >= low && session.startedAt < high;
    const linked =
      session.scheduledFor !== null && session.scheduledFor >= from && session.scheduledFor <= to;
    return started || linked ? [session] : [];
  });
  if (sessions.length === 0) return [];
  const logs = await db.setLogs
    .where('sessionId')
    .anyOf(sessions.map((session) => session.id))
    .toArray();
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.deletedAt === null) counts.set(log.sessionId, (counts.get(log.sessionId) ?? 0) + 1);
  }
  return sessions.map((session) => ({
    id: session.id,
    workoutId: session.workoutId,
    workoutName: session.workoutSnapshot.name,
    scheduledFor: session.scheduledFor,
    status: session.status,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    setCount: counts.get(session.id) ?? 0,
  }));
}
