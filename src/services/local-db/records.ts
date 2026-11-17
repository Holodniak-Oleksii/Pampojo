import { SESSION_STATUS } from '@/constants/session';
import { bestsOf, mergeBests, newRecordsOf, type MetricSet } from '@/shared/progress/metrics';
import type { Bests, NewRecord } from '@/shared/schemas/progress';
import { localLastPerformanceSchema, type LocalSetLog, type PampojoDb } from './db';

const metricSet = (set: LocalSetLog): MetricSet => ({
  weightKg: set.weightKg,
  reps: set.reps,
  durationSec: set.durationSec,
  distanceM: set.distanceM,
});

/**
 * The bests before a session: the stored server bests merged with this device's completed
 * sessions, so a session finished offline still counts. Null when the exercise has no history.
 */
export async function localBaseline(
  db: PampojoDb,
  exerciseId: string,
  excludeSessionId: string,
): Promise<Bests | null> {
  const stored = localLastPerformanceSchema.safeParse(await db.lastPerformance.get(exerciseId));
  const sets = (await db.setLogs.where('exerciseId').equals(exerciseId).toArray()).filter(
    (set) => set.deletedAt === null && set.sessionId !== excludeSessionId,
  );
  const sessionIds = [...new Set(sets.map((set) => set.sessionId))];
  const completed = new Set(
    (await db.sessions.bulkGet(sessionIds))
      .filter((session) => session?.status === SESSION_STATUS.COMPLETED)
      .map((session) => session?.id),
  );
  const bySession = new Map<string, MetricSet[]>();
  for (const set of sets) {
    if (!completed.has(set.sessionId)) continue;
    bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), metricSet(set)]);
  }
  return mergeBests(
    stored.success ? stored.data.bests : null,
    bestsOf(null, [...bySession.values()]),
  );
}

/**
 * Computes the records that a finished session beats, saves them on its local row (never sent to
 * the server) and returns each exercise's bests after the session.
 */
export async function rememberNewRecords(
  db: PampojoDb,
  sessionId: string,
): Promise<Map<string, Bests | null>> {
  const after = new Map<string, Bests | null>();
  const session = await db.sessions.get(sessionId);
  if (!session) return after;
  const sets = (await db.setLogs.where('sessionId').equals(sessionId).toArray()).filter(
    (set) => set.deletedAt === null,
  );
  const records: NewRecord[] = [];
  const seen = new Set<string>();
  for (const entry of session.exercises) {
    const exerciseId = entry.exerciseId;
    if (seen.has(exerciseId)) continue;
    seen.add(exerciseId);
    const own = sets.filter((set) => set.exerciseId === exerciseId).map(metricSet);
    if (own.length === 0) continue;
    const baseline = await localBaseline(db, exerciseId, sessionId);
    records.push(...newRecordsOf(entry.exercise.trackingType, exerciseId, baseline, own));
    after.set(exerciseId, mergeBests(baseline, bestsOf(null, [own])));
  }
  await db.sessions.update(sessionId, { newRecords: records });
  return after;
}
