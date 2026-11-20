import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SYNC_MUTATION_TYPES } from '@/constants/sync';
import { user } from './auth';
import { inList } from './utils';

/** Applied outbox mutation ids, so a replayed push is acknowledged without a second apply. */
export const syncMutation = pgTable(
  'sync_mutation',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sync_mutation_user_idx').on(table.userId),
    check('sync_mutation_type', inList(table.type, SYNC_MUTATION_TYPES)),
  ],
);
