import { pgTable, text, timestamp, uuid, check } from 'drizzle-orm/pg-core';
import { GYM_EQUIPMENT_KEYS } from '@/constants/gym';
import { user } from './auth';
import { subsetOf } from './utils';

/** One gym per user; a user without a row has not set up a gym yet. */
export const gymProfile = pgTable(
  'gym_profile',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    equipment: text('equipment').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('gym_profile_equipment', subsetOf(table.equipment, GYM_EQUIPMENT_KEYS))],
);
