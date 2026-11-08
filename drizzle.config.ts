import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// CI passes real env vars; locally they come from .env.local.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  throw new Error('DATABASE_MIGRATION_URL is missing. Set it in .env.local (see .env.example).');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dbCredentials: { url },
});
