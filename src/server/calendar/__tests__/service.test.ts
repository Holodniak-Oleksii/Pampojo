import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { todayIn } from '@/lib/dates';
import { getDb } from '@/server/db/client';
import * as schema from '@/server/db/schema';
import { getEnv } from '@/server/env';
import type { Tx } from '@/server/plan/queries';
import { addDays } from '@/shared/plan/occurrences';
import { deleteUsersByEmail, withRollback, testPrefix } from '@/test/db';
import {
  benchExerciseId,
  insertCompletedSession,
  insertRule,
  newHistoryUser,
  newHistoryWorkout,
} from '@/test/history-fixtures';
import { getCalendar } from '../service';

vi.setConfig({ testTimeout: 60_000 });

const PREFIX = testPrefix('calendar-service');
let bench: string;

beforeAll(async () => {
  bench = await benchExerciseId();
});

afterAll(async () => {
  await deleteUsersByEmail(`${PREFIX}-%@example.com`);
});

const today = () => todayIn('UTC');
const noonOf = (date: string) => new Date(`${date}T12:00:00Z`);

describe('getCalendar', () => {
  it('gives each occurrence its status and puts sessions on their start day', async () => {
    await withRollback(async (tx) => {
      const userId = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, userId, bench);
      const onTime = addDays(today(), -6);
      const late = addDays(today(), -4);
      const missed = addDays(today(), -2);
      for (const date of [onTime, late, missed, today()])
        await insertRule(tx, userId, workoutId, date);
      const a = await insertCompletedSession(tx, {
        userId,
        workoutId,
        exerciseId: bench,
        startedAt: noonOf(onTime),
        scheduledFor: onTime,
        sets: 2,
      });
      const b = await insertCompletedSession(tx, {
        userId,
        workoutId,
        exerciseId: bench,
        startedAt: noonOf(addDays(late, 1)),
        scheduledFor: late,
      });
      const extra = await insertCompletedSession(tx, {
        userId,
        workoutId,
        exerciseId: bench,
        startedAt: noonOf(addDays(today(), -1)),
      });
      const calendar = await getCalendar(userId, { from: addDays(today(), -7), to: today() }, tx);
      const day = (date: string) => calendar.days.find((item) => item.date === date);
      expect(calendar.today).toBe(today());
      expect(day(onTime)?.occurrences[0]).toMatchObject({ status: 'on_time', sessionId: a });
      expect(day(onTime)?.sessions[0]).toMatchObject({ id: a, kind: 'on_time', setCount: 2 });
      expect(day(late)?.occurrences[0]).toMatchObject({ status: 'late', sessionId: b });
      expect(day(addDays(late, 1))?.sessions[0]).toMatchObject({ id: b, kind: 'late' });
      expect(day(missed)?.occurrences[0]?.status).toBe('missed');
      expect(day(today())?.occurrences[0]?.status).toBe('planned');
      expect(day(addDays(today(), -1))?.sessions[0]).toMatchObject({ id: extra, kind: 'extra' });
    });
  });

  it('never shows another user’s sessions or rules', async () => {
    await withRollback(async (tx) => {
      const owner = await newHistoryUser(tx, PREFIX);
      const other = await newHistoryUser(tx, PREFIX);
      const workoutId = await newHistoryWorkout(tx, owner, bench);
      await insertRule(tx, owner, workoutId, addDays(today(), -1));
      await insertCompletedSession(tx, {
        userId: owner,
        workoutId,
        exerciseId: bench,
        startedAt: noonOf(addDays(today(), -1)),
      });
      const calendar = await getCalendar(other, { from: addDays(today(), -3), to: today() }, tx);
      expect(calendar.days.flatMap((day) => [...day.occurrences, ...day.sessions])).toHaveLength(0);
    });
  });

  it('runs 3 queries for an empty week and a full 62-day range (AC9)', async () => {
    const db = getDb() as unknown as Tx;
    const userId = await newHistoryUser(db, PREFIX);
    const workoutId = await newHistoryWorkout(db, userId, bench);
    for (let back = 1; back <= 40; back += 3) {
      const date = addDays(today(), -back);
      await insertRule(db, userId, workoutId, date);
      await insertCompletedSession(db, {
        userId,
        workoutId,
        exerciseId: bench,
        startedAt: noonOf(date),
        scheduledFor: date,
        sets: 3,
      });
    }
    const empty = await newHistoryUser(db, PREFIX);
    let queries = 0;
    const client = postgres(getEnv().DATABASE_URL, { prepare: false, max: 1 });
    const counting = drizzle(client, { schema, logger: { logQuery: () => (queries += 1) } });
    try {
      await getCalendar(empty, { from: addDays(today(), -6), to: today() }, counting);
      expect(queries).toBe(3);
      queries = 0;
      const full = await getCalendar(
        userId,
        { from: addDays(today(), -61), to: today() },
        counting,
      );
      expect(queries).toBe(3);
      expect(full.days).toHaveLength(62);
      expect(full.days.flatMap((day) => day.sessions).length).toBeGreaterThanOrEqual(14);
    } finally {
      await client.end();
    }
  });
});
