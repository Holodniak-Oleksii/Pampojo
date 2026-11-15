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
