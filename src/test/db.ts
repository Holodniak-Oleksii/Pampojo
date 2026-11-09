import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

class Rollback extends Error {}

// The database is shared with production: tests run their own writes in a transaction that never commits.
export async function withRollback<T>(
  fn: (tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]) => Promise<T>,
): Promise<T | undefined> {
  let result: T | undefined;
  try {
    await getDb().transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result;
}

/** Deletes test-created users (sessions and accounts cascade). Patterns must target example.com. */
export async function deleteUsersByEmail(pattern: `${string}@example.com`): Promise<void> {
  await getDb().execute(sql`delete from "user" where email like ${pattern}`);
}

export async function deleteRateLimitsByKey(pattern: string): Promise<void> {
  await getDb().execute(sql`delete from rate_limit where key like ${pattern}`);
}
