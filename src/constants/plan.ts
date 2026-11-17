import type { ValueOf } from '@/types/utils';

export const SCHEDULE = {
  intervalMin: 1,
  intervalMax: 4,
  endAfterMax: 100,
  activeRulesMax: 100,
  horizonYears: 2,
  /** Mobile calendar cell markers shown before "+N". */
  markersMax: 3,
} as const;

/** ISO weekdays, Monday = 1. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** A missed occurrence can be made up for at most this many days after its date. */
export const LATE_WINDOW_DAYS = 7;
export const CALENDAR_RANGE_MAX_DAYS = 62;
export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_PAGE_MAX = 50;

export const OCCURRENCE_STATUS = {
  ON_TIME: 'on_time',
  LATE: 'late',
  MISSED: 'missed',
  PLANNED: 'planned',
} as const;
export type OccurrenceStatus = ValueOf<typeof OCCURRENCE_STATUS>;

export const SESSION_KIND = { ON_TIME: 'on_time', LATE: 'late', EXTRA: 'extra' } as const;
export type SessionKind = ValueOf<typeof SESSION_KIND>;
