import { fetchLastPerformance } from '@/api/sessions';
import { SESSION_STATUS } from '@/constants/session';
import type { LastPerformance } from '@/shared/schemas/session';
import { localLastPerformanceSchema, type PampojoDb } from './db';

/** Fetches "last time" for each exercise and keeps it on the device; failures are ignored. */
export async function prefetchLastPerformance(
  db: PampojoDb,
  exerciseIds: readonly string[],
): Promise<void> {
  const unique = [...new Set(exerciseIds)];
  await Promise.all(
    unique.map(async (exerciseId) => {
      try {
        const item = await fetchLastPerformance(exerciseId);
        if (item) {
          await db.lastPerformance.put({
            exerciseId,
            ...item,
            fetchedAt: new Date().toISOString(),
          });
        } else {
          await db.lastPerformance.delete(exerciseId);
        }
      } catch {
        // Offline or a server error: the stored or locally computed value is used instead.
      }
    }),
  );
}

/** The stored value, else the latest completed session on this device with a set of the exercise. */
export async function lastPerformanceFor(
  db: PampojoDb,
  exerciseId: string,
  excludeSessionId?: string,
): Promise<LastPerformance | null> {
  const stored = localLastPerformanceSchema.safeParse(await db.lastPerformance.get(exerciseId));
  if (stored.success && stored.data.sessionId !== excludeSessionId) {
    const { sessionId, finishedAt, sets } = stored.data;
    return { sessionId, finishedAt, sets };
  }
  const sets = (await db.setLogs.where('exerciseId').equals(exerciseId).toArray()).filter(
    (set) => set.deletedAt === null && set.sessionId !== excludeSessionId,
  );
  const sessionIds = [...new Set(sets.map((set) => set.sessionId))];
  const sessions = (await db.sessions.bulkGet(sessionIds)).filter(
    (session) => session?.status === SESSION_STATUS.COMPLETED && session.finishedAt,
  );
  const latest = sessions.sort((a, b) =>
    (b?.finishedAt ?? '').localeCompare(a?.finishedAt ?? ''),
  )[0];
  if (!latest?.finishedAt) return null;
  return {
    sessionId: latest.id,
    finishedAt: latest.finishedAt,
    sets: sets
      .filter((set) => set.sessionId === latest.id)
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.setIndex - b.setIndex)
      .map((set) => ({
        setIndex: set.setIndex,
        weightKg: set.weightKg,
        reps: set.reps,
        durationSec: set.durationSec,
        distanceM: set.distanceM,
      })),
  };
}
