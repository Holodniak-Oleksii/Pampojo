import { sessionPath, setPath } from '@/api/sessions';
import { REST, SESSION_SETS_MAX, SESSION_STATUS } from '@/constants/session';
import type {
  PatchSessionInput,
  PatchSetInput,
  PutSessionInput,
  PutSetInput,
  Session,
  SessionExercise,
  SetValues,
  WorkoutSnapshot,
} from '@/shared/schemas/session';
import type { LocalSession, LocalSetLog, PampojoDb } from './db';
import { enqueue, notifyOutbox } from './outbox';

export interface StartSessionInput {
  id: string;
  workoutId: string;
  workoutSnapshot: WorkoutSnapshot;
  exercises: SessionExercise[];
  startedAt: string;
  /** Today's planned date this start fulfils, or null. */
  scheduledFor: string | null;
}

export interface LogSetInput {
  sessionId: string;
  entryId: string;
  setIndex: number;
  values: SetValues;
  /** Rest length to start after the set. */
  restSec: number;
}

export const draftKey = (entryId: string, setIndex: number) => `${entryId}:${setIndex}`;

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Session writes for the device. Each one updates the local tables and appends its outbox entry
 * in one Dexie transaction, then wakes the outbox runner (ADR 0005, amended for spec 10).
 */
