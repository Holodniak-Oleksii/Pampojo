import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, smallint, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SCHEDULE } from '@/constants/plan';
import { user } from './auth';
import { workout } from './workout';

const n = (value: number) => sql.raw(String(value));

/** A plan rule; its occurrences are computed by `src/shared/plan/occurrences.ts`, never stored. */
export const scheduleRule = pgTable(
  'schedule_rule',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workout.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    weekdays: smallint('weekdays')
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    intervalWeeks: smallint('interval_weeks').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('schedule_rule_user_active_idx').on(table.userId, table.deletedAt, table.endDate),
    index('schedule_rule_workout_idx').on(table.workoutId),
    check(
      'schedule_rule_interval',
      sql`${table.intervalWeeks} between ${n(SCHEDULE.intervalMin)} and ${n(SCHEDULE.intervalMax)}`,
    ),
    check('schedule_rule_weekdays', sql`${table.weekdays} <@ '{1,2,3,4,5,6,7}'::smallint[]`),
    check(
      'schedule_rule_end',
      sql`${table.endDate} is null or (${table.endDate} >= ${table.startDate}
        and ${table.endDate} <= ${table.startDate} + interval '${n(SCHEDULE.horizonYears)} years')`,
    ),
    check(
      'schedule_rule_one_off',
      sql`cardinality(${table.weekdays}) > 0 or ${table.endDate} = ${table.startDate}`,
    ),
  ],
);
