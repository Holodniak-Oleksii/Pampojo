import type { TrackingType } from '@/constants/exercise';
import {
  DEFAULT_PLANNED_SETS,
  FORGOTTEN_AFTER_MS,
  MAIN_METRIC,
  SESSION_STATUS,
  SET_FIELDS,
  SET_VALUE_FIELDS,
  type SetValueField,
} from '@/constants/session';
import { TARGET_DEFAULTS } from '@/constants/workout';
import type { ExerciseListItem } from '@/shared/schemas/exercise';
import type {
  LastPerformance,
  SessionExercise,
  SetLog,
  SetValues,
  WorkoutSnapshot,
} from '@/shared/schemas/session';
import type { Workout } from '@/shared/schemas/workout';

export const EMPTY_VALUES: SetValues = {
  weightKg: null,
  reps: null,
  durationSec: null,
  distanceM: null,
};

function targetValue(entry: SessionExercise, field: SetValueField): number | null {
  switch (field) {
    case 'weightKg':
      return entry.targetWeightKg;
    case 'reps':
      return entry.targetRepsMin;
    case 'durationSec':
      return entry.targetDurationSec;
    case 'distanceM':
      return entry.targetDistanceM;
  }
}

/**
 * Row N takes set N of the last time (by order), else the targets; fields the tracking type does
 * not use stay empty.
 */
export function prefillRow(
  entry: SessionExercise,
  setIndex: number,
  last: LastPerformance | null | undefined,
): SetValues {
  const fields: readonly SetValueField[] = SET_FIELDS[entry.exercise.trackingType];
  const previous = last?.sets[setIndex];
  const values = { ...EMPTY_VALUES };
  for (const field of fields) {
    values[field] = previous ? previous[field] : targetValue(entry, field);
  }
  return values;
}

export function canLog(trackingType: TrackingType, values: SetValues): boolean {
  return values[MAIN_METRIC[trackingType]] !== null;
}

/** Keeps only the fields the tracking type uses. */
export function onlyFields(trackingType: TrackingType, values: SetValues): SetValues {
  const fields: readonly SetValueField[] = SET_FIELDS[trackingType];
  const result = { ...EMPTY_VALUES };
  for (const field of SET_VALUE_FIELDS) if (fields.includes(field)) result[field] = values[field];
  return result;
}

export function logsOf<T extends SetLog>(entryId: string, logs: readonly T[]): Map<number, T> {
  return new Map(
    logs.filter((log) => log.sessionExerciseId === entryId).map((log) => [log.setIndex, log]),
  );
}

export function loggedCount(entry: SessionExercise, logs: readonly SetLog[]): number {
  return logs.filter((log) => log.sessionExerciseId === entry.id).length;
}

export function isEntryDone(entry: SessionExercise, logs: readonly SetLog[]): boolean {
  return loggedCount(entry, logs) >= entry.plannedSets;
}

/** The first row of the entry without a logged set, or `null` when every row is logged. */
export function firstOpenRow(entry: SessionExercise, logs: readonly SetLog[]): number | null {
  const logged = logsOf(entry.id, logs);
  for (let index = 0; index < entry.plannedSets; index++) if (!logged.has(index)) return index;
  return null;
}

/** The next exercise after `fromId` (wrapping) that still has unlogged rows. */
export function nextEntryWithWork(
  exercises: readonly SessionExercise[],
  logs: readonly SetLog[],
  fromId: string | null,
): SessionExercise | null {
  const start = Math.max(
    0,
    exercises.findIndex((item) => item.id === fromId),
  );
  for (let step = 1; step <= exercises.length; step++) {
    const entry = exercises[(start + step) % exercises.length];
    if (entry && !isEntryDone(entry, logs)) return entry;
  }
  return null;
}

export type SummaryResult =
  | { kind: 'weight'; value: number }
  | { kind: 'duration'; value: number }
  | { kind: 'distance'; value: number }
  | { kind: 'reps'; value: number };

export interface SummaryRow {
  entryId: string;
  name: string;
  count: number;
  result: SummaryResult | null;
}

export interface SessionSummaryData {
  durationSec: number;
  volumeKg: number;
  sets: number;
  exercises: number;
  rows: SummaryRow[];
}

function maxOf(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? Math.max(...present) : null;
}

function resultOf(logs: SetLog[]): SummaryResult | null {
  const weight = maxOf(logs.map((log) => log.weightKg));
  if (weight !== null) return { kind: 'weight', value: weight };
  const duration = maxOf(logs.map((log) => log.durationSec));
  if (duration !== null) return { kind: 'duration', value: duration };
  const distance = maxOf(logs.map((log) => log.distanceM));
  if (distance !== null) return { kind: 'distance', value: distance };
  const reps = maxOf(logs.map((log) => log.reps));
  return reps === null ? null : { kind: 'reps', value: reps };
}

