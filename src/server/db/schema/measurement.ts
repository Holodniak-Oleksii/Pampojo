import { sql } from 'drizzle-orm';
import {
  check,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { MEASUREMENT_TYPE } from '@/constants/measurement';
import { user } from './auth';
import { inList } from './utils';

export const bodyMeasurement = pgTable(
  'body_measurement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    value: numeric('value', { precision: 7, scale: 2, mode: 'number' }).notNull(),
    measuredOn: date('measured_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // One live measurement per user, type and day; soft-deleted rows keep their history.
    uniqueIndex('body_measurement_user_type_day_uq')
      .on(table.userId, table.type, table.measuredOn)
      .where(sql`${table.deletedAt} is null`),
    check('body_measurement_type', inList(table.type, Object.values(MEASUREMENT_TYPE))),
    check('body_measurement_value_positive', sql`${table.value} > 0`),
  ],
);
