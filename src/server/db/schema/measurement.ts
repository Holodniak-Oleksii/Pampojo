import { sql } from 'drizzle-orm';
import { check, date, index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
    index('body_measurement_user_type_date_idx').on(table.userId, table.type, table.measuredOn),
    check('body_measurement_type', inList(table.type, Object.values(MEASUREMENT_TYPE))),
    check('body_measurement_value_positive', sql`${table.value} > 0`),
  ],
);
