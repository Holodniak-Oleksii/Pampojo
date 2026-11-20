'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import {
  localSessionSchema,
  localSetLogSchema,
  openLocalDb,
  type LocalSession,
  type LocalSetLog,
  type PampojoDb,
} from './db';
import { findActiveSession } from './active-session';
import { lastPerformanceFor } from './last-performance';
import { findCompletedSessionsBetween, findScheduledSessions } from './scheduled';
import type { StatusSession } from '@/shared/plan/statuses';
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

/**
 * The active in-progress session of this device, or `null`; `undefined` while loading. It is the
 * one this device started or opened last, else the newest one of this device, else the newest
 * one from another device.
 */
export function useLocalInProgress(userId: string): InProgressSummary | null | undefined {
  const db = useLocalDb(userId);
  return useLiveQuery(async () => {
    const parsed = localSessionSchema.safeParse(await findActiveSession(db));
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

/** Completed local sessions around `[from, to]`, for statuses before sync; `undefined` while loading. */
export function useLocalCompletedSessions(
  userId: string,
  from: string,
  to: string,
): StatusSession[] | undefined {
  const db = useLocalDb(userId);
  return useLiveQuery(() => findCompletedSessionsBetween(db, from, to), [db, from, to]);
}
