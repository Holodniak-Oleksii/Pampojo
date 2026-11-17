import {
  E1RM_REPS,
  PROGRESS_RANGE_MONTHS,
  RECORD_TYPE,
  RECORDS_BY_TRACKING,
} from '@/constants/progress';
import type { ProgressRange, RecordType } from '@/constants/progress';
import type { TrackingType } from '@/constants/exercise';
import { isoDate } from '@/lib/dates';
import type { Bests, NewRecord, PointValues, ProgressRecord } from '@/shared/schemas/progress';

export interface MetricSet {
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  distanceM: number | null;
}

export interface MetricSession {
  sessionId: string;
  date: string;
  sets: readonly MetricSet[];
}

const ALL_RECORDS: readonly RecordType[] = Object.values(RECORD_TYPE);

const recordsFor = (trackingType: TrackingType | null) =>
  trackingType ? RECORDS_BY_TRACKING[trackingType] : ALL_RECORDS;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Epley, only for 1–12 reps and a weight above 0, to 0.01 kg. */
export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || weightKg <= 0 || reps === null) return null;
  if (reps < E1RM_REPS.min || reps > E1RM_REPS.max) return null;
  // Rounded so that equal results compare as equal despite float noise.
  return round2(weightKg * (1 + reps / 30));
}

function maxOf(values: readonly (number | null)[]): number | null {
  let best: number | null = null;
  for (const value of values) if (value !== null && (best === null || value > best)) best = value;
  return best;
}

/** `Σ weight × reps` of the sets with a weight; null when no set has one. */
export function volumeOf(sets: readonly MetricSet[]): number | null {
  let total: number | null = null;
  for (const set of sets) {
    if (set.weightKg === null || set.reps === null) continue;
    total = (total ?? 0) + set.weightKg * set.reps;
  }
  return total === null ? null : round2(total);
}

const positiveWeight = (set: MetricSet) =>
  set.weightKg !== null && set.weightKg > 0 ? set.weightKg : null;

/** The chart values of one session; a value that does not apply to the tracking type is null. */
export function pointOf(trackingType: TrackingType, sets: readonly MetricSet[]): PointValues {
  const empty: PointValues = {
    topWeightKg: null,
    e1rmKg: null,
    volumeKg: null,
    reps: null,
    durationSec: null,
    distanceM: null,
  };
  switch (trackingType) {
    case 'weight_reps':
      return {
        ...empty,
        topWeightKg: maxOf(sets.map(positiveWeight)),
        e1rmKg: maxOf(sets.map((set) => estimateOneRepMax(set.weightKg, set.reps))),
        volumeKg: volumeOf(sets),
        reps: maxOf(sets.map((set) => set.reps)),
      };
    case 'reps':
      return { ...empty, reps: maxOf(sets.map((set) => set.reps)) };
    case 'time':
      return { ...empty, durationSec: maxOf(sets.map((set) => set.durationSec)) };
    case 'distance':
      return { ...empty, distanceM: maxOf(sets.map((set) => set.distanceM)) };
  }
}

interface Candidate {
  value: number;
  weightKg: number | null;
  reps: number | null;
  /** Compared left to right; a larger rank is a better result. */
  rank: readonly number[];
}

