import { describe, expect, it } from 'vitest';
import {
  bestsOf,
  estimateOneRepMax,
  mergeBests,
  newRecordsOf,
  pointOf,
  rangeStart,
  recordsOf,
  type MetricSet,
} from '../metrics';

const SESSION_A = '00000000-0000-4000-8000-00000000000a';
const SESSION_B = '00000000-0000-4000-8000-00000000000b';
const SESSION_C = '00000000-0000-4000-8000-00000000000c';
const BENCH = '00000000-0000-4000-8000-0000000000a1';

const lift = (weightKg: number | null, reps: number): MetricSet => ({
  weightKg,
  reps,
  durationSec: null,
  distanceM: null,
});
const hold = (durationSec: number): MetricSet => ({
  weightKg: null,
  reps: null,
  durationSec,
  distanceM: null,
});

describe('estimateOneRepMax', () => {
  it('uses Epley for 1–12 reps and a weight above 0, to 0.01 kg', () => {
    expect(estimateOneRepMax(87.5, 5)).toBe(102.08);
    expect(estimateOneRepMax(100, 1)).toBe(103.33);
    expect(estimateOneRepMax(60, 12)).toBe(84);
  });

  it('gives no value outside the rep range or without a weight', () => {
    expect(estimateOneRepMax(60, 13)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
  });
});

describe('pointOf', () => {
  it('computes the weight_reps values', () => {
    expect(
      pointOf('weight_reps', [lift(80, 8), lift(87.5, 5), lift(60, 15), lift(null, 20)]),
    ).toEqual({
      topWeightKg: 87.5,
      e1rmKg: estimateOneRepMax(87.5, 5),
      volumeKg: 80 * 8 + 87.5 * 5 + 60 * 15,
      reps: 20,
      durationSec: null,
      distanceM: null,
    });
  });

  it('keeps only the metric of the other tracking types', () => {
    expect(pointOf('reps', [lift(null, 10), lift(null, 12)]).reps).toBe(12);
    expect(pointOf('time', [hold(45), hold(60)])).toMatchObject({ durationSec: 60, reps: null });
    const run = { weightKg: null, reps: null, durationSec: null, distanceM: 1200 };
    expect(pointOf('distance', [run]).distanceM).toBe(1200);
  });

  it('gives no volume when no set has a weight', () => {
    expect(pointOf('weight_reps', [lift(null, 10)]).volumeKg).toBeNull();
  });
});

describe('recordsOf', () => {
  const sessions = [
    { sessionId: SESSION_A, date: '2026-11-02', sets: [lift(80, 8), lift(60, 12)] },
    { sessionId: SESSION_B, date: '2026-11-09', sets: [lift(90, 3), lift(60, 12)] },
    { sessionId: SESSION_C, date: '2026-11-16', sets: [lift(87.5, 5), lift(65, 12)] },
  ];

  it('picks the best set of each record and its session', () => {
    const records = recordsOf('weight_reps', sessions);
    expect(records.map((record) => record.type)).toEqual([
      'heaviest_weight',
      'best_e1rm',
      'most_reps',
      'best_volume',
    ]);
    expect(records[0]).toMatchObject({ value: 90, sessionId: SESSION_B, date: '2026-11-09' });
    expect(records[1]).toMatchObject({ sessionId: SESSION_C, weightKg: 87.5, reps: 5 });
    // Equal reps with a heavier weight wins.
    expect(records[2]).toMatchObject({ value: 12, weightKg: 65, sessionId: SESSION_C });
    expect(records[3]).toMatchObject({ value: 80 * 8 + 60 * 12, sessionId: SESSION_A });
  });

  it('keeps a tie with the earlier session', () => {
    const tie = [
      { sessionId: SESSION_A, date: '2026-11-02', sets: [lift(100, 1)] },
      { sessionId: SESSION_B, date: '2026-11-09', sets: [lift(100, 1)] },
    ];
    expect(recordsOf('weight_reps', tie)[0]).toMatchObject({ sessionId: SESSION_A });
  });

  it('gives one record for a time exercise', () => {
    const records = recordsOf('time', [
      { sessionId: SESSION_A, date: '2026-11-02', sets: [hold(60), hold(75)] },
    ]);
    expect(records).toEqual([
      {
        type: 'longest_duration',
        value: 75,
        weightKg: null,
        reps: null,
        sessionId: SESSION_A,
        date: '2026-11-02',
      },
    ]);
  });

  it('counts a set with no weight only for most reps', () => {
    const records = recordsOf('weight_reps', [
      { sessionId: SESSION_A, date: '2026-11-02', sets: [lift(null, 15)] },
    ]);
    expect(records.map((record) => record.type)).toEqual(['most_reps']);
  });
});

describe('bestsOf and mergeBests', () => {
  it('gives null with no value', () => {
    expect(bestsOf(null, [])).toBeNull();
    expect(mergeBests(null, null)).toBeNull();
  });

  it('computes every field from the values present without a tracking type', () => {
    expect(bestsOf(null, [[lift(80, 8)], [lift(60, 12)]])).toEqual({
      heaviestWeightKg: 80,
      bestE1rmKg: estimateOneRepMax(80, 8),
      mostReps: { reps: 12, weightKg: 60 },
      bestVolumeKg: 720,
      longestDurationSec: null,
      longestDistanceM: null,
    });
  });

  it('merges field by field', () => {
    const a = bestsOf(null, [[lift(80, 8)]]);
    const b = bestsOf(null, [[lift(70, 10)]]);
    expect(mergeBests(a, b)).toMatchObject({
      heaviestWeightKg: 80,
      mostReps: { reps: 10, weightKg: 70 },
      bestVolumeKg: 700,
    });
  });
});

describe('newRecordsOf', () => {
  const baseline = bestsOf(null, [[lift(80, 8), lift(60, 12)]]);

  it('gives nothing for the first session of an exercise', () => {
    expect(newRecordsOf('weight_reps', BENCH, null, [lift(100, 5)])).toEqual([]);
  });

  it('lists only values that are strictly better', () => {
    const records = newRecordsOf('weight_reps', BENCH, baseline, [lift(85, 3), lift(60, 12)]);
    expect(records).toEqual([
      { exerciseId: BENCH, type: 'heaviest_weight', value: 85, weightKg: null, reps: null },
    ]);
  });

  it('does not count a tie', () => {
    expect(newRecordsOf('weight_reps', BENCH, baseline, [lift(80, 8)])).toEqual([]);
  });

  it('counts equal reps with a heavier weight as a new most reps', () => {
    const records = newRecordsOf('weight_reps', BENCH, baseline, [lift(62.5, 12)]);
    expect(records.find((record) => record.type === 'most_reps')).toMatchObject({
      value: 12,
      weightKg: 62.5,
    });
  });
});

describe('rangeStart', () => {
  it('ends each range today', () => {
    expect(rangeStart('2026-11-17', '1m')).toBe('2026-10-18');
    expect(rangeStart('2026-11-17', '3m')).toBe('2026-08-18');
    expect(rangeStart('2026-11-17', '6m')).toBe('2026-05-18');
    expect(rangeStart('2026-11-17', '1y')).toBe('2025-11-18');
    expect(rangeStart('2026-11-17', 'all')).toBeNull();
  });

  it('clamps the day to the end of a shorter month', () => {
    expect(rangeStart('2026-03-31', '1m')).toBe('2026-03-01');
    expect(rangeStart('2028-03-31', '1m')).toBe('2028-03-01');
    expect(rangeStart('2026-01-15', '3m')).toBe('2025-10-16');
  });
});
