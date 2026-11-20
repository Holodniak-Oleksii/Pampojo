import 'server-only';
import {
  DIFFICULTIES,
  EQUIPMENT_LIST,
  LATERALITY,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUPS,
  type Difficulty,
  type Equipment,
  type Laterality,
  type Mechanic,
  type MovementPattern,
  type MuscleGroup,
} from '@/constants/exercise';
import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';
import { MEASUREMENT_TYPE, type MeasurementType } from '@/constants/measurement';
import type { SessionStatus } from '@/constants/session';
import {
  SYNC_PHASES,
  SYNC_PULL_OVERLAP_MS,
  SYNC_PULL_PAGE_ROWS,
  type SyncPhase,
} from '@/constants/sync';
import { LOCALES, type Locale } from '@/i18n/config';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import { resolveFrames } from '@/server/exercises/media';
import { knownTrackingType, only, orNull } from '@/server/exercises/service';
import { findGym } from '@/server/gym/service';
import { DomainError } from '@/server/http/errors';
import { findProfileRow } from '@/server/profile/queries';
import { findProfile } from '@/server/profile/service';
import { listLastPerformance } from '@/server/sessions/service';
import type { SessionExercise, WorkoutSnapshot } from '@/shared/schemas/session';
import type { PullResponse, SyncChanges, SyncExercise, SyncTotals } from '@/shared/schemas/sync';
import { sessionWindowStart } from '@/shared/sync-window';
import {
  decodePullCursor,
  encodeDoneCursor,
  encodeRunCursor,
  type PullAfter,
  type PullRun,
} from './cursor';
import {
  databaseNow,
  gymChanged,
  lowerBound,
  profileChanged,
  pullExercises,
  pullLastPerformanceIds,
  pullMeasurements,
  pullRules,
  pullSessions,
  pullSetLogs,
  pullTranslations,
  pullWorkoutExercises,
  pullWorkouts,
  type ExercisePullRow,
  type PullRange,
} from './pull-queries';
import type { Executor } from './queries';

const iso = (value: Date | string) =>
  (value instanceof Date ? value : new Date(value)).toISOString();
const isoOrNull = (value: Date | string | null) => (value === null ? null : iso(value));
const num = (value: string | null) => (value === null ? null : Number(value));

function emptyChanges(): SyncChanges {
  return {
    profile: null,
    gym: null,
    gymChanged: false,
    workouts: [],
    scheduleRules: [],
    exercises: [],
    lastPerformance: [],
    sessions: [],
    setLogs: [],
    measurements: [],
  };
}

async function toSyncExercises(
  db: Executor,
  rows: readonly ExercisePullRow[],
  userId: string,
): Promise<SyncExercise[]> {
  const translations = await pullTranslations(
    db,
    rows.map((row) => row.id),
  );
  const frames = await resolveFrames(rows);
  return rows.map((row, index) => ({
    id: row.id,
    isOwn: row.owner_id === userId,
    primaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, row.primary_muscles),
    secondaryMuscles: only<MuscleGroup>(MUSCLE_GROUPS, row.secondary_muscles),
    equipment: only<Equipment>(EQUIPMENT_LIST, row.equipment),
    movementPattern: orNull<MovementPattern>(Object.values(MOVEMENT_PATTERN), row.movement_pattern),
    mechanic: orNull<Mechanic>(Object.values(MECHANIC), row.mechanic),
    laterality: orNull<Laterality>(Object.values(LATERALITY), row.laterality),
    trackingType: knownTrackingType(row.tracking_type),
    difficulty: orNull<Difficulty>(DIFFICULTIES, row.difficulty),
    popularity: row.popularity,
    frames: frames[index] ?? [],
    gymEquipment: row.gym_equipment
      .map((group) => only<GymEquipment>(GYM_EQUIPMENT_KEYS, group))
      .filter((group) => group.length > 0),
    sourceExerciseId: row.source_exercise_id,
    updatedAt: iso(row.updated_at),
    deletedAt: isoOrNull(row.deleted_at),
    translations: translations
      .filter((item) => item.exercise_id === row.id)
      .flatMap((item) =>
        (LOCALES as readonly string[]).includes(item.locale)
          ? [
              {
                locale: item.locale as Locale,
                name: item.name,
                aliases: item.aliases,
                description: item.description,
                instructions: item.instructions,
                commonMistakes: item.common_mistakes,
                searchName: item.search_name,
                searchAliases: item.search_aliases,
              },
            ]
          : [],
      ),
  }));
}

