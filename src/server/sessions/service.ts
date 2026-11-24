import 'server-only';
import {
  CLOCK_SKEW_MS,
  MAIN_METRIC,
  SESSION_STATUS,
  SET_FIELDS,
  SET_VALUE_FIELDS,
  type SessionStatus,
  type SetValueField,
} from '@/constants/session';
import type { TrackingType } from '@/constants/exercise';
import { getDb } from '@/server/db/client';
import { DomainError } from '@/server/http/errors';
import { HISTORY_PAGE_SIZE } from '@/constants/plan';
import { listWorkoutRules } from '@/server/plan/queries';
import { userToday } from '@/server/plan/today';
import { occursOn } from '@/shared/plan/occurrences';
import { lateWindowEnd } from '@/shared/plan/statuses';
import { findBestsFor } from '@/server/progress/service';
import type { SyncLastPerformance } from '@/shared/schemas/sync';
import { findVisibleExercises, findWorkoutOwner } from '@/server/workouts/queries';
import type {
  LastPerformanceResponse,
  PatchSessionInput,
  PatchSetInput,
  PutSessionInput,
  PutSetInput,
  Session,
  SessionExercise,
  SessionListQuery,
  SessionListResponse,
  SetLog,
  SetValues,
} from '@/shared/schemas/session';
import { decodeHistoryCursor, encodeHistoryCursor, type HistoryCursor } from './cursor';
import { SESSION_ERROR } from './errors';
import {
  findLastPerformanceRowsFor,
  findSetRow,
  listLoggedEntryIds,
  findSessionRow,
  insertSession,
  listSessionRows,
  listSetLogRows,
  lockSessionRow,
  lockSetRow,
  softDeleteSessionSetLogs,
  softDeleteSetAtPosition,
  softDeleteSetLog,
  updateSessionColumns,
  updateSetColumns,
  upsertSetLog,
  type Executor,
  type SessionRow,
  type SetLogRow,
  type Tx,
} from './queries';

function notFound(): DomainError {
  return new DomainError(SESSION_ERROR.NOT_FOUND, 'Session not found');
}

function notInProgress(): DomainError {
  return new DomainError(SESSION_ERROR.NOT_IN_PROGRESS, 'Session is not in progress');
}

