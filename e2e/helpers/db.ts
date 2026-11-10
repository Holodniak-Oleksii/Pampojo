import { existsSync } from 'node:fs';
import postgres from 'postgres';

/**
 * e2e users live in the shared database; only `e2e-<prefix>…@example.com` addresses are ever deleted.
 * Each spec file owns a prefix and an IP range. The mobile and desktop projects run the same file in
 * parallel workers, so callers add a per-worker run id to the prefix (see `e2eRunPrefix`).
 */
export async function deleteE2eUsers(prefix: string, ipRange: string): Promise<void> {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  const sql = postgres(process.env.DATABASE_URL ?? '', { prepare: false, max: 1 });
  try {
    await sql`delete from "user" where email like ${`e2e-${prefix}-%@example.com`}`;
    await sql`delete from rate_limit where key like ${`%${ipRange}.%`}`;
  } finally {
    await sql.end();
  }
}

// Module state is per worker process, so this id differs between parallel workers.
const RUN_ID = Math.random().toString(36).slice(2, 10);

export function e2eRunPrefix(file: string): string {
  return `${file}-${RUN_ID}`;
}
