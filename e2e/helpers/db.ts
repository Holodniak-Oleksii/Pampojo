import { existsSync } from 'node:fs';
import postgres from 'postgres';

// e2e users live in the shared database; only addresses matching this pattern are ever deleted.
const E2E_EMAIL_PATTERN = 'e2e-%@example.com';

export async function deleteE2eUsers(): Promise<void> {
  if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
  const sql = postgres(process.env.DATABASE_URL ?? '', { prepare: false, max: 1 });
  try {
    await sql`delete from "user" where email like ${E2E_EMAIL_PATTERN}`;
    await sql`delete from rate_limit where key like ${'%198.51.100.%'}`;
  } finally {
    await sql.end();
  }
}