function invalid(path: (string | number)[], message: string): DomainError {
  return new DomainError('VALIDATION_FAILED', 'Validation failed', [
    { code: 'custom', path, message },
  ]);
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function assertNotFuture(value: string, path: string[]) {
  if (new Date(value).getTime() > Date.now() + CLOCK_SKEW_MS) {
    throw invalid(path, 'Time is in the future');
  }
}

function toSetLog(row: SetLogRow): SetLog {
  return {
    id: row.id,
    sessionId: row.sessionId,
    sessionExerciseId: row.sessionExerciseId,
    exerciseId: row.exerciseId,
    setIndex: row.setIndex,
    weightKg: toNumber(row.weightKg),
    reps: row.reps,
    durationSec: row.durationSec,
    distanceM: row.distanceM,
    completedAt: row.completedAt.toISOString(),
  };
}

function toSession(row: SessionRow, logs: SetLogRow[]): Session {
  return {
    id: row.id,
    workoutId: row.workoutId,
    workoutSnapshot: row.workoutSnapshot,
    exercises: row.exercises,
    scheduledFor: row.scheduledFor,
    status: row.status as SessionStatus,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
    setLogs: logs.map(toSetLog),
  };
}

/** Fields the tracking type does not use must be empty, and the main metric must be filled. */
function assertSetValues(trackingType: TrackingType, values: SetValues) {
  const allowed: readonly SetValueField[] = SET_FIELDS[trackingType];
  for (const field of SET_VALUE_FIELDS) {
    if (!allowed.includes(field) && values[field] !== null) {
      throw invalid([field], `Not a value of ${trackingType} exercises`);
    }
  }
  const main = MAIN_METRIC[trackingType];
  if (values[main] === null) throw invalid([main], 'The main value is required');
}

async function assertVisibleExercises(tx: Tx, userId: string, input: PutSessionInput) {
  const ids = [
    ...new Set([
      ...input.exercises.map((item) => item.exerciseId),
      ...input.workoutSnapshot.exercises.map((item) => item.exerciseId),
    ]),
  ];
  const visible = new Map(
    (await findVisibleExercises(tx, userId, ids)).map((row) => [row.id, row.trackingType]),
  );
  input.exercises.forEach((item, index) => {
    const trackingType = visible.get(item.exerciseId);
    if (!trackingType) throw invalid(['exercises', index, 'exerciseId'], 'Unknown exercise');
    if (trackingType !== item.exercise.trackingType) {
      throw invalid(['exercises', index, 'exercise', 'trackingType'], 'Tracking type mismatch');
    }
  });
  input.workoutSnapshot.exercises.forEach((item, index) => {
    if (!visible.has(item.exerciseId)) {
      throw invalid(['workoutSnapshot', 'exercises', index, 'exerciseId'], 'Unknown exercise');
    }
  });
}

async function assertNewExercises(
  tx: Tx,
  userId: string,
  before: readonly SessionExercise[],
  after: readonly SessionExercise[],
) {
  const known = new Set(before.map((item) => item.exerciseId));
  const added = after.filter((item) => !known.has(item.exerciseId));
  if (added.length === 0) return;
  const visible = new Map(
    (
      await findVisibleExercises(tx, userId, [...new Set(added.map((item) => item.exerciseId))])
    ).map((row) => [row.id, row.trackingType]),
  );
  after.forEach((item, index) => {
    if (known.has(item.exerciseId)) return;
    const trackingType = visible.get(item.exerciseId);
    if (!trackingType) throw invalid(['exercises', index, 'exerciseId'], 'Unknown exercise');
    if (trackingType !== item.exercise.trackingType) {
      throw invalid(['exercises', index, 'exercise', 'trackingType'], 'Tracking type mismatch');
    }
  });
}

/** Set logs point at plan entries: those entries must stay, and keep their exercise and type. */
async function assertPlanKeepsLogs(
  tx: Tx,
  sessionId: string,
  before: readonly SessionExercise[],
  after: readonly SessionExercise[],
) {
  const previous = new Map(before.map((item) => [item.id, item]));
  after.forEach((item, index) => {
    const old = previous.get(item.id);
    if (
      old &&
      (old.exerciseId !== item.exerciseId ||
        old.exercise.trackingType !== item.exercise.trackingType)
    ) {
      throw invalid(['exercises', index], 'A session exercise cannot change its exercise');
    }
  });
  const kept = new Set(after.map((item) => item.id));
  for (const id of await listLoggedEntryIds(tx, sessionId)) {
    if (!kept.has(id))
      throw invalid(['exercises'], 'An exercise with logged sets cannot be removed');
  }
}

async function lockOwnSession(tx: Tx, userId: string, id: string): Promise<SessionRow> {
  const row = await lockSessionRow(tx, id);
  if (!row || row.userId !== userId) throw notFound();
  return row;
}

export async function listSessions(
  userId: string,
  query: SessionListQuery,
  db: Executor = getDb(),
): Promise<SessionListResponse> {
  const { limit, cursor, ...filters } = query;
  let page: { size: number; after: HistoryCursor | null } | undefined;
  if (limit !== undefined || cursor !== undefined) {
    const after = cursor === undefined ? null : decodeHistoryCursor(cursor);
    if (cursor !== undefined && after === null) throw invalid(['cursor'], 'Unknown cursor');
    page = { size: limit ?? HISTORY_PAGE_SIZE, after };
  }
  const rows = await listSessionRows(db, userId, filters, page);
  const more = page !== undefined && rows.length > page.size;
  const items = more ? rows.slice(0, page?.size) : rows;
  const last = items.at(-1);
  return {
    items: items.map((row) => ({
      id: row.id,
      workoutId: row.workoutId,
      workoutName: row.workoutSnapshot.name,
      scheduledFor: row.scheduledFor,
      status: row.status as SessionStatus,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      setCount: row.setCount,
    })),
    nextCursor:
      more && last ? encodeHistoryCursor({ startedAt: last.startedAt, id: last.id }) : null,
  };
}

/**
 * A session fulfils either the day it started, or a missed occurrence of its workout whose late
 * window still includes that day (spec 12).
 */
async function assertFulfillableDate(
  tx: Tx,
  userId: string,
  workoutId: string,
  scheduledFor: string,
  startedAt: string,
): Promise<void> {
  const start = await userToday(tx, userId, new Date(startedAt));
  if (scheduledFor === start) return;
  if (scheduledFor < start) {
    const rules = await listWorkoutRules(tx, userId, workoutId, scheduledFor);
    const end = lateWindowEnd(rules, workoutId, scheduledFor);
    if (rules.some((rule) => occursOn(rule, scheduledFor)) && end !== null && start <= end) return;
  }
  throw invalid(['scheduledFor'], 'Not a day this session can fulfil');
}

export async function getSession(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<Session> {
  const row = await findSessionRow(db, userId, id);
  if (!row || row.status === SESSION_STATUS.ABANDONED) throw notFound();
  return toSession(row, await listSetLogRows(db, id));
}

/** Idempotent create with a client id: a repeat returns the stored row unchanged. */
export async function putSession(
  userId: string,
  id: string,
  input: PutSessionInput,
  db: Executor = getDb(),
): Promise<Session> {
  let result: Session | undefined;
  await db.transaction(async (tx) => {
    const existing = await lockSessionRow(tx, id);
    if (existing) {
      if (existing.userId !== userId) throw notFound();
      result = toSession(existing, await listSetLogRows(tx, id));
      return;
    }
    assertNotFuture(input.startedAt, ['startedAt']);
    // A deleted workout is still the user's: an outbox replay may arrive after the delete.
    const ownerId = await findWorkoutOwner(tx, input.workoutId);
    if (ownerId !== userId) throw invalid(['workoutId'], 'Unknown workout');
    if (input.workoutSnapshot.workoutId !== input.workoutId) {
      throw invalid(['workoutSnapshot', 'workoutId'], 'Snapshot does not match the workout');
    }
    await assertVisibleExercises(tx, userId, input);
    const scheduledFor = input.scheduledFor ?? null;
    // The day of the start, not of the request: an offline start may be replayed after midnight.
    if (scheduledFor !== null) {
      await assertFulfillableDate(tx, userId, input.workoutId, scheduledFor, input.startedAt);
    }
    await insertSession(tx, {
      id,
      userId,
      workoutId: input.workoutId,
      scheduledFor,
      workoutSnapshot: input.workoutSnapshot,
      exercises: input.exercises,
      status: SESSION_STATUS.IN_PROGRESS,
      startedAt: new Date(input.startedAt),
    });
  });
  return result ?? getSession(userId, id, db);
}

export async function patchSession(
  userId: string,
  id: string,
  input: PatchSessionInput,
  db: Executor = getDb(),
): Promise<Session> {
  await db.transaction(async (tx) => {
    const row = await lockOwnSession(tx, userId, id);
    const status = row.status as SessionStatus;

    // A repeated finish or abandon is a no-op, so retries are safe.
    if (input.status && input.status === status) return;
    if (status !== SESSION_STATUS.IN_PROGRESS) throw notInProgress();

    const fields: Parameters<typeof updateSessionColumns>[3] = {};
    if (input.exercises !== undefined) {
      await assertPlanKeepsLogs(tx, id, row.exercises, input.exercises);
      await assertNewExercises(tx, userId, row.exercises, input.exercises);
      fields.exercises = input.exercises;
    }
    if (input.notes !== undefined) fields.notes = input.notes;
    if (input.status === SESSION_STATUS.COMPLETED) {
      const finishedAt = input.finishedAt as string;
      assertNotFuture(finishedAt, ['finishedAt']);
      if (new Date(finishedAt) < row.startedAt) {
        throw invalid(['finishedAt'], 'finishedAt is before startedAt');
      }
      fields.status = SESSION_STATUS.COMPLETED;
      fields.finishedAt = new Date(finishedAt);
    }
    if (input.status === SESSION_STATUS.ABANDONED) {
      fields.status = SESSION_STATUS.ABANDONED;
      fields.finishedAt = input.finishedAt ? new Date(input.finishedAt) : new Date();
      await softDeleteSessionSetLogs(tx, id);
    }
    await updateSessionColumns(tx, userId, id, fields);
  });
  const row = await findSessionRow(db, userId, id);
  if (!row) throw notFound();
  return toSession(row, await listSetLogRows(db, id));
}

/**
 * Deletes a session from the history: it becomes abandoned and its sets are soft-deleted, so the
 * next pull removes it from other devices. A repeated delete is a no-op.
 */
export async function deleteSession(
  userId: string,
  id: string,
  db: Executor = getDb(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const row = await lockOwnSession(tx, userId, id);
    if (row.status === SESSION_STATUS.ABANDONED) return;
    await softDeleteSessionSetLogs(tx, id);
    await updateSessionColumns(tx, userId, id, {
      status: SESSION_STATUS.ABANDONED,
      finishedAt: row.finishedAt ?? new Date(),
    });
  });
}

function trackingTypeOf(session: SessionRow, entryId: string, exerciseId: string): TrackingType {
  const entry = session.exercises.find((item) => item.id === entryId);
  if (!entry || entry.exerciseId !== exerciseId) {
    throw invalid(['sessionExerciseId'], 'Unknown session exercise');
  }
  return entry.exercise.trackingType;
}

async function readSet(db: Executor, id: string): Promise<SetLog> {
  const row = await findSetRow(db, id);
  if (!row) throw notFound();
  return toSetLog(row);
}

/**
 * Set writes lock the session before the set, in the same order as session patches, so the two
 * cannot deadlock. Returns the locked set row (if any) and its owner's session.
 */
async function lockSetAndSession(
  tx: Tx,
  userId: string,
  id: string,
  sessionId?: string,
): Promise<{ set: SetLogRow | undefined; session: SessionRow }> {
  const current = await findSetRow(tx, id);
  if (current && sessionId && current.sessionId !== sessionId) throw notFound();
  const targetSession = current?.sessionId ?? sessionId;
  if (!targetSession) throw notFound();
  const session = await lockOwnSession(tx, userId, targetSession);
  const set = current ? await lockSetRow(tx, id) : undefined;
  return { set, session };
}

/** Create or replace with a client id; a replay writes the same values again. */
export async function putSet(
  userId: string,
  id: string,
  input: PutSetInput,
  db: Executor = getDb(),
): Promise<SetLog> {
  await db.transaction(async (tx) => {
    const { session } = await lockSetAndSession(tx, userId, id, input.sessionId);
    if (session.status !== SESSION_STATUS.IN_PROGRESS) throw notInProgress();
    assertNotFuture(input.completedAt, ['completedAt']);
    const trackingType = trackingTypeOf(session, input.sessionExerciseId, input.exerciseId);
    assertSetValues(trackingType, input);
    await softDeleteSetAtPosition(tx, {
      sessionId: input.sessionId,
      sessionExerciseId: input.sessionExerciseId,
      setIndex: input.setIndex,
      exceptId: id,
    });
    await upsertSetLog(tx, {
      id,
      sessionId: input.sessionId,
      sessionExerciseId: input.sessionExerciseId,
      exerciseId: input.exerciseId,
      setIndex: input.setIndex,
      weightKg: input.weightKg === null ? null : String(input.weightKg),
      reps: input.reps,
      durationSec: input.durationSec,
      distanceM: input.distanceM,
      completedAt: new Date(input.completedAt),
    });
  });
  return readSet(db, id);
}

export async function patchSet(
  userId: string,
  id: string,
  input: PatchSetInput,
  db: Executor = getDb(),
): Promise<SetLog> {
  await db.transaction(async (tx) => {
    const { set, session } = await lockSetAndSession(tx, userId, id);
    if (!set || set.deletedAt) throw notFound();
    if (session.status !== SESSION_STATUS.IN_PROGRESS) throw notInProgress();
    const trackingType = trackingTypeOf(session, set.sessionExerciseId, set.exerciseId);
    const current = toSetLog(set);
    const merged: SetValues = {
      weightKg: input.weightKg !== undefined ? input.weightKg : current.weightKg,
      reps: input.reps !== undefined ? input.reps : current.reps,
      durationSec: input.durationSec !== undefined ? input.durationSec : current.durationSec,
      distanceM: input.distanceM !== undefined ? input.distanceM : current.distanceM,
    };
    assertSetValues(trackingType, merged);
    const fields: Parameters<typeof updateSetColumns>[2] = {};
    if (input.weightKg !== undefined) {
      fields.weightKg = input.weightKg === null ? null : String(input.weightKg);
    }
    if (input.reps !== undefined) fields.reps = input.reps;
    if (input.durationSec !== undefined) fields.durationSec = input.durationSec;
    if (input.distanceM !== undefined) fields.distanceM = input.distanceM;
    await updateSetColumns(tx, id, fields);
  });
  return readSet(db, id);
}

/** A repeat of a delete is a no-op, so retries are safe. */
export async function deleteSet(userId: string, id: string, db: Executor = getDb()): Promise<void> {
  await db.transaction(async (tx) => {
    const { set, session } = await lockSetAndSession(tx, userId, id);
    if (!set) throw notFound();
    if (set.deletedAt) return;
    if (session.status !== SESSION_STATUS.IN_PROGRESS) throw notInProgress();
    await softDeleteSetLog(tx, id);
  });
}

export async function getLastPerformance(
  userId: string,
  exerciseId: string,
  db: Executor = getDb(),
): Promise<LastPerformanceResponse> {
  const [result] = await listLastPerformance(userId, [exerciseId], db);
  return result?.item ? { item: result.item, bests: result.bests } : { item: null, bests: null };
}

/** "Last time" and all-time bests of several exercises, in a constant number of queries. */
export async function listLastPerformance(
  userId: string,
  exerciseIds: readonly string[],
  db: Executor = getDb(),
): Promise<SyncLastPerformance[]> {
  const ids = [...new Set(exerciseIds)];
  const rows = await findLastPerformanceRowsFor(db, userId, ids);
  const withSets = [...new Set(rows.map((row) => row.exercise_id))];
  const bests = await findBestsFor(db, userId, withSets);
  return ids.map((exerciseId) => {
    const own = rows.filter((row) => row.exercise_id === exerciseId);
    const [first] = own;
    if (!first) return { exerciseId, item: null, bests: null };
    return {
      exerciseId,
      bests: bests.get(exerciseId) ?? null,
      item: {
        sessionId: first.session_id,
        finishedAt: iso(first.finished_at),
        sets: own.map((row) => ({
          setIndex: row.set_index,
          weightKg: toNumber(row.weight_kg),
          reps: row.reps,
          durationSec: row.duration_sec,
          distanceM: row.distance_m,
        })),
      },
    };
  });
}
