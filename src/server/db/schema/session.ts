import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  SESSION_NOTE_MAX,
  SESSION_SETS_MAX,
  SESSION_STATUS,
  SESSION_STATUSES,
  SET_RANGE,
} from '@/constants/session';
import type { SessionExercise, WorkoutSnapshot } from '@/shared/schemas/session';
import { user } from './auth';
import { exercise } from './exercise';
import { inList } from './utils';
import { workout } from './workout';

const n = (value: number) => sql.raw(String(value));

export const workoutSession = pgTable(
  'workout_session',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workoutId: uuid('workout_id').references(() => workout.id, { onDelete: 'set null' }),
    scheduledFor: date('scheduled_for'),
    workoutSnapshot: jsonb('workout_snapshot').$type<WorkoutSnapshot>().notNull(),
    /** The session plan: order, added exercises and planned sets. */
    exercises: jsonb('exercises').$type<SessionExercise[]>().notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workout_session_user_status_idx').on(table.userId, table.status, table.startedAt),
    index('workout_session_user_updated_idx').on(table.userId, table.updatedAt),
    index('workout_session_workout_id_idx').on(table.workoutId),
    check('workout_session_status', inList(table.status, SESSION_STATUSES)),
    check(
      'workout_session_finished',
      sql`(${table.status} = ${sql.raw(`'${SESSION_STATUS.COMPLETED}'`)}) = (${table.finishedAt} is not null)
        or ${table.status} = ${sql.raw(`'${SESSION_STATUS.ABANDONED}'`)}`,
    ),
    check(
      'workout_session_notes_length',
      sql`char_length(${table.notes}) <= ${n(SESSION_NOTE_MAX)}`,
    ),
  ],
);

export const setLog = pgTable(
  'set_log',
  {
    id: uuid('id').primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => workoutSession.id, { onDelete: 'cascade' }),
    sessionExerciseId: uuid('session_exercise_id').notNull(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    substitutedFromExerciseId: uuid('substituted_from_exercise_id').references(() => exercise.id, {
      onDelete: 'set null',
    }),
    setIndex: smallint('set_index').notNull(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
    reps: smallint('reps'),
    durationSec: integer('duration_sec'),
    distanceM: integer('distance_m'),
    rpe: numeric('rpe', { precision: 3, scale: 1 }),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('set_log_session_idx').on(table.sessionId),
    index('set_log_exercise_idx').on(table.exerciseId),
    uniqueIndex('set_log_position_uq')
      .on(table.sessionId, table.sessionExerciseId, table.setIndex)
      .where(sql`${table.deletedAt} is null`),
    check('set_log_index', sql`${table.setIndex} between 0 and ${n(SESSION_SETS_MAX - 1)}`),
    check(
      'set_log_weight',
      sql`${table.weightKg} between ${n(SET_RANGE.weightKg.min)} and ${n(SET_RANGE.weightKg.max)}`,
    ),
    check(
      'set_log_reps',
      sql`${table.reps} between ${n(SET_RANGE.reps.min)} and ${n(SET_RANGE.reps.max)}`,
    ),
    check(
      'set_log_duration',
      sql`${table.durationSec} between ${n(SET_RANGE.durationSec.min)} and ${n(SET_RANGE.durationSec.max)}`,
    ),
    check(
      'set_log_distance',
      sql`${table.distanceM} between ${n(SET_RANGE.distanceM.min)} and ${n(SET_RANGE.distanceM.max)}`,
    ),
  ],
);
