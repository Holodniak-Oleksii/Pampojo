import { SYNC_SESSION_WINDOW_DAYS } from '@/constants/sync';
import { addDays } from '@/shared/plan/occurrences';
import { instantRange } from '@/shared/plan/statuses';

/**
 * The earliest start instant of a session that the device keeps. It covers every time zone, so
 * the server and the device agree on the edge without the profile zone.
 */
export function sessionWindowStart(today: string): Date {
  return instantRange(addDays(today, -SYNC_SESSION_WINDOW_DAYS), today).fromInstant;
}
