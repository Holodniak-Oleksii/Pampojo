import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
import { SYNC_MUTATION_TYPE, type SyncMutationType } from '@/constants/sync';
import type { Gym } from '@/shared/schemas/gym';
import type { Measurement } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import type {
  SyncExercise,
  SyncScheduleRule,
  SyncTotals,
  SyncWorkout,
} from '@/shared/schemas/sync';
import {
  lastPerformanceSetSchema,
  sessionSchema,
  setLogSchema,
  setValuesSchema,
  type LastPerformanceSet,
  type Session,
  type SetLog,
  type SetValues,
} from '@/shared/schemas/session';
import {
  bestsSchema,
  newRecordSchema,
  type Bests,
  type NewRecord,
} from '@/shared/schemas/progress';

export const LOCAL_DB_PREFIX = 'pampojo-';

/** A session as the device keeps it: the server fields plus rest, focus and unsaved row edits. */
export interface LocalSession extends Omit<Session, 'setLogs'> {
  restEndsAt: string | null;
  restDurationSec: number;
  restSetId: string | null;
  currentEntryId: string | null;
  /** Unlogged row edits, keyed `${entryId}:${setIndex}`; never sent to the server. */
  drafts: Record<string, SetValues>;
  /** Records beaten by this session, computed at finish on this device; null when not computed. */
  newRecords: NewRecord[] | null;
  /** False for an in-progress session from another device while this device has its own. */
  deviceOwned?: boolean;
}

export interface LocalSetLog extends SetLog {
  deletedAt: string | null;
}

export interface LocalLastPerformance {
  exerciseId: string;
  sessionId: string;
  finishedAt: string;
  sets: LastPerformanceSet[];
  fetchedAt: string;
  bests: Bests | null;
}

/** One outbox mutation; `payload` is the body of the matching REST request. */
export interface OutboxEntry {
  seq?: number;
  id: string;
  type: SyncMutationType;
  entityId: string;
  payload?: unknown;
  createdAt: string;
  attempts: number;
}

/** A spec 10 outbox entry, which replayed a REST call. Only the version 2 upgrade reads it. */
interface LegacyOutboxEntry {
  seq?: number;
  id: string;
  method: 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
}

export interface LocalWorkout extends Omit<SyncWorkout, 'deletedAt'> {
  deletedAt: string | null;
}

export type LocalScheduleRule = Omit<SyncScheduleRule, 'deletedAt'>;

/** `isOwn` is a number because IndexedDB cannot index booleans. */
export interface LocalExercise extends Omit<SyncExercise, 'isOwn'> {
  isOwn: 0 | 1;
}

export type LocalMeasurement = Measurement;

export type DownloadState =
  | { status: 'idle' }
  | {
      status: 'running';
      received: SyncTotals;
      totals: SyncTotals | null;
      /** True when the device had sessions or an outbox before the download, so the app stays open. */
      background?: boolean;
    }
  | { status: 'done' };

export interface SyncMeta {
  downloadVersion: number | null;
  download: DownloadState;
  /** `cursor` of the last finished pull run. */
  cursor: string | null;
  /** `nextCursor` of the page written last, so a stopped run continues where it ended. */
  pageToken: string | null;
  lastSyncAt: string | null;
  lastError: { code: string; at: string } | null;
  /** The in-progress session that this device shows as active. */
  activeSessionId: string | null;
}

export type MetaRow =
  | { key: 'sync'; value: SyncMeta }
  | { key: 'profile'; value: Profile }
  | { key: 'gym'; value: Gym | null };

export const EMPTY_SYNC_META: SyncMeta = {
  downloadVersion: null,
  download: { status: 'idle' },
  cursor: null,
  pageToken: null,
  lastSyncAt: null,
  lastError: null,
  activeSessionId: null,
};

