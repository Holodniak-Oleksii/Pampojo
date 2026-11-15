import { describe, expect, it } from 'vitest';
import type { SessionExercise, SetLog } from '@/shared/schemas/session';
import {
  buildSessionFromWorkout,
  canLog,
  firstOpenRow,
  forgottenFinishedAt,
  formatClock,
  formatElapsed,
  isForgotten,
  nextEntryWithWork,
  prefillRow,
  restState,
  summaryOf,
} from '../utils';

const EX = '00000000-0000-4000-8000-0000000000aa';

function entry(override: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: 'e1',
    exerciseId: EX,
    plannedSets: 3,
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetWeightKg: 60,
    targetDurationSec: null,
    targetDistanceM: null,
    notes: null,
    exercise: {
      id: EX,
      name: 'Bench',
      trackingType: 'weight_reps',
      laterality: null,
      thumbnailUrl: null,
    },
    ...override,
  };
}

function log(override: Partial<SetLog> = {}): SetLog {
  return {
    id: crypto.randomUUID(),
    sessionId: 's',
    sessionExerciseId: 'e1',
    exerciseId: EX,
    setIndex: 0,
    weightKg: 80,
    reps: 8,
    durationSec: null,
    distanceM: null,
    completedAt: '2026-11-15T10:10:00.000Z',
    ...override,
  };
}

const last = {
  sessionId: 'old',
  finishedAt: '2026-11-10T10:00:00Z',
  sets: [
    { setIndex: 0, weightKg: 80, reps: 8, durationSec: null, distanceM: null },
    { setIndex: 1, weightKg: null, reps: 7, durationSec: null, distanceM: null },
  ],
};

describe('prefillRow (AC4)', () => {
  it('takes the same set of the last time, then the targets', () => {
    expect(prefillRow(entry(), 0, last)).toEqual({
      weightKg: 80,
      reps: 8,
      durationSec: null,
      distanceM: null,
    });
    expect(prefillRow(entry(), 1, last)).toMatchObject({ weightKg: null, reps: 7 });
    expect(prefillRow(entry(), 2, last)).toMatchObject({ weightKg: 60, reps: 8 });
    expect(prefillRow(entry({ targetWeightKg: null, targetRepsMin: null }), 0, null)).toMatchObject(
      {
        weightKg: null,
        reps: null,
      },
    );
  });

  it('keeps fields of other tracking types empty', () => {
    const plank = entry({
      targetDurationSec: 45,
      exercise: {
        id: EX,
        name: 'Plank',
        trackingType: 'time',
        laterality: null,
        thumbnailUrl: null,
      },
    });
    expect(prefillRow(plank, 0, null)).toEqual({
      weightKg: null,
      reps: null,
      durationSec: 45,
      distanceM: null,
    });
  });
});

describe('canLog (AC11)', () => {
  it('needs the main metric only', () => {
    expect(
      canLog('weight_reps', { weightKg: null, reps: 8, durationSec: null, distanceM: null }),
    ).toBe(true);
    expect(
      canLog('weight_reps', { weightKg: 80, reps: null, durationSec: null, distanceM: null }),
    ).toBe(false);
    expect(canLog('time', { weightKg: null, reps: null, durationSec: 30, distanceM: null })).toBe(
      true,
    );
    expect(
      canLog('distance', { weightKg: null, reps: null, durationSec: null, distanceM: null }),
    ).toBe(false);
  });
});

describe('rows and progress', () => {
  it('finds the first open row and the next exercise with work', () => {
    const a = entry({ id: 'a', plannedSets: 2 });
    const b = entry({ id: 'b', plannedSets: 1 });
    const logs = [
      log({ sessionExerciseId: 'a', setIndex: 0 }),
      log({ sessionExerciseId: 'a', setIndex: 1 }),
    ];
    expect(firstOpenRow(a, logs)).toBeNull();
    expect(firstOpenRow(b, logs)).toBe(0);
    expect(nextEntryWithWork([a, b], logs, 'a')?.id).toBe('b');
    expect(nextEntryWithWork([a, b], [...logs, log({ sessionExerciseId: 'b' })], 'a')).toBeNull();
  });
});