interface PhaseResult {
  /** Rows for the page, at most `limit`. */
  count: number;
  /** The key of the last row when the phase has more rows than `limit`. */
  more: PullAfter | null;
}

type PhaseFn = (
  db: Executor,
  range: PullRange,
  after: PullAfter | null,
  limit: number,
  changes: SyncChanges,
) => Promise<PhaseResult>;

/** Takes `limit` rows of a query that asked for `limit + 1`, and tells whether more exist. */
function page<T extends { id: string; cursor_at: string | null }>(
  rows: T[],
  limit: number,
): { rows: T[]; more: PullAfter | null } {
  if (rows.length <= limit) return { rows, more: null };
  const kept = rows.slice(0, limit);
  const last = kept.at(-1);
  return { rows: kept, more: last ? { at: last.cursor_at, id: last.id } : null };
}

const PHASES: Record<SyncPhase, PhaseFn> = {
  async profile(db, range, _after, _limit, changes) {
    if (range.low !== null && !(await profileChanged(db, range))) return { count: 0, more: null };
    changes.profile = await findProfile(range.userId, db);
    return { count: 1, more: null };
  },
  async gym(db, range, _after, _limit, changes) {
    if (range.low !== null && !(await gymChanged(db, range))) return { count: 0, more: null };
    changes.gym = await findGym(range.userId, db);
    changes.gymChanged = true;
    return { count: 1, more: null };
  },
  async workouts(db, range, after, limit, changes) {
    const { rows, more } = page(await pullWorkouts(db, range, after, limit + 1), limit);
    const exercises = await pullWorkoutExercises(
      db,
      rows.map((row) => row.id),
    );
    for (const row of rows) {
      changes.workouts.push({
        id: row.id,
        name: row.name,
        description: row.description,
        updatedAt: iso(row.updated_at),
        deletedAt: isoOrNull(row.deleted_at),
        exercises: exercises
          .filter((item) => item.workout_id === row.id)
          .map((item) => ({
            id: item.id,
            exerciseId: item.exercise_id,
            targetSets: item.target_sets,
            targetRepsMin: item.target_reps_min,
            targetRepsMax: item.target_reps_max,
            targetWeightKg: num(item.target_weight_kg),
            targetDurationSec: item.target_duration_sec,
            targetDistanceM: item.target_distance_m,
            notes: item.notes,
          })),
      });
    }
    return { count: rows.length, more };
  },
  async scheduleRules(db, range, after, limit, changes) {
    const { rows, more } = page(await pullRules(db, range, after, limit + 1), limit);
    for (const row of rows) {
      changes.scheduleRules.push({
        id: row.id,
        workoutId: row.workout_id,
        startDate: row.start_date,
        endDate: row.end_date,
        weekdays: row.weekdays,
        intervalWeeks: row.interval_weeks,
        updatedAt: iso(row.updated_at),
        deletedAt: isoOrNull(row.deleted_at),
      });
    }
    return { count: rows.length, more };
  },
  async exercises(db, range, after, limit, changes) {
    const { rows, more } = page(await pullExercises(db, range, after, limit + 1), limit);
    changes.exercises.push(...(await toSyncExercises(db, rows, range.userId)));
    return { count: rows.length, more };
  },
  async lastPerformance(db, range, after, limit, changes) {
    const ids = await pullLastPerformanceIds(db, range, after, limit + 1);
    const kept = ids.slice(0, limit);
    const last = kept.at(-1);
    changes.lastPerformance.push(...(await listLastPerformance(range.userId, kept, db)));
    return { count: kept.length, more: ids.length > limit && last ? { at: null, id: last } : null };
  },
  async sessions(db, range, after, limit, changes) {
    const { rows, more } = page(await pullSessions(db, range, after, limit + 1), limit);
    for (const row of rows) {
      changes.sessions.push({
        id: row.id,
        workoutId: row.workout_id,
        workoutSnapshot: row.workout_snapshot as WorkoutSnapshot,
        exercises: row.exercises as SessionExercise[],
        scheduledFor: row.scheduled_for,
        status: row.status as SessionStatus,
        startedAt: iso(row.started_at),
        finishedAt: isoOrNull(row.finished_at),
        notes: row.notes,
        updatedAt: iso(row.updated_at),
      });
    }
    return { count: rows.length, more };
  },
  async setLogs(db, range, after, limit, changes) {
    const { rows, more } = page(await pullSetLogs(db, range, after, limit + 1), limit);
    for (const row of rows) {
      changes.setLogs.push({
        id: row.id,
        sessionId: row.session_id,
        sessionExerciseId: row.session_exercise_id,
        exerciseId: row.exercise_id,
        setIndex: row.set_index,
        weightKg: num(row.weight_kg),
        reps: row.reps,
        durationSec: row.duration_sec,
        distanceM: row.distance_m,
        completedAt: iso(row.completed_at),
        deletedAt: isoOrNull(row.deleted_at),
      });
    }
    return { count: rows.length, more };
  },
  async measurements(db, range, after, limit, changes) {
    const { rows, more } = page(await pullMeasurements(db, range, after, limit + 1), limit);
    for (const row of rows) {
      changes.measurements.push({
        id: row.id,
        type: orNull<MeasurementType>(Object.values(MEASUREMENT_TYPE), row.type) ?? 'weight',
        value: Number(row.value),
        measuredOn: row.measured_on,
        updatedAt: iso(row.updated_at),
        deletedAt: isoOrNull(row.deleted_at),
      });
    }
    return { count: rows.length, more };
  },
};

