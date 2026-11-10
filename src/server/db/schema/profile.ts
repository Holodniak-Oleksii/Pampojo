import { sql } from 'drizzle-orm';
import {
  check,
  date,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { AVATAR_EMOJI_IDS } from '@/constants/avatar';
import { NAME_MAX, SEX, UNIT_SYSTEM } from '@/constants/profile';
import { user } from './auth';
import { inList } from './utils';

export const profile = pgTable(
  'profile',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    avatarEmoji: text('avatar_emoji').notNull(),
    avatarColor: smallint('avatar_color').notNull(),
    sex: text('sex').notNull(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    heightCm: numeric('height_cm', { precision: 4, scale: 1, mode: 'number' }).notNull(),
    unitSystem: text('unit_system').notNull().default(UNIT_SYSTEM.METRIC),
    timeZone: text('time_zone').notNull(),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'profile_display_name_length',
      sql`char_length(${table.displayName}) between 1 and ${sql.raw(String(NAME_MAX))}`,
    ),
    check('profile_avatar_emoji', inList(table.avatarEmoji, AVATAR_EMOJI_IDS)),
    check('profile_avatar_color', sql`${table.avatarColor} between 1 and 8`),
    check('profile_sex', inList(table.sex, Object.values(SEX))),
    check('profile_height_cm', sql`${table.heightCm} between 100 and 250`),
    check('profile_unit_system', inList(table.unitSystem, Object.values(UNIT_SYSTEM))),
  ],
);
