import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  TARGET_RANGE,
  WORKOUT_DESCRIPTION_MAX,
  WORKOUT_NAME_MAX,
  WORKOUT_NOTE_MAX,
} from '@/constants/workout';
import { user } from './auth';
import { exercise } from './exercise';

const n = (value: number) => sql.raw(String(value));

export const workout = pgTable(
  'workout',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    sourceWorkoutId: uuid('source_workout_id'),
    sourceOwnerName: text('source_owner_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('workout_owner_updated_idx').on(table.ownerId, table.updatedAt),
    check(
      'workout_name_length',
      sql`char_length(${table.name}) between 1 and ${n(WORKOUT_NAME_MAX)}`,
    ),
    check(
      'workout_description_length',
      sql`char_length(${table.description}) <= ${n(WORKOUT_DESCRIPTION_MAX)}`,
    ),
  ],
);

/** The exercises of a workout; a save replaces the whole list. */
export const workoutExercise = pgTable(
  'workout_exercise',
  {
    id: uuid('id').primaryKey(),
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workout.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    targetSets: smallint('target_sets'),
    targetRepsMin: smallint('target_reps_min'),
    targetRepsMax: smallint('target_reps_max'),
    targetWeightKg: numeric('target_weight_kg', { precision: 5, scale: 2 }),
    targetDurationSec: integer('target_duration_sec'),
    targetDistanceM: integer('target_distance_m'),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('workout_exercise_position_uq').on(table.workoutId, table.position),
    index('workout_exercise_exercise_id_idx').on(table.exerciseId),
    check(
      'workout_exercise_sets',
      sql`${table.targetSets} between ${n(TARGET_RANGE.sets.min)} and ${n(TARGET_RANGE.sets.max)}`,
    ),
    check(
      'workout_exercise_reps',
      sql`(${table.targetRepsMin} is null) = (${table.targetRepsMax} is null)
        and ${table.targetRepsMin} between ${n(TARGET_RANGE.reps.min)} and ${n(TARGET_RANGE.reps.max)}
        and ${table.targetRepsMax} between ${table.targetRepsMin} and ${n(TARGET_RANGE.reps.max)}`,
    ),
    check(
      'workout_exercise_weight',
      sql`${table.targetWeightKg} between ${n(TARGET_RANGE.weightKg.min)} and ${n(TARGET_RANGE.weightKg.max)}`,
    ),
    check(
      'workout_exercise_duration',
      sql`${table.targetDurationSec} between ${n(TARGET_RANGE.durationSec.min)} and ${n(TARGET_RANGE.durationSec.max)}`,
    ),
    check(
      'workout_exercise_distance',
      sql`${table.targetDistanceM} between ${n(TARGET_RANGE.distanceM.min)} and ${n(TARGET_RANGE.distanceM.max)}`,
    ),
    check(
      'workout_exercise_notes_length',
      sql`char_length(${table.notes}) <= ${n(WORKOUT_NOTE_MAX)}`,
    ),
  ],
);
