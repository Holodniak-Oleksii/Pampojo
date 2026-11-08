import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export const HEALTH_TIMEOUT_MS = 5000;

export interface HealthStatus {
  ok: boolean;
  db: boolean;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Database did not answer within ${ms} ms`)), ms);
  });
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    await Promise.race([getDb().execute(sql`select 1`), timeout(HEALTH_TIMEOUT_MS)]);
    return { ok: true, db: true };
  } catch (error) {
    console.error('[health]', error);
    return { ok: false, db: false };
  }
}
