import 'server-only';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@/server/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

// Kept on globalThis so dev hot reload reuses one pool instead of opening a new one per edit.
const globalForDb = globalThis as typeof globalThis & { pampojoDb?: Db };

// Created on first use so `next build` and module imports never open a connection.
export function getDb(): Db {
  globalForDb.pampojoDb ??= drizzle(
    // The Supabase transaction pooler does not support prepared statements.
    postgres(getEnv().DATABASE_URL, { prepare: false, max: 5, connect_timeout: 5 }),
    { schema },
  );
  return globalForDb.pampojoDb;
}