export function createSessionRepository(db: PampojoDb) {
  async function write<T>(fn: () => Promise<T>): Promise<T> {
    const result = await db.transaction('rw', [db.sessions, db.setLogs, db.outbox], fn);
    notifyOutbox();
    return result;
  }

  async function mustGet(sessionId: string): Promise<LocalSession> {
    const session = await db.sessions.get(sessionId);
    if (!session) throw new Error(`Unknown local session ${sessionId}`);
    return session;
  }

  async function patch(sessionId: string, body: PatchSessionInput, local: Partial<LocalSession>) {
    await db.sessions.update(sessionId, { ...local, updatedAt: nowIso() });
    await enqueue(db, { method: 'PATCH', path: sessionPath(sessionId), body });
  }

  return {
    async start(input: StartSessionInput): Promise<void> {
      const body: PutSessionInput = {
        workoutId: input.workoutId,
        workoutSnapshot: input.workoutSnapshot,
        exercises: input.exercises,
        startedAt: input.startedAt,
        scheduledFor: input.scheduledFor,
      };
      await write(async () => {
        await db.sessions.put({
          id: input.id,
          workoutId: input.workoutId,
          workoutSnapshot: input.workoutSnapshot,
          exercises: input.exercises,
          scheduledFor: input.scheduledFor,
          status: SESSION_STATUS.IN_PROGRESS,
          startedAt: input.startedAt,
          finishedAt: null,
          notes: null,
          updatedAt: input.startedAt,
          restEndsAt: null,
          restDurationSec: REST.defaultSec,
          restSetId: null,
          currentEntryId: input.exercises[0]?.id ?? null,
          drafts: {},
        });
        await enqueue(db, { method: 'PUT', path: sessionPath(input.id), body });
      });
    },

    /** Reuses the id of a set logged before at this position, so the server revives the same row. */
    async logSet(input: LogSetInput): Promise<LocalSetLog> {
      return write(async () => {
        const session = await mustGet(input.sessionId);
        const entry = session.exercises.find((item) => item.id === input.entryId);
        if (!entry) throw new Error(`Unknown session exercise ${input.entryId}`);
        const previous = await db.setLogs
          .where('[sessionId+sessionExerciseId+setIndex]')
          .equals([input.sessionId, input.entryId, input.setIndex])
          .first();
        const completedAt = nowIso();
        const set: LocalSetLog = {
          id: previous?.id ?? crypto.randomUUID(),
          sessionId: input.sessionId,
          sessionExerciseId: input.entryId,
          exerciseId: entry.exerciseId,
          setIndex: input.setIndex,
          ...input.values,
          completedAt,
          deletedAt: null,
        };
        await db.setLogs.put(set);
        const drafts = { ...session.drafts };
        delete drafts[draftKey(input.entryId, input.setIndex)];
        await db.sessions.update(input.sessionId, {
          drafts,
          restEndsAt: new Date(Date.now() + input.restSec * 1000).toISOString(),
          restDurationSec: input.restSec,
          restSetId: set.id,
        });
        const body: PutSetInput = {
          sessionId: set.sessionId,
          sessionExerciseId: set.sessionExerciseId,
          exerciseId: set.exerciseId,
          setIndex: set.setIndex,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSec: set.durationSec,
          distanceM: set.distanceM,
          completedAt,
        };
        await enqueue(db, { method: 'PUT', path: setPath(set.id), body });
        return set;
      });
    },

    async editSet(setId: string, values: PatchSetInput): Promise<void> {
      await write(async () => {
        await db.setLogs.update(setId, values);
        await enqueue(db, { method: 'PATCH', path: setPath(setId), body: values });
      });
    },

    async unlogSet(setId: string): Promise<void> {
      await write(async () => {
        const set = await db.setLogs.get(setId);
        if (!set) return;
        await db.setLogs.update(setId, { deletedAt: nowIso() });
        const session = await db.sessions.get(set.sessionId);
        if (session) {
          // The row keeps the values it had when it was logged.
          const drafts = {
            ...session.drafts,
            [draftKey(set.sessionExerciseId, set.setIndex)]: {
              weightKg: set.weightKg,
              reps: set.reps,
              durationSec: set.durationSec,
              distanceM: set.distanceM,
            },
          };
          const stopRest = session.restSetId === setId;
          await db.sessions.update(set.sessionId, {
            drafts,
            ...(stopRest ? { restEndsAt: null, restSetId: null } : {}),
          });
        }
        await enqueue(db, { method: 'DELETE', path: setPath(setId) });
      });
    },

    async setDraft(sessionId: string, key: string, values: SetValues): Promise<void> {
      const session = await mustGet(sessionId);
      await db.sessions.update(sessionId, { drafts: { ...session.drafts, [key]: values } });
    },

    async updatePlan(sessionId: string, exercises: SessionExercise[]): Promise<void> {
      await write(async () => {
        const session = await mustGet(sessionId);
        const currentEntryId = exercises.some((item) => item.id === session.currentEntryId)
          ? session.currentEntryId
          : (exercises[0]?.id ?? null);
        await patch(sessionId, { exercises }, { exercises, currentEntryId });
      });
    },

    /** Reads the stored count, so quick taps add up instead of reusing a stale render. */
    async changePlannedSets(sessionId: string, entryId: string, delta: number): Promise<void> {
      await write(async () => {
        const session = await mustGet(sessionId);
        let changed = false;
        const exercises = session.exercises.map((item) => {
          if (item.id !== entryId) return item;
          const plannedSets = Math.min(SESSION_SETS_MAX, Math.max(1, item.plannedSets + delta));
          changed = plannedSets !== item.plannedSets;
          return { ...item, plannedSets };
        });
        if (changed) await patch(sessionId, { exercises }, { exercises });
      });
    },

    /** Moves the running rest by `deltaSec` within the allowed lengths; returns the new length. */
    async adjustRest(sessionId: string, deltaSec: number): Promise<number | null> {
      return db.transaction('rw', db.sessions, async () => {
        const session = await mustGet(sessionId);
        if (!session.restEndsAt) return null;
        const durationSec = Math.min(
          REST.maxSec,
          Math.max(REST.minSec, session.restDurationSec + deltaSec),
        );
        const applied = durationSec - session.restDurationSec;
        if (applied === 0) return null;
        await db.sessions.update(sessionId, {
          restEndsAt: new Date(
            new Date(session.restEndsAt).getTime() + applied * 1000,
          ).toISOString(),
          restDurationSec: durationSec,
        });
        return durationSec;
      });
    },

    async setCurrent(sessionId: string, entryId: string): Promise<void> {
      await db.sessions.update(sessionId, { currentEntryId: entryId });
    },

    async setRest(sessionId: string, rest: { endsAt: string; durationSec: number }): Promise<void> {
      await db.sessions.update(sessionId, {
        restEndsAt: rest.endsAt,
        restDurationSec: rest.durationSec,
      });
    },

    async clearRest(sessionId: string): Promise<void> {
      await db.sessions.update(sessionId, { restEndsAt: null, restSetId: null });
    },

    async setNote(sessionId: string, notes: string | null): Promise<void> {
      await write(() => patch(sessionId, { notes }, { notes }));
    },

    async finish(sessionId: string, finishedAt: string): Promise<void> {
      await write(async () => {
        await patch(
          sessionId,
          { status: SESSION_STATUS.COMPLETED, finishedAt },
          { status: SESSION_STATUS.COMPLETED, finishedAt, restEndsAt: null, restSetId: null },
        );
      });
      await rememberLastPerformance(db, sessionId);
    },

    async abandon(sessionId: string): Promise<void> {
      await write(async () => {
        const deletedAt = nowIso();
        await db.setLogs
          .where('sessionId')
          .equals(sessionId)
          .modify((set) => {
            set.deletedAt ??= deletedAt;
          });
        await patch(
          sessionId,
          { status: SESSION_STATUS.ABANDONED },
          { status: SESSION_STATUS.ABANDONED, finishedAt: deletedAt, restEndsAt: null },
        );
      });
    },

    /** Brings a session that only the server has (another device, a cleared device) onto this one. */
    async importRemote(session: Session): Promise<void> {
      await db.transaction('rw', [db.sessions, db.setLogs], async () => {
        const existing = await db.sessions.get(session.id);
        const { setLogs, ...rest } = session;
        await db.sessions.put({
          ...rest,
          restEndsAt: existing?.restEndsAt ?? null,
          restDurationSec: existing?.restDurationSec ?? REST.defaultSec,
          restSetId: existing?.restSetId ?? null,
          currentEntryId: existing?.currentEntryId ?? session.exercises[0]?.id ?? null,
          drafts: existing?.drafts ?? {},
        });
        await db.setLogs.bulkPut(setLogs.map((set) => ({ ...set, deletedAt: null })));
      });
    },

    findInProgress(): Promise<LocalSession | undefined> {
      return db.sessions.where('status').equals(SESSION_STATUS.IN_PROGRESS).last();
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;

/** After a finish, the session's sets become "last time" for its exercises, also offline. */
async function rememberLastPerformance(db: PampojoDb, sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session?.finishedAt) return;
  const sets = (await db.setLogs.where('sessionId').equals(sessionId).toArray()).filter(
    (set) => set.deletedAt === null,
  );
  const byExercise = new Map<string, LocalSetLog[]>();
  for (const set of sets) {
    byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  }
  const fetchedAt = nowIso();
  await db.lastPerformance.bulkPut(
    [...byExercise.entries()].map(([exerciseId, items]) => ({
      exerciseId,
      sessionId,
      finishedAt: session.finishedAt as string,
      fetchedAt,
      sets: items
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.setIndex - b.setIndex)
        .map((set) => ({
          setIndex: set.setIndex,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSec: set.durationSec,
          distanceM: set.distanceM,
        })),
    })),
  );
}
