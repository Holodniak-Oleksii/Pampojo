import 'server-only';
import { z } from 'zod';

export interface HistoryCursor {
  startedAt: Date;
  id: string;
}

const payloadSchema = z.object({ s: z.iso.datetime({ offset: true }), i: z.uuid() }).strict();

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify({ s: cursor.startedAt.toISOString(), i: cursor.id })).toString(
    'base64url',
  );
}

/** Null for anything that is not a cursor this server made. */
export function decodeHistoryCursor(value: string): HistoryCursor | null {
  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    return parsed.success ? { startedAt: new Date(parsed.data.s), id: parsed.data.i } : null;
  } catch {
    return null;
  }
}
