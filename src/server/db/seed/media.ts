// `pnpm db:seed:media [--force]`: converts the dataset photos to WebP and uploads them to Storage.
// Runs under plain Node, so no `@/` imports. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { EXERCISE_MEDIA_BUCKET } from '../../../constants/exercise.ts';
import { mediaKeys, seedCatalogSchema } from './seed-schema.ts';

const DATASET_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const SOURCE_BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${DATASET_COMMIT}/exercises`;
const SIZES = { thumb: 160, full: 800 } as const;
const CONCURRENCY = 6;

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (see .env.example).');
}
const force = process.argv.includes('--force');
// New Supabase secret keys (`sb_secret_…`) are not JWTs and go in `apikey` only; legacy service_role JWTs need both.
const auth: Record<string, string> = serviceKey.startsWith('sb_')
  ? { apikey: serviceKey }
  : { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

interface Job {
  slug: string;
  sourceId: string;
  frame: number;
  keys: { thumb: string; full: string };
}

async function ensureBucket(): Promise<void> {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ id: EXERCISE_MEDIA_BUCKET, name: EXERCISE_MEDIA_BUCKET, public: true }),
  });
  if (response.ok) return;
  const text = await response.text();
  // Storage answers 400 or 409 with "already exists" when the bucket is there.
  if (!/already exists/i.test(text))
    throw new Error(`Bucket creation failed: ${response.status} ${text}`);
}

async function exists(key: string): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${key}`,
    { method: 'HEAD' },
  );
  return response.ok;
}

async function upload(key: string, body: Buffer): Promise<void> {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${EXERCISE_MEDIA_BUCKET}/${key}`, {
    method: 'POST',
    headers: {
      ...auth,
      'content-type': 'image/webp',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'true',
    },
    body: new Uint8Array(body),
  });
  if (!response.ok)
    throw new Error(`Upload ${key} failed: ${response.status} ${await response.text()}`);
}

async function run(job: Job): Promise<'uploaded' | 'skipped' | 'missing'> {
  if (!force && (await exists(job.keys.full)) && (await exists(job.keys.thumb))) return 'skipped';
  const source = await fetch(`${SOURCE_BASE}/${job.sourceId}/${job.frame}.jpg`);
  if (!source.ok) return 'missing';
  const original = Buffer.from(await source.arrayBuffer());
  for (const [size, width] of Object.entries(SIZES) as [keyof typeof SIZES, number][]) {
    const webp = await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    await upload(job.keys[size], webp);
  }
  return 'uploaded';
}

const entries = seedCatalogSchema.parse(
  JSON.parse(readFileSync(new URL('./exercises.json', import.meta.url), 'utf8')),
);
const jobs: Job[] = entries.flatMap((entry) =>
  mediaKeys(entry.slug).frames.map((keys, frame) => ({
    slug: entry.slug,
    sourceId: entry.sourceId,
    frame,
    keys,
  })),
);

await ensureBucket();

const summary = { uploaded: 0, skipped: 0, missing: [] as string[], failed: [] as string[] };
let next = 0;
async function worker(): Promise<void> {
  while (next < jobs.length) {
    const job = jobs[next++];
    if (!job) return;
    try {
      const result = await run(job);
      if (result === 'missing') summary.missing.push(`${job.slug}#${job.frame}`);
      else summary[result] += 1;
    } catch (error) {
      summary.failed.push(
        `${job.slug}#${job.frame}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`Frames uploaded: ${summary.uploaded}, skipped: ${summary.skipped}.`);
if (summary.missing.length > 0)
  console.warn(`Missing source images: ${summary.missing.join(', ')}`);
if (summary.failed.length > 0) {
  console.error(`Failed:\n${summary.failed.join('\n')}`);
  process.exitCode = 1;
}
