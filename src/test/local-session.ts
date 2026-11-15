import Dexie from 'dexie';
import { closeLocalDbs, LOCAL_DB_PREFIX } from '@/services/local-db/db';
import type { LocalSession, LocalSetLog } from '@/services/local-db';
import { openLocalDb } from '@/services/local-db';
import type { SessionExercise } from '@/shared/schemas/session';
import { TEST_USER_ID } from './render';

export const BENCH_ID = '00000000-0000-4000-8000-0000000000a1';
export const PLANK_ID = '00000000-0000-4000-8000-0000000000a2';
export const WORKOUT_ID = '00000000-0000-4000-8000-0000000000b1';

const targets = {
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: null,
  targetDurationSec: null,
  targetDistanceM: null,
  notes: null,
};

export function benchEntry(override: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: '00000000-0000-4000-8000-0000000000e1',
    exerciseId: BENCH_ID,
    plannedSets: 3,
    ...targets,
    exercise: {
      id: BENCH_ID,
      name: 'Bench Press',
      trackingType: 'weight_reps',
      laterality: 'bilateral',
      thumbnailUrl: null,
    },
    ...override,
  };
}

export function plankEntry(override: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: '00000000-0000-4000-8000-0000000000e2',
    exerciseId: PLANK_ID,
    plannedSets: 3,
    ...targets,
    targetRepsMin: null,
    targetRepsMax: null,
    targetDurationSec: 45,
    exercise: {
      id: PLANK_ID,
      name: 'Plank',
      trackingType: 'time',
      laterality: null,
      thumbnailUrl: null,
    },
    ...override,
  };
}

/** A local in-progress session for the test user, started ten minutes ago. */
export function localSession(override: Partial<LocalSession> = {}): LocalSession {
  const startedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const exercises = [benchEntry(), plankEntry()];
  return {
    id: '00000000-0000-4000-8000-0000000000c1',
    workoutId: WORKOUT_ID,
    workoutSnapshot: { workoutId: WORKOUT_ID, name: 'Push Day', description: null, exercises: [] },
    exercises,
    scheduledFor: null,
    status: 'in_progress',
    startedAt,
    finishedAt: null,
    notes: null,
    updatedAt: startedAt,
    restEndsAt: null,
    restDurationSec: 90,
    restSetId: null,
    currentEntryId: exercises[0]!.id,
    drafts: {},
    ...override,
  };
}

export function localSet(override: Partial<LocalSetLog> = {}): LocalSetLog {
  return {
    id: crypto.randomUUID(),
    sessionId: '00000000-0000-4000-8000-0000000000c1',
    sessionExerciseId: benchEntry().id,
    exerciseId: BENCH_ID,
    setIndex: 0,
    weightKg: 80,
    reps: 8,
    durationSec: null,
    distanceM: null,
    completedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    deletedAt: null,
    ...override,
  };
}

export async function seedLocal(
  session: LocalSession,
  sets: LocalSetLog[] = [],
  userId = TEST_USER_ID,
) {
  const db = openLocalDb(userId);
  await db.sessions.put(session);
  if (sets.length > 0) await db.setLogs.bulkPut(sets);
  return db;
}

export async function resetLocalDbs() {
  closeLocalDbs();
  const names = (await Dexie.getDatabaseNames()).filter((name) => name.startsWith(LOCAL_DB_PREFIX));
  await Promise.all(names.map((name) => Dexie.delete(name)));
}
