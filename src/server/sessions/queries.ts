import 'server-only';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { SESSION_LIST_LIMIT, SESSION_STATUS, type SessionStatus } from '@/constants/session';
import { setLog, workoutSession } from '@/server/db/schema';
import { touch } from '@/server/db/utils';
import type { Executor, Tx } from '@/server/exercises/queries';

export type { Executor, Tx };

export type SessionRow = typeof workoutSession.$inferSelect;
export type SetLogRow = typeof setLog.$inferSelect;

/** No owner filter on purpose: the service reports a foreign row as not found. */
export async function lockSessionRow(tx: Tx, id: string): Promise<SessionRow | undefined> {
  const [row] = await tx
    .select()
    .from(workoutSession)
    .where(eq(workoutSession.id, id))
    .for('update')
    .limit(1);
  return row;
}

export async function insertSession(tx: Tx, values: typeof workoutSession.$inferInsert) {
  await tx.insert(workoutSession).values(values);
}

export async function updateSessionColumns(
  tx: Tx,
  userId: string,
  id: string,
  fields: Partial<Pick<SessionRow, 'exercises' | 'notes' | 'status' | 'finishedAt'>>,
) {
  await tx
    .update(workoutSession)
    .set({ ...fields, ...touch() })
    .where(and(eq(workoutSession.id, id), eq(workoutSession.userId, userId)));
}

export async function findSessionRow(
  db: Executor,
  userId: string,
  id: string,
): Promise<SessionRow | undefined> {
  const [row] = await db
    .select()
    .from(workoutSession)
    .where(and(eq(workoutSession.id, id), eq(workoutSession.userId, userId)))
    .limit(1);
  return row;
}

export async function listSessionRows(
  db: Executor,
  userId: string,
  filters: { status?: SessionStatus; exerciseId?: string; scheduledFor?: string },
): Promise<SessionRow[]> {
  const statuses = filters.status
    ? [filters.status]
    : [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.COMPLETED];
  const conditions = [eq(workoutSession.userId, userId), inArray(workoutSession.status, statuses)];
  if (filters.scheduledFor) conditions.push(eq(workoutSession.scheduledFor, filters.scheduledFor));
  if (filters.exerciseId) {
    conditions.push(sql`exists (
      select 1 from ${setLog}
      where ${setLog.sessionId} = ${workoutSession.id}
        and ${setLog.exerciseId} = ${filters.exerciseId}
        and ${setLog.deletedAt} is null)`);
  }
  return db
    .select()
    .from(workoutSession)
    .where(and(...conditions))
    .orderBy(desc(workoutSession.startedAt), workoutSession.id)
    .limit(SESSION_LIST_LIMIT);
}

/** The caller has checked that the session belongs to the user. */
export async function listSetLogRows(db: Executor, sessionId: string): Promise<SetLogRow[]> {
  return db
    .select()
    .from(setLog)
    .where(and(eq(setLog.sessionId, sessionId), isNull(setLog.deletedAt)))
    .orderBy(asc(setLog.completedAt), asc(setLog.setIndex));
}

/** No owner filter: the caller checks the set's session belongs to the user. */
export async function findSetRow(db: Executor, id: string): Promise<SetLogRow | undefined> {
  const [row] = await db.select().from(setLog).where(eq(setLog.id, id)).limit(1);
  return row;
}

export async function lockSetRow(tx: Tx, id: string): Promise<SetLogRow | undefined> {
  const [row] = await tx.select().from(setLog).where(eq(setLog.id, id)).for('update').limit(1);
  return row;
}

/** Plan entries of the session that have live set logs. */
export async function listLoggedEntryIds(tx: Tx, sessionId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ id: setLog.sessionExerciseId })
    .from(setLog)
    .where(and(eq(setLog.sessionId, sessionId), isNull(setLog.deletedAt)));
  return rows.map((row) => row.id);
}

