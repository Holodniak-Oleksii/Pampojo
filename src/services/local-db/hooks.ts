'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { SESSION_STATUS } from '@/constants/session';
import {
  localSessionSchema,
  localSetLogSchema,
  openLocalDb,
  type LocalSession,
  type LocalSetLog,
  type PampojoDb,
} from './db';
import { lastPerformanceFor } from './last-performance';
import { findScheduledSessions } from './scheduled';
import { createSessionRepository, type SessionRepository } from './session-repository';
import type { LastPerformance } from '@/shared/schemas/session';

export function useLocalDb(userId: string): PampojoDb {
  return useMemo(() => openLocalDb(userId), [userId]);
}

export function useSessionRepository(userId: string): SessionRepository {
  const db = useLocalDb(userId);
  return useMemo(() => createSessionRepository(db), [db]);
}

export interface LocalSessionData {
  session: LocalSession | null;
  /** Live (not deleted) set logs. */
  setLogs: LocalSetLog[];
}

/** `undefined` while loading, `session: null` when the device does not have it. */
export function useLocalSession(userId: string, sessionId: string): LocalSessionData | undefined {
  const db = useLocalDb(userId);
  return useLiveQuery(async () => {
    const parsed = localSessionSchema.safeParse(await db.sessions.get(sessionId));
    if (!parsed.success) return { session: null, setLogs: [] };
    const logs = await db.setLogs.where('sessionId').equals(sessionId).toArray();
    const setLogs = logs.flatMap((log) => {
      const result = localSetLogSchema.safeParse(log);
      return result.success && result.data.deletedAt === null ? [result.data] : [];
    });
    return { session: parsed.data, setLogs };
  }, [db, sessionId]);
}

export interface InProgressSummary {
  session: LocalSession;
  setLogs: LocalSetLog[];
}

/** The newest in-progress session on this device, or `null`; `undefined` while loading. */
export function useLocalInProgress(userId: string): InProgressSummary | null | undefined {
  const db = useLocalDb(userId);
  return useLiveQuery(async () => {
    const rows = await db.sessions.where('status').equals(SESSION_STATUS.IN_PROGRESS).toArray();
    const newest = rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const parsed = localSessionSchema.safeParse(newest);
    if (!parsed.success) return null;
    const setLogs = (await db.setLogs.where('sessionId').equals(parsed.data.id).toArray()).filter(
      (log) => log.deletedAt === null,
    );
    return { session: parsed.data, setLogs };
  }, [db]);
}

/** "Last time" per exercise id for the given session's exercises. */
export function useLastPerformance(
  userId: string,
  sessionId: string,
  exerciseIds: readonly string[],
): Record<string, LastPerformance | null> | undefined {
  const db = useLocalDb(userId);
  const key = [...new Set(exerciseIds)].sort().join(',');
  return useLiveQuery(async () => {
    const ids = key ? key.split(',') : [];
    const entries = await Promise.all(
      ids.map(async (id) => [id, await lastPerformanceFor(db, id, sessionId)] as const),
    );
    return Object.fromEntries(entries);
  }, [db, sessionId, key]);
}

/** Local sessions linked to a planned date; `undefined` while loading. */
export function useLocalScheduledSessions(
  userId: string,
  date: string,
): LocalSession[] | undefined {
  const db = useLocalDb(userId);
  return useLiveQuery(() => findScheduledSessions(db, date), [db, date]);
}