export function summaryOf(
  session: { exercises: SessionExercise[]; startedAt: string; finishedAt: string | null },
  logs: readonly SetLog[],
): SessionSummaryData {
  const end = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now();
  const rows: SummaryRow[] = [];
  let volumeKg = 0;
  for (const entry of session.exercises) {
    const entryLogs = logs.filter((log) => log.sessionExerciseId === entry.id);
    if (entryLogs.length === 0) continue;
    if (entry.exercise.trackingType === 'weight_reps') {
      for (const log of entryLogs) {
        if (log.weightKg !== null && log.reps !== null) volumeKg += log.weightKg * log.reps;
      }
    }
    rows.push({
      entryId: entry.id,
      name: entry.exercise.name,
      count: entryLogs.length,
      result: resultOf(entryLogs),
    });
  }
  return {
    durationSec: Math.max(0, Math.round((end - new Date(session.startedAt).getTime()) / 1000)),
    volumeKg: Math.round(volumeKg * 100) / 100,
    sets: rows.reduce((sum, row) => sum + row.count, 0),
    exercises: rows.length,
    rows,
  };
}

export interface RestState {
  /** Whole seconds left, rounded up; 0 once the rest is over. */
  remainingSec: number;
  over: boolean;
  /** Whole seconds past the end. */
  overSec: number;
  /** Share of the rest still left, 1 → 0. */
  progress: number;
}

export function restState(restEndsAt: string, durationSec: number, now: number): RestState {
  const remainingMs = new Date(restEndsAt).getTime() - now;
  const over = remainingMs <= 0;
  return {
    remainingSec: over ? 0 : Math.ceil(remainingMs / 1000),
    over,
    overSec: over ? Math.floor(-remainingMs / 1000) : 0,
    progress: over ? 0 : Math.min(1, remainingMs / (durationSec * 1000)),
  };
}

export function isForgotten(session: { status: string; startedAt: string }, now: number): boolean {
  return (
    session.status === SESSION_STATUS.IN_PROGRESS &&
    now - new Date(session.startedAt).getTime() > FORGOTTEN_AFTER_MS
  );
}

/** A forgotten session ends at its last logged set, or at its start when nothing was logged. */
export function forgottenFinishedAt(startedAt: string, logs: readonly SetLog[]): string {
  return logs.reduce(
    (latest, log) => (log.completedAt > latest ? log.completedAt : latest),
    startedAt,
  );
}

const snapshotInfo = (exercise: Workout['exercises'][number]['exercise']) => ({
  id: exercise.id,
  name: exercise.name,
  trackingType: exercise.trackingType,
  laterality: exercise.laterality,
  thumbnailUrl: exercise.thumbnailUrl,
});

export function buildSessionFromWorkout(
  workout: Workout,
  newId: () => string = () => crypto.randomUUID(),
): { workoutSnapshot: WorkoutSnapshot; exercises: SessionExercise[] } {
  const workoutSnapshot: WorkoutSnapshot = {
    workoutId: workout.id,
    name: workout.name,
    description: workout.description,
    exercises: workout.exercises.map((item) => ({
      id: item.id,
      exerciseId: item.exerciseId,
      targetSets: item.targetSets,
      targetRepsMin: item.targetRepsMin,
      targetRepsMax: item.targetRepsMax,
      targetWeightKg: item.targetWeightKg,
      targetDurationSec: item.targetDurationSec,
      targetDistanceM: item.targetDistanceM,
      notes: item.notes,
      exercise: snapshotInfo(item.exercise),
    })),
  };
  const exercises: SessionExercise[] = workoutSnapshot.exercises.map((item) => ({
    ...item,
    id: newId(),
    plannedSets: item.targetSets ?? DEFAULT_PLANNED_SETS,
  }));
  return { workoutSnapshot, exercises };
}

/** An exercise added during the session gets the builder defaults and no weight. */
export function entryFromCatalog(
  item: ExerciseListItem,
  newId: () => string = () => crypto.randomUUID(),
): SessionExercise {
  const defaults: Partial<Record<string, number>> = TARGET_DEFAULTS[item.trackingType];
  const targetSets = defaults.targetSets ?? null;
  return {
    id: newId(),
    exerciseId: item.id,
    plannedSets: targetSets ?? DEFAULT_PLANNED_SETS,
    targetSets,
    targetRepsMin: defaults.targetRepsMin ?? null,
    targetRepsMax: defaults.targetRepsMax ?? null,
    targetWeightKg: null,
    targetDurationSec: defaults.targetDurationSec ?? null,
    targetDistanceM: null,
    notes: null,
    exercise: {
      id: item.id,
      name: item.name,
      trackingType: item.trackingType,
      laterality: item.laterality,
      thumbnailUrl: item.thumbnailUrl,
    },
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `m:ss` under an hour, else `h:mm:ss`. */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** Always `h:mm:ss`, so the elapsed time does not change width at the hour. */
export function formatElapsed(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(sec / 3600)}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
}

/** Distance is entered in km when the target is at least a kilometre. */
export function distanceInKm(entry: SessionExercise): boolean {
  return (entry.targetDistanceM ?? 0) >= 1000;
}
