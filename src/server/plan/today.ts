import 'server-only';
import { todayIn } from '@/lib/dates';
import { findProfileRow } from '@/server/profile/queries';
import { DomainError } from '@/server/http/errors';
import type { Executor } from './queries';

/** The calendar date of `at` in the user's profile time zone. */
export async function userToday(
  db: Executor,
  userId: string,
  at: Date = new Date(),
): Promise<string> {
  const row = await findProfileRow(db, userId);
  if (!row) throw new DomainError('PROFILE_NOT_FOUND', 'Profile not found');
  return todayIn(row.timeZone, at);
}