function isBetter(next: readonly number[], current: readonly number[] | undefined): boolean {
  if (!current) return true;
  for (let index = 0; index < next.length; index += 1) {
    const a = next[index] ?? 0;
    const b = current[index] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/** The best candidate of each record type inside one session. */
function sessionCandidates(
  trackingType: TrackingType | null,
  sets: readonly MetricSet[],
): Map<RecordType, Candidate> {
  const best = new Map<RecordType, Candidate>();
  const offer = (type: RecordType, candidate: Candidate | null) => {
    if (candidate && isBetter(candidate.rank, best.get(type)?.rank)) best.set(type, candidate);
  };
  const wanted = new Set(recordsFor(trackingType));
  for (const set of sets) {
    const weight = positiveWeight(set);
    if (wanted.has(RECORD_TYPE.HEAVIEST_WEIGHT) && weight !== null) {
      offer(RECORD_TYPE.HEAVIEST_WEIGHT, {
        value: weight,
        weightKg: weight,
        reps: set.reps,
        rank: [weight],
      });
    }
    const e1rm = estimateOneRepMax(set.weightKg, set.reps);
    if (wanted.has(RECORD_TYPE.BEST_E1RM) && e1rm !== null) {
      offer(RECORD_TYPE.BEST_E1RM, {
        value: e1rm,
        weightKg: set.weightKg,
        reps: set.reps,
        rank: [e1rm],
      });
    }
    if (wanted.has(RECORD_TYPE.MOST_REPS) && set.reps !== null) {
      offer(RECORD_TYPE.MOST_REPS, {
        value: set.reps,
        weightKg: set.weightKg,
        reps: set.reps,
        rank: [set.reps, set.weightKg ?? 0],
      });
    }
    if (wanted.has(RECORD_TYPE.LONGEST_DURATION) && set.durationSec !== null) {
      offer(RECORD_TYPE.LONGEST_DURATION, {
        value: set.durationSec,
        weightKg: null,
        reps: null,
        rank: [set.durationSec],
      });
    }
    if (wanted.has(RECORD_TYPE.LONGEST_DISTANCE) && set.distanceM !== null) {
      offer(RECORD_TYPE.LONGEST_DISTANCE, {
        value: set.distanceM,
        weightKg: null,
        reps: null,
        rank: [set.distanceM],
      });
    }
  }
  const volume = volumeOf(sets);
  if (wanted.has(RECORD_TYPE.BEST_VOLUME) && volume !== null && volume > 0) {
    offer(RECORD_TYPE.BEST_VOLUME, { value: volume, weightKg: null, reps: null, rank: [volume] });
  }
  return best;
}

/**
 * All-time records over sessions in start order. A later session takes a record only with a
 * strictly better value, so the earlier session keeps a tie.
 */
export function recordsOf(
  trackingType: TrackingType,
  sessions: readonly MetricSession[],
): ProgressRecord[] {
  const best = new Map<RecordType, Candidate & { sessionId: string; date: string }>();
  for (const session of sessions) {
    for (const [type, candidate] of sessionCandidates(trackingType, session.sets)) {
      if (isBetter(candidate.rank, best.get(type)?.rank)) {
        best.set(type, { ...candidate, sessionId: session.sessionId, date: session.date });
      }
    }
  }
  return RECORDS_BY_TRACKING[trackingType].flatMap((type) => {
    const record = best.get(type);
    if (!record) return [];
    return [
      {
        type,
        value: record.value,
        weightKg:
          type === RECORD_TYPE.MOST_REPS || type === RECORD_TYPE.BEST_E1RM ? record.weightKg : null,
        reps: type === RECORD_TYPE.BEST_E1RM ? record.reps : null,
        sessionId: record.sessionId,
        date: record.date,
      },
    ];
  });
}

const isEmpty = (bests: Bests) => Object.values(bests).every((value) => value === null);

function bestsFromCandidates(candidates: Map<RecordType, Candidate>): Bests {
  const mostReps = candidates.get(RECORD_TYPE.MOST_REPS);
  return {
    heaviestWeightKg: candidates.get(RECORD_TYPE.HEAVIEST_WEIGHT)?.value ?? null,
    bestE1rmKg: candidates.get(RECORD_TYPE.BEST_E1RM)?.value ?? null,
    mostReps: mostReps ? { reps: mostReps.value, weightKg: mostReps.weightKg } : null,
    bestVolumeKg: candidates.get(RECORD_TYPE.BEST_VOLUME)?.value ?? null,
    longestDurationSec: candidates.get(RECORD_TYPE.LONGEST_DURATION)?.value ?? null,
    longestDistanceM: candidates.get(RECORD_TYPE.LONGEST_DISTANCE)?.value ?? null,
  };
}

const maxNullable = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b);

/** Field-wise best of two bests; null when both are null. */
export function mergeBests(a: Bests | null, b: Bests | null): Bests | null {
  if (!a) return b;
  if (!b) return a;
  const repsA = a.mostReps;
  const repsB = b.mostReps;
  let mostReps = repsA ?? repsB;
  if (repsA && repsB) {
    mostReps = isBetter([repsB.reps, repsB.weightKg ?? 0], [repsA.reps, repsA.weightKg ?? 0])
      ? repsB
      : repsA;
  }
  return {
    heaviestWeightKg: maxNullable(a.heaviestWeightKg, b.heaviestWeightKg),
    bestE1rmKg: maxNullable(a.bestE1rmKg, b.bestE1rmKg),
    mostReps,
    bestVolumeKg: maxNullable(a.bestVolumeKg, b.bestVolumeKg),
    longestDurationSec: maxNullable(a.longestDurationSec, b.longestDurationSec),
    longestDistanceM: maxNullable(a.longestDistanceM, b.longestDistanceM),
  };
}

/**
 * The bests over sessions (each item is the sets of one session). With a null tracking type,
 * every field is computed from the values present. Returns null when no set gives a value.
 */
export function bestsOf(
  trackingType: TrackingType | null,
  sessions: readonly (readonly MetricSet[])[],
): Bests | null {
  let result: Bests | null = null;
  for (const sets of sessions) {
    result = mergeBests(result, bestsFromCandidates(sessionCandidates(trackingType, sets)));
  }
  return result && !isEmpty(result) ? result : null;
}

function baselineCandidate(baseline: Bests, type: RecordType): readonly number[] | undefined {
  const value = (number: number | null) => (number === null ? undefined : [number]);
  switch (type) {
    case RECORD_TYPE.HEAVIEST_WEIGHT:
      return value(baseline.heaviestWeightKg);
    case RECORD_TYPE.BEST_E1RM:
      return value(baseline.bestE1rmKg);
    case RECORD_TYPE.MOST_REPS:
      return baseline.mostReps
        ? [baseline.mostReps.reps, baseline.mostReps.weightKg ?? 0]
        : undefined;
    case RECORD_TYPE.BEST_VOLUME:
      return value(baseline.bestVolumeKg);
    case RECORD_TYPE.LONGEST_DURATION:
      return value(baseline.longestDurationSec);
    case RECORD_TYPE.LONGEST_DISTANCE:
      return value(baseline.longestDistanceM);
  }
}

/**
 * Records that one session beats. A null baseline is the first session of the exercise, which
 * only sets the baseline and gives no records.
 */
export function newRecordsOf(
  trackingType: TrackingType,
  exerciseId: string,
  baseline: Bests | null,
  sets: readonly MetricSet[],
): NewRecord[] {
  if (!baseline) return [];
  const candidates = sessionCandidates(trackingType, sets);
  return RECORDS_BY_TRACKING[trackingType].flatMap((type) => {
    const candidate = candidates.get(type);
    if (!candidate || !isBetter(candidate.rank, baselineCandidate(baseline, type))) return [];
    return [
      {
        exerciseId,
        type,
        value: candidate.value,
        weightKg: type === RECORD_TYPE.MOST_REPS ? candidate.weightKg : null,
        reps: null,
      },
    ];
  });
}

/** The first date of a range that ends today; null for the whole history. */
export function rangeStart(today: string, range: ProgressRange): string | null {
  const months = PROGRESS_RANGE_MONTHS[range];
  if (months === null) return null;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const monthIndex = y * 12 + (m - 1) - months;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month - 1, Math.min(d, lastDay) + 1));
  return isoDate(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate());
}