const LEGACY_PATHS: {
  pattern: RegExp;
  type: Record<LegacyOutboxEntry['method'], SyncMutationType | undefined>;
}[] = [
  {
    pattern: /^\/api\/v1\/sessions\/([0-9a-f-]{36})$/,
    type: {
      PUT: SYNC_MUTATION_TYPE.SESSION_PUT,
      PATCH: SYNC_MUTATION_TYPE.SESSION_PATCH,
      DELETE: undefined,
    },
  },
  {
    pattern: /^\/api\/v1\/sets\/([0-9a-f-]{36})$/,
    type: {
      PUT: SYNC_MUTATION_TYPE.SET_PUT,
      PATCH: SYNC_MUTATION_TYPE.SET_PATCH,
      DELETE: SYNC_MUTATION_TYPE.SET_DELETE,
    },
  },
];

/** Maps a spec 10 REST entry to a mutation with the same id, or null for a path it never wrote. */
export function convertLegacyEntry(entry: LegacyOutboxEntry): OutboxEntry | null {
  for (const { pattern, type } of LEGACY_PATHS) {
    const match = pattern.exec(entry.path);
    const mutationType = match ? type[entry.method] : undefined;
    if (match?.[1] && mutationType) {
      return {
        seq: entry.seq,
        id: entry.id,
        type: mutationType,
        entityId: match[1],
        payload: entry.body,
        createdAt: entry.createdAt,
        attempts: entry.attempts,
      };
    }
  }
  return null;
}

export const localSessionSchema = sessionSchema.omit({ setLogs: true }).extend({
  // Rows written before spec 11 have no scheduledFor.
  scheduledFor: z.string().nullable().default(null),
  restEndsAt: z.string().nullable(),
  restDurationSec: z.number(),
  restSetId: z.string().nullable(),
  currentEntryId: z.string().nullable(),
  drafts: z.record(z.string(), setValuesSchema),
  newRecords: z.array(newRecordSchema).nullable().default(null),
  deviceOwned: z.boolean().optional(),
});

export const localSetLogSchema = setLogSchema.extend({ deletedAt: z.string().nullable() });

export const localLastPerformanceSchema = z.object({
  exerciseId: z.string(),
  sessionId: z.string(),
  finishedAt: z.string(),
  sets: z.array(lastPerformanceSetSchema),
  fetchedAt: z.string(),
  bests: bestsSchema.nullable().default(null),
});

export class PampojoDb extends Dexie {
  sessions!: Table<LocalSession, string>;
  setLogs!: Table<LocalSetLog, string>;
  lastPerformance!: Table<LocalLastPerformance, string>;
  outbox!: Table<OutboxEntry, number>;
  workouts!: Table<LocalWorkout, string>;
  scheduleRules!: Table<LocalScheduleRule, string>;
  exercises!: Table<LocalExercise, string>;
  measurements!: Table<LocalMeasurement, string>;
  meta!: Table<MetaRow, MetaRow['key']>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: 'id, status, startedAt',
      setLogs: 'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]',
      lastPerformance: 'exerciseId',
      outbox: '++seq',
    });
    this.version(2)
      .stores({
        sessions: 'id, status, startedAt',
        setLogs: 'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]',
        lastPerformance: 'exerciseId',
        outbox: '++seq, entityId',
        workouts: 'id',
        scheduleRules: 'id, workoutId',
        exercises: 'id, isOwn',
        measurements: 'id, [type+measuredOn]',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const outbox = tx.table('outbox');
        const entries = (await outbox.toArray()) as LegacyOutboxEntry[];
        for (const entry of entries) {
          const converted = convertLegacyEntry(entry);
          if (converted) {
            await outbox.put(converted);
          } else if (entry.seq !== undefined) {
            console.warn('[outbox] dropped an entry with an unknown path', entry.path);
            await outbox.delete(entry.seq);
          }
        }
      });
  }
}

const open = new Map<string, PampojoDb>();

export function localDbName(userId: string): string {
  return `${LOCAL_DB_PREFIX}${userId}`;
}

/** One connection per user for the page's lifetime. */
export function openLocalDb(userId: string): PampojoDb {
  const name = localDbName(userId);
  let db = open.get(name);
  if (!db) {
    db = new PampojoDb(name);
    open.set(name, db);
  }
  return db;
}

/** Closes and forgets every cached connection, so a deleted database is not reused. */
export function closeLocalDbs(): void {
  for (const db of open.values()) db.close();
  open.clear();
}
