import { REST, SESSION_STATUS } from '@/constants/session';
import type { LocalSession, PampojoDb } from '@/services/local-db/db';
import type { SyncChanges } from '@/shared/schemas/sync';
import { readSyncMeta } from './meta';

/** Every table a pull page writes; the page and its cursor commit in one transaction. */
export const pullTables = (db: PampojoDb) => [
  db.workouts,
  db.scheduleRules,
  db.exercises,
  db.lastPerformance,
  db.sessions,
  db.setLogs,
  db.measurements,
  db.meta,
  db.outbox,
];

/**
 * Writes one pull page. A row with a change waiting in the outbox is skipped, so a local change
 * wins until it is pushed. Call inside a transaction over `pullTables(db)`.
 */
export async function applyPullPage(
  db: PampojoDb,
  changes: SyncChanges,
  pending: ReadonlySet<string>,
): Promise<{ sessionsChanged: boolean }> {
  const fresh = <T extends { id: string }>(rows: readonly T[]) =>
    rows.filter((row) => !pending.has(row.id));

  if (changes.profile) await db.meta.put({ key: 'profile', value: changes.profile });
  if (changes.gymChanged) await db.meta.put({ key: 'gym', value: changes.gym });

  await db.workouts.bulkPut(changes.workouts);

  for (const rule of changes.scheduleRules) {
    if (rule.deletedAt) {
      await db.scheduleRules.delete(rule.id);
    } else {
      await db.scheduleRules.put({
        id: rule.id,
        workoutId: rule.workoutId,
        startDate: rule.startDate,
        endDate: rule.endDate,
        weekdays: rule.weekdays,
        intervalWeeks: rule.intervalWeeks,
        updatedAt: rule.updatedAt,
      });
    }
  }

  for (const exercise of changes.exercises) {
    if (exercise.deletedAt && exercise.isOwn) {
      await db.exercises.delete(exercise.id);
    } else {
      await db.exercises.put({ ...exercise, isOwn: exercise.isOwn ? 1 : 0 });
    }
  }

  const fetchedAt = new Date().toISOString();
  for (const item of changes.lastPerformance) {
    if (item.item) {
      await db.lastPerformance.put({
        exerciseId: item.exerciseId,
        ...item.item,
        fetchedAt,
        bests: item.bests,
      });
    } else {
      await db.lastPerformance.delete(item.exerciseId);
    }
  }

  const { activeSessionId } = await readSyncMeta(db);
  const active = activeSessionId ? await db.sessions.get(activeSessionId) : undefined;
  const hasActive = active?.status === SESSION_STATUS.IN_PROGRESS;
  for (const session of fresh(changes.sessions)) {
    if (session.status === SESSION_STATUS.ABANDONED) {
      await db.sessions.delete(session.id);
      await db.setLogs.where('sessionId').equals(session.id).delete();
      continue;
    }
    const existing = await db.sessions.get(session.id);
    const local: LocalSession = {
      ...session,
      restEndsAt: existing?.restEndsAt ?? null,
      restDurationSec: existing?.restDurationSec ?? REST.defaultSec,
      restSetId: existing?.restSetId ?? null,
      currentEntryId: existing?.currentEntryId ?? session.exercises[0]?.id ?? null,
      drafts: existing?.drafts ?? {},
      newRecords: existing?.newRecords ?? null,
      deviceOwned:
        existing?.deviceOwned ??
        (session.status === SESSION_STATUS.IN_PROGRESS &&
        hasActive &&
        activeSessionId !== session.id
          ? false
          : undefined),
    };
    await db.sessions.put(local);
  }

  await db.setLogs.bulkPut(fresh(changes.setLogs));

  for (const measurement of fresh(changes.measurements)) {
    const { deletedAt, ...row } = measurement;
    if (deletedAt) {
      await db.measurements.delete(row.id);
      continue;
    }
    // The server merged another row of this day into this one (one live row per type and day).
    const sameDay = await db.measurements
      .where('[type+measuredOn]')
      .equals([row.type, row.measuredOn])
      .toArray();
    for (const other of sameDay) {
      if (other.id !== row.id && !pending.has(other.id)) await db.measurements.delete(other.id);
    }
    await db.measurements.put(row);
  }

  return { sessionsChanged: changes.sessions.length > 0 || changes.setLogs.length > 0 };
}