export async function upsertSetLog(tx: Tx, values: typeof setLog.$inferInsert) {
  await tx
    .insert(setLog)
    .values(values)
    .onConflictDoUpdate({
      target: setLog.id,
      set: {
        sessionId: values.sessionId,
        sessionExerciseId: values.sessionExerciseId,
        exerciseId: values.exerciseId,
        setIndex: values.setIndex,
        weightKg: values.weightKg,
        reps: values.reps,
        durationSec: values.durationSec,
        distanceM: values.distanceM,
        completedAt: values.completedAt,
        deletedAt: null,
        ...touch(),
      },
    });
}

export async function updateSetColumns(
  tx: Tx,
  id: string,
  fields: Partial<Pick<SetLogRow, 'weightKg' | 'reps' | 'durationSec' | 'distanceM'>>,
) {
  await tx
    .update(setLog)
    .set({ ...fields, ...touch() })
    .where(eq(setLog.id, id));
}

export async function softDeleteSetLog(tx: Tx, id: string) {
  await tx
    .update(setLog)
    .set({ deletedAt: new Date(), ...touch() })
    .where(and(eq(setLog.id, id), isNull(setLog.deletedAt)));
}

/** Frees a set position held by another live row, so a replayed or re-logged set can take it. */
export async function softDeleteSetAtPosition(
  tx: Tx,
  position: { sessionId: string; sessionExerciseId: string; setIndex: number; exceptId: string },
) {
  await tx
    .update(setLog)
    .set({ deletedAt: new Date(), ...touch() })
    .where(
      and(
        eq(setLog.sessionId, position.sessionId),
        eq(setLog.sessionExerciseId, position.sessionExerciseId),
        eq(setLog.setIndex, position.setIndex),
        isNull(setLog.deletedAt),
        sql`${setLog.id} <> ${position.exceptId}`,
      ),
    );
}

export async function softDeleteSessionSetLogs(tx: Tx, sessionId: string) {
  await tx
    .update(setLog)
    .set({ deletedAt: new Date(), ...touch() })
    .where(and(eq(setLog.sessionId, sessionId), isNull(setLog.deletedAt)));
}

export interface LastPerformanceRow extends Record<string, unknown> {
  session_id: string;
  finished_at: Date | string;
  set_index: number;
  weight_kg: string | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
}

/** The live sets of the exercise in the user's latest completed session that has any. */
export async function findLastPerformanceRows(
  db: Executor,
  userId: string,
  exerciseId: string,
): Promise<LastPerformanceRow[]> {
  const rows = await db.execute<LastPerformanceRow>(sql`
    with latest as (
      select s.id, s.finished_at
      from workout_session s
      where s.user_id = ${userId}
        and s.status = ${SESSION_STATUS.COMPLETED}
        and exists (
          select 1 from set_log l
          where l.session_id = s.id and l.exercise_id = ${exerciseId} and l.deleted_at is null)
      order by s.finished_at desc, s.id
      limit 1
    )
    select latest.id as session_id, latest.finished_at, l.set_index, l.weight_kg, l.reps,
      l.duration_sec, l.distance_m
    from latest
    join set_log l on l.session_id = latest.id
    where l.exercise_id = ${exerciseId} and l.deleted_at is null
    order by l.completed_at, l.set_index`);
  return [...rows];
}

/** Own exercise deletion (spec 07 decision): its logged sets disappear from the user's history. */
export async function softDeleteExerciseSetLogs(tx: Tx, userId: string, exerciseId: string) {
  await tx.execute(sql`
    update set_log l set deleted_at = now(), updated_at = now()
    from workout_session s
    where s.id = l.session_id and s.user_id = ${userId}
      and l.exercise_id = ${exerciseId} and l.deleted_at is null`);
}

export async function removeExerciseFromInProgressSessions(
  tx: Tx,
  userId: string,
  exerciseId: string,
) {
  await tx.execute(sql`
    update workout_session s
    set exercises = coalesce(
        (select jsonb_agg(e) from jsonb_array_elements(s.exercises) e
         where e->>'exerciseId' <> ${exerciseId}),
        '[]'::jsonb),
      updated_at = now()
    where s.user_id = ${userId}
      and s.status = ${SESSION_STATUS.IN_PROGRESS}
      and exists (
        select 1 from jsonb_array_elements(s.exercises) e where e->>'exerciseId' = ${exerciseId})`);
}
