import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  EQUIPMENT_LIST,
  EXERCISE_NAME_MAX,
  LATERALITY,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUPS,
  POPULARITY,
  TRACKING_TYPE,
} from '@/constants/exercise';
import { LOCALES } from '@/i18n/config';
import type { ExerciseMedia } from '@/shared/schemas/exercise';
import { user } from './auth';
import { inList, subsetOf } from './utils';

export const exercise = pgTable(
  'exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug'),
    primaryMuscles: text('primary_muscles').array().notNull(),
    secondaryMuscles: text('secondary_muscles')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    movementPattern: text('movement_pattern'),
    equipment: text('equipment').array().notNull(),
    mechanic: text('mechanic'),
    laterality: text('laterality'),
    trackingType: text('tracking_type').notNull(),
    difficulty: smallint('difficulty'),
    popularity: smallint('popularity'),
    media: jsonb('media').$type<ExerciseMedia>().notNull().default({ frames: [] }),
    sourceExerciseId: uuid('source_exercise_id').references((): AnyPgColumn => exercise.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('exercise_owner_id_idx').on(table.ownerId),
    index('exercise_source_exercise_id_idx').on(table.sourceExerciseId),
    // Slugs identify system exercises (seed upserts, export files); own exercises have none.
    uniqueIndex('exercise_system_slug_uq')
      .on(table.slug)
      .where(sql`${table.ownerId} is null`),
    check('exercise_primary_muscles_present', sql`cardinality(${table.primaryMuscles}) >= 1`),
    check('exercise_primary_muscles', subsetOf(table.primaryMuscles, MUSCLE_GROUPS)),
    check('exercise_secondary_muscles', subsetOf(table.secondaryMuscles, MUSCLE_GROUPS)),
    check('exercise_equipment_present', sql`cardinality(${table.equipment}) >= 1`),
    check('exercise_equipment', subsetOf(table.equipment, EQUIPMENT_LIST)),
    check(
      'exercise_movement_pattern',
      inList(table.movementPattern, Object.values(MOVEMENT_PATTERN)),
    ),
    check('exercise_mechanic', inList(table.mechanic, Object.values(MECHANIC))),
    check('exercise_laterality', inList(table.laterality, Object.values(LATERALITY))),
    check('exercise_tracking_type', inList(table.trackingType, Object.values(TRACKING_TYPE))),
    check('exercise_difficulty', sql`${table.difficulty} between 1 and 3`),
    check(
      'exercise_popularity',
      sql`${table.popularity} between ${sql.raw(String(POPULARITY.min))} and ${sql.raw(String(POPULARITY.max))}`,
    ),
  ],
);

export const exerciseTranslation = pgTable(
  'exercise_translation',
  {
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    name: text('name').notNull(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    description: text('description').notNull().default(''),
    instructions: text('instructions')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    commonMistakes: text('common_mistakes')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    searchName: text('search_name').notNull(),
    searchAliases: text('search_aliases').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.exerciseId, table.locale] }),
    check('exercise_translation_locale', inList(table.locale, LOCALES)),
    check(
      'exercise_translation_name_length',
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(EXERCISE_NAME_MAX))}`,
    ),
  ],
);
