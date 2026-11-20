import { SESSION_STATUS } from '@/constants/session';
import type { PampojoDb } from '@/services/local-db/db';
import { pendingEntityIds } from '@/services/local-db/outbox';
import { sessionWindowStart } from '@/shared/sync-window';

/**
 * Keeps the device copy to the 30-day window: deletes older finished sessions that have nothing
 * waiting in the outbox, then the exercises that nothing local references.
 */
export async function pruneLocal(db: PampojoDb, today: string): Promise<void> {
  const edge = sessionWindowStart(today).toISOString();
  await db.transaction(
    'rw',
    [db.sessions, db.setLogs, db.exercises, db.workouts, db.outbox],
    async () => {
      const pending = await pendingEntityIds(db);
      const old = await db.sessions.where('startedAt').below(edge).toArray();
      for (const session of old) {
        if (session.status === SESSION_STATUS.IN_PROGRESS || pending.has(session.id)) continue;
        const sets = await db.setLogs.where('sessionId').equals(session.id).toArray();
        if (sets.some((set) => pending.has(set.id))) continue;
        await db.setLogs.bulkDelete(sets.map((set) => set.id));
        await db.sessions.delete(session.id);
      }

      const used = new Set<string>();
      for (const workout of await db.workouts.toArray()) {
        if (workout.deletedAt) continue;
        for (const item of workout.exercises) used.add(item.exerciseId);
      }
      for (const session of await db.sessions.toArray()) {
        for (const item of session.exercises) used.add(item.exerciseId);
      }
      for (const set of await db.setLogs.toArray()) used.add(set.exerciseId);
      const unused = (await db.exercises.where('isOwn').equals(0).primaryKeys()).filter(
        (id) => !used.has(id),
      );
      await db.exercises.bulkDelete(unused);
    },
  );
}