const UNLIMITED = 1_000_000;

function countOf(changes: SyncChanges): SyncTotals {
  return {
    workouts: changes.workouts.length,
    scheduleRules: changes.scheduleRules.length,
    exercises: changes.exercises.length,
    lastPerformance: changes.lastPerformance.length,
    sessions: changes.sessions.length,
    setLogs: changes.setLogs.length,
    measurements: changes.measurements.length,
  };
}

/** Row counts of a full download, for the progress of the download screen. */
async function countFull(db: Executor, range: PullRange): Promise<SyncTotals> {
  const totals: Partial<SyncTotals> = {};
  for (const phase of [
    'workouts',
    'scheduleRules',
    'exercises',
    'lastPerformance',
    'sessions',
    'setLogs',
    'measurements',
  ] as const) {
    const changes = emptyChanges();
    // Counting through the phase keeps one definition of "the rows of a full download".
    totals[phase] = (await PHASES[phase](db, range, null, UNLIMITED, changes)).count;
  }
  return totals as SyncTotals;
}

async function startRun(db: Executor, since: string | undefined): Promise<PullRun> {
  const high = await databaseNow(db);
  if (since === undefined) return { v: 1, low: null, high, phase: 0, after: null };
  const decoded = decodePullCursor(since);
  if (decoded.kind === 'run') return decoded.run;
  return {
    v: 1,
    low: await lowerBound(db, decoded.high, SYNC_PULL_OVERLAP_MS),
    high,
    phase: 0,
    after: null,
  };
}

/**
 * One page of changes. A run walks the phases in download order; `nextCursor` continues the run,
 * and `cursor` on the last page starts the next run with a 30-second overlap.
 */
export async function pullChanges(
  userId: string,
  since: string | undefined,
  db: Executor = getDb(),
): Promise<PullResponse> {
  const profile = await findProfileRow(db, userId);
  if (!profile) throw new DomainError('PROFILE_NOT_FOUND', 'Profile not found');
  const run = await startRun(db, since);
  const range: PullRange = {
    userId,
    low: run.low,
    high: run.high,
    windowStart: sessionWindowStart(todayIn(profile.timeZone)),
  };
  const isFirstFullPage = run.low === null && run.phase === 0 && run.after === null;

  const changes = emptyChanges();
  let remaining = SYNC_PULL_PAGE_ROWS;
  let after = run.after;
  for (let index = run.phase; index < SYNC_PHASES.length; index += 1) {
    const phase = SYNC_PHASES[index] as SyncPhase;
    const result = await PHASES[phase](db, range, after, remaining, changes);
    remaining -= result.count;
    after = null;
    if (result.more || (remaining <= 0 && index < SYNC_PHASES.length - 1)) {
      const next: PullRun = result.more
        ? { ...run, phase: index, after: result.more }
        : { ...run, phase: index + 1, after: null };
      const totals = isFirstFullPage ? await countFull(db, range) : undefined;
      return { changes, nextCursor: encodeRunCursor(next), cursor: null, totals };
    }
  }
  // A download that fits one page counts its own rows, so it runs no second set of queries.
  const totals = isFirstFullPage ? countOf(changes) : undefined;
  return { changes, nextCursor: null, cursor: encodeDoneCursor(run.high), totals };
}
