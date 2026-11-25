import 'server-only';
import { SESSION_STATUS } from '@/constants/session';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import { listRuleRows } from '@/server/plan/queries';
import { findProfileRow } from '@/server/profile/queries';
import type { Executor } from '@/server/sessions/queries';
import { computeCalendar, instantRange, type StatusRule } from '@/shared/plan/statuses';
import type { CalendarQuery, CalendarResponse } from '@/shared/schemas/calendar';
import { listCalendarSessionRows } from './queries';

/** Occurrences with statuses and the completed sessions of each date. Three queries for any range. */
export async function getCalendar(
  userId: string,
  { from, to }: CalendarQuery,
  db: Executor = getDb(),
): Promise<CalendarResponse> {
  const profile = await findProfileRow(db, userId);
  if (!profile) throw new DomainError('PROFILE_NOT_FOUND', 'Profile not found');
  const today = todayIn(profile.timeZone);
  const rules: StatusRule[] = (await listRuleRows(db, userId)).map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    workoutName: row.workout_name,
    startDate: row.start_date,
    endDate: row.end_date,
    weekdays: row.weekdays,
    intervalWeeks: row.interval_weeks,
    workoutDeleted: row.workout_deleted,
  }));
  const rows = await listCalendarSessionRows(db, userId, { ...instantRange(from, to), from, to });
  const sessions = rows.map((row) => ({
    id: row.id,
    workoutId: row.workoutId,
    workoutName: row.workoutSnapshot.name,
    scheduledFor: row.scheduledFor,
    status: SESSION_STATUS.COMPLETED,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    setCount: row.setCount,
  }));
  return {
    today,
    days: computeCalendar({ rules, sessions, from, to, today, timeZone: profile.timeZone }),
  };
}
