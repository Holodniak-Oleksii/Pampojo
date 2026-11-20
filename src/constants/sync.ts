export const SYNC_MUTATION_TYPE = {
  SESSION_PUT: 'session.put',
  SESSION_PATCH: 'session.patch',
  SET_PUT: 'set.put',
  SET_PATCH: 'set.patch',
  SET_DELETE: 'set.delete',
  MEASUREMENT_PUT: 'measurement.put',
  MEASUREMENT_DELETE: 'measurement.delete',
} as const;

export type SyncMutationType = (typeof SYNC_MUTATION_TYPE)[keyof typeof SYNC_MUTATION_TYPE];

export const SYNC_MUTATION_TYPES = Object.values(SYNC_MUTATION_TYPE);

export const SYNC_PUSH_STATUS = {
  APPLIED: 'applied',
  DUPLICATE: 'duplicate',
  REJECTED: 'rejected',
} as const;

export const SYNC_PUSH_BATCH_MAX = 50;
export const SYNC_PULL_PAGE_ROWS = 500;
export const SYNC_PULL_OVERLAP_MS = 30_000;
export const SYNC_SESSION_WINDOW_DAYS = 30;
/** Raise to force a full download on every device after a local schema change. */
export const SYNC_DOWNLOAD_VERSION = 1;
export const SYNC_CURSOR_MAX = 512;

/** Pull phases in the order of the download steps. */
export const SYNC_PHASES = [
  'profile',
  'gym',
  'workouts',
  'scheduleRules',
  'exercises',
  'lastPerformance',
  'sessions',
  'setLogs',
  'measurements',
] as const;

export type SyncPhase = (typeof SYNC_PHASES)[number];

/** The tables that have a row count in `totals`. */
export const SYNC_COUNTED_PHASES = [
  'workouts',
  'scheduleRules',
  'exercises',
  'lastPerformance',
  'sessions',
  'setLogs',
  'measurements',
] as const satisfies readonly SyncPhase[];

export type SyncCountedPhase = (typeof SYNC_COUNTED_PHASES)[number];
