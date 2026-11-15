import Dexie, { type Table } from 'dexie';
import { z } from 'zod';
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

export const LOCAL_DB_PREFIX = 'pampojo-';

/** A session as the device keeps it: the server fields plus rest, focus and unsaved row edits. */
export interface LocalSession extends Omit<Session, 'setLogs'> {
  restEndsAt: string | null;
  restDurationSec: number;
  restSetId: string | null;
  currentEntryId: string | null;
  /** Unlogged row edits, keyed `${entryId}:${setIndex}`; never sent to the server. */
  drafts: Record<string, SetValues>;
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
}

export interface OutboxEntry {
  seq?: number;
  id: string;
  method: 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
}

export const localSessionSchema = sessionSchema.omit({ setLogs: true }).extend({
  // Rows written before spec 11 have no scheduledFor.
  scheduledFor: z.string().nullable().default(null),
  restEndsAt: z.string().nullable(),
  restDurationSec: z.number(),
  restSetId: z.string().nullable(),
  currentEntryId: z.string().nullable(),
  drafts: z.record(z.string(), setValuesSchema),
});

export const localSetLogSchema = setLogSchema.extend({ deletedAt: z.string().nullable() });

export const localLastPerformanceSchema = z.object({
  exerciseId: z.string(),
  sessionId: z.string(),
  finishedAt: z.string(),
  sets: z.array(lastPerformanceSetSchema),
  fetchedAt: z.string(),
});

export class PampojoDb extends Dexie {
  sessions!: Table<LocalSession, string>;
  setLogs!: Table<LocalSetLog, string>;
  lastPerformance!: Table<LocalLastPerformance, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      sessions: 'id, status, startedAt',
      setLogs: 'id, sessionId, exerciseId, [sessionId+sessionExerciseId+setIndex]',
      lastPerformance: 'exerciseId',
      outbox: '++seq',
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
