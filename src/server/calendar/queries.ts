import 'server-only';
import { and, between, eq, gte, lt, or } from 'drizzle-orm';
import { SESSION_STATUS } from '@/constants/session';
import { workoutSession } from '@/server/db/schema';
import { setCountColumn, type Executor, type SessionListRow } from '@/server/sessions/queries';

/**
 * Completed sessions that started in the instant range or are linked to a date in `[from, to]`.
 * The instant range is wider than any time zone, so the caller filters by the profile date.
 */
export async function listCalendarSessionRows(
  db: Executor,
  userId: string,
  range: { fromInstant: Date; toInstant: Date; from: string; to: string },
): Promise<SessionListRow[]> {
  const rows = await db
    .select({ row: workoutSession, setCount: setCountColumn })
    .from(workoutSession)
    .where(
      and(
        eq(workoutSession.userId, userId),
        eq(workoutSession.status, SESSION_STATUS.COMPLETED),
        or(
          and(
            gte(workoutSession.startedAt, range.fromInstant),
            lt(workoutSession.startedAt, range.toInstant),
          ),
          between(workoutSession.scheduledFor, range.from, range.to),
        ),
      ),
    );
  return rows.map(({ row, setCount }) => ({ ...row, setCount: Number(setCount) }));
}