describe('restState (AC3)', () => {
  it('counts down from restEndsAt and then up past zero', () => {
    const end = '2026-11-15T10:01:30.000Z';
    const at = (iso: string) => new Date(iso).getTime();
    expect(restState(end, 90, at('2026-11-15T10:00:00.000Z'))).toMatchObject({
      remainingSec: 90,
      over: false,
      progress: 1,
    });
    expect(restState(end, 90, at('2026-11-15T10:01:00.500Z'))).toMatchObject({
      remainingSec: 30,
      over: false,
    });
    expect(restState(end, 90, at('2026-11-15T10:01:40.000Z'))).toMatchObject({
      over: true,
      overSec: 10,
      progress: 0,
    });
  });
});

describe('forgotten sessions (AC10)', () => {
  it('is forgotten after 12 hours and ends at the last set', () => {
    const startedAt = '2026-11-14T08:00:00.000Z';
    const s = { status: 'in_progress', startedAt };
    expect(isForgotten(s, new Date('2026-11-14T19:59:00Z').getTime())).toBe(false);
    expect(isForgotten(s, new Date('2026-11-14T20:01:00Z').getTime())).toBe(true);
    expect(isForgotten({ ...s, status: 'completed' }, Date.now())).toBe(false);
    expect(forgottenFinishedAt(startedAt, [])).toBe(startedAt);
    expect(
      forgottenFinishedAt(startedAt, [
        log({ completedAt: '2026-11-14T08:30:00.000Z' }),
        log({ completedAt: '2026-11-14T08:50:00.000Z' }),
      ]),
    ).toBe('2026-11-14T08:50:00.000Z');
  });
});

describe('summaryOf (AC8)', () => {
  it('sums volume of weighted sets and builds a row per exercise', () => {
    const press = entry({ id: 'p' });
    const plank = entry({
      id: 'k',
      exercise: {
        id: EX,
        name: 'Plank',
        trackingType: 'time',
        laterality: null,
        thumbnailUrl: null,
      },
    });
    const skipped = entry({ id: 'x' });
    const summary = summaryOf(
      {
        exercises: [press, plank, skipped],
        startedAt: '2026-11-15T10:00:00.000Z',
        finishedAt: '2026-11-15T11:04:12.000Z',
      },
      [
        log({ sessionExerciseId: 'p', weightKg: 80, reps: 8 }),
        log({ sessionExerciseId: 'p', setIndex: 1, weightKg: 77.5, reps: 6 }),
        log({ sessionExerciseId: 'p', setIndex: 2, weightKg: null, reps: 10 }),
        log({ sessionExerciseId: 'k', weightKg: null, reps: null, durationSec: 50 }),
      ],
    );
    expect(summary).toMatchObject({ durationSec: 3852, volumeKg: 1105, sets: 4, exercises: 2 });
    expect(summary.rows).toEqual([
      { entryId: 'p', name: 'Bench', count: 3, result: { kind: 'weight', value: 80 } },
      { entryId: 'k', name: 'Plank', count: 1, result: { kind: 'duration', value: 50 } },
    ]);
  });
});

describe('buildSessionFromWorkout (AC1)', () => {
  it('copies the workout into a snapshot and a plan with new entry ids', () => {
    let n = 0;
    const { workoutSnapshot, exercises } = buildSessionFromWorkout(
      {
        id: '00000000-0000-4000-8000-0000000000bb',
        name: 'Push Day',
        description: null,
        updatedAt: '2026-11-15T10:00:00Z',
        exercises: [
          {
            id: 'w1',
            exerciseId: EX,
            targetSets: null,
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetWeightKg: null,
            targetDurationSec: null,
            targetDistanceM: null,
            notes: 'Slow',
            exercise: {
              id: EX,
              name: 'Bench',
              trackingType: 'weight_reps',
              laterality: 'bilateral',
              primaryMuscles: ['chest'],
              thumbnailUrl: null,
              isOwn: false,
            },
          },
        ],
      },
      () => `new-${++n}`,
    );
    expect(workoutSnapshot.exercises[0]?.id).toBe('w1');
    expect(exercises[0]).toMatchObject({ id: 'new-1', plannedSets: 3, notes: 'Slow' });
    expect(exercises[0]?.exercise).toEqual({
      id: EX,
      name: 'Bench',
      trackingType: 'weight_reps',
      laterality: 'bilateral',
      thumbnailUrl: null,
    });
  });
});

describe('clock formatting', () => {
  it('formats rest and elapsed times', () => {
    expect(formatClock(72)).toBe('1:12');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatElapsed(1457)).toBe('0:24:17');
  });
});
