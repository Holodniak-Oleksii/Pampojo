import { sql } from 'drizzle-orm';

// Drizzle has no auto-update for timestamps; every update spreads this into `.set()`.
// The database clock sets the value, because the pull cursor compares it with the database `now()`.
export function touch() {
  return { updatedAt: sql`now()` };
}
