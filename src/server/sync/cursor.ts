import 'server-only';
import { z } from 'zod';
import { SYNC_PHASES } from '@/constants/sync';
import { invalidCursor } from './errors';

const afterSchema = z.object({ at: z.string().max(64).nullable(), id: z.uuid() }).strict();

const runSchema = z
  .object({
    v: z.literal(1),
    low: z.string().max(64).nullable(),
    high: z.string().max(64),
    phase: z
      .number()
      .int()
      .min(0)
      .max(SYNC_PHASES.length - 1),
    after: afterSchema.nullable(),
  })
  .strict();

const doneSchema = z.object({ v: z.literal(1), high: z.string().max(64) }).strict();

/** Position inside a pull run. `low` is null for a full download. */
export type PullRun = z.infer<typeof runSchema>;
export type PullAfter = z.infer<typeof afterSchema>;

export type DecodedCursor = { kind: 'run'; run: PullRun } | { kind: 'done'; high: string };

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function encodeRunCursor(run: PullRun): string {
  return encode(run);
}

export function encodeDoneCursor(high: string): string {
  return encode({ v: 1, high });
}

export function decodePullCursor(cursor: string): DecodedCursor {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  const run = runSchema.safeParse(value);
  if (run.success) return { kind: 'run', run: run.data };
  const done = doneSchema.safeParse(value);
  if (done.success) return { kind: 'done', high: done.data.high };
  throw invalidCursor();
}
