// `pnpm db:seed`: loads the system exercise catalog. Runs under plain Node, so no `@/` imports.
import { existsSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
import { seedCatalog } from './catalog.ts';
import { seedCatalogSchema } from './seed-schema.ts';

if (!process.env.DATABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is missing. Set it in .env.local (see .env.example).');

const entries = seedCatalogSchema.parse(
  JSON.parse(readFileSync(new URL('./exercises.json', import.meta.url), 'utf8')),
);

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
try {
  const result = await sql.begin((tx) => seedCatalog(tx, entries));
  console.log(`Seeded ${result.exercises} exercises and ${result.translations} translations.`);
} finally {
  await sql.end();
}
