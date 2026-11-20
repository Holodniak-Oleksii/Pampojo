import { afterEach, describe, expect, it } from 'vitest';
import { localExercise } from '@/test/local-data';
import { resetLocalDbs } from '@/test/local-session';
import { openLocalDb } from '../db';
import { searchLocalExercises } from '../exercises';
import { createMeasurementRepository } from '../measurements';
import { fromWorkoutResponse, getLocalWorkout, putMissingWorkoutExercises } from '../workouts';
import { getWorkoutMock } from '@/test/mocks';

afterEach(async () => {
  await resetLocalDbs();
});

const filters = { q: '', muscles: [], equipment: [], mine: false, gym: false };

describe('searchLocalExercises', () => {
  it('matches the normalized name and aliases, prefix first (AC11)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await db.exercises.bulkPut([
      localExercise('Incline Bench Press', { popularity: 90 }),
      localExercise('Bench Press', { popularity: 10 }),
      localExercise('Push-Up', { aliases: ['Press-up'] }),
      localExercise('Squat', { primaryMuscles: ['quadriceps'] }),
    ]);
    const names = async (q: string) =>
      (await searchLocalExercises(db, { ...filters, q }, 'en', null)).map((item) => item.name);
    expect(await names('BENCH')).toEqual(['Bench Press', 'Incline Bench Press']);
    expect(await names('press-up')).toEqual(['Push-Up']);
    expect(await names('deadlift')).toEqual([]);
  });

  it('filters by muscle and gym, and groups by the first muscle', async () => {
    const db = openLocalDb(crypto.randomUUID());
    await db.exercises.bulkPut([
      localExercise('Bench Press', { gymEquipment: [['flat_bench'], ['barbell']] }),
      localExercise('Squat', { primaryMuscles: ['quadriceps'] }),
    ]);
    const chest = await searchLocalExercises(db, { ...filters, muscles: ['chest'] }, 'en', null);
    expect(chest.map((item) => [item.name, item.section])).toEqual([['Bench Press', 'chest']]);
    const gym = await searchLocalExercises(db, { ...filters, gym: true }, 'en', ['flat_bench']);
    expect(gym.map((item) => item.name)).toEqual(['Squat']);
  });
});

describe('measurement repository', () => {
  it('reuses the id of the local row of that day and enqueues measurement.put (AC12)', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const repository = createMeasurementRepository(db);
    const first = await repository.save({ type: 'weight', value: 80, measuredOn: '2026-11-01' });
    const second = await repository.save({ type: 'weight', value: 81, measuredOn: '2026-11-01' });
    expect(second.id).toBe(first.id);
    expect((await db.measurements.toArray()).map((row) => row.value)).toEqual([81]);
    expect((await db.outbox.toArray()).map((entry) => [entry.type, entry.entityId])).toEqual([
      ['measurement.put', first.id],
      ['measurement.put', first.id],
    ]);
  });

  it('removes the row and enqueues measurement.delete', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const repository = createMeasurementRepository(db);
    const row = await repository.save({ type: 'waist', value: 85, measuredOn: '2026-11-01' });
    await repository.remove(row.id);
    expect(await db.measurements.count()).toBe(0);
    expect((await db.outbox.toArray()).at(-1)?.type).toBe('measurement.delete');
  });
});

describe('putMissingWorkoutExercises', () => {
  it('stores placeholders only for exercises the device lacks, so names show at once', async () => {
    const db = openLocalDb(crypto.randomUUID());
    const workout = getWorkoutMock();
    const [first] = workout.exercises;
    const known = localExercise('Known name', { id: first!.exerciseId });
    await db.exercises.put(known);
    await db.workouts.put(fromWorkoutResponse(workout));
    await putMissingWorkoutExercises(db, workout, 'en');
    const local = await getLocalWorkout(db, workout.id, 'en');
    expect(local?.exercises.map((item) => item.exercise.name)).toEqual([
      'Known name',
      ...workout.exercises.slice(1).map((item) => item.exercise.name),
    ]);
  });
});
