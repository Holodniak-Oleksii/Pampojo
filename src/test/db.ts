import { randomUUID } from 'node:crypto';
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

// Module state is per test file, and CI runs share the database. Thus a cleanup pattern with this id
// deletes only the users of this file run, not the users of a parallel file or run.
const RUN_ID = randomUUID().slice(0, 8);

/** The email prefix of test users: `test-<scope>-<run id>`. Emails are `${prefix}-<uuid>@example.com`. */
export function testPrefix(scope: string): string {
  return `test-${scope}-${RUN_ID}`;
}

/** Deletes test-created users (sessions and accounts cascade). Patterns must target example.com. */
export async function deleteUsersByEmail(pattern: `${string}@example.com`): Promise<void> {
  await getDb().execute(sql`delete from "user" where email like ${pattern}`);
}

export async function deleteRateLimitsByKey(pattern: string): Promise<void> {
  await getDb().execute(sql`delete from rate_limit where key like ${pattern}`);
}
