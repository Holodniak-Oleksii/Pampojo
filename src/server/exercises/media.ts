import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import {
  EXERCISE_MEDIA_BUCKET,
  EXERCISE_USER_MEDIA_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from '@/constants/exercise';
import { getEnv } from '@/server/env';
import { isStorageConfigured, signUrls } from '@/server/storage';
import type { ExerciseFrame, ExerciseMedia } from '@/shared/schemas/exercise';

/** Public Storage URL of a system media key, or null when Storage is not configured (placeholder). */
export function publicMediaUrl(key: string): string | null {
  const base = getEnv().SUPABASE_URL?.replace(/\/$/, '');
  return base ? `${base}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${key}` : null;
}

/** Storage keys of an own exercise's frame in the private bucket. */
export function ownFrameKeys(userId: string, exerciseId: string, frameId: string) {
  const prefix = `users/${userId}/${exerciseId}/${frameId}`;
  return { thumb: `${prefix}-thumb.webp`, full: `${prefix}-full.webp` };
}

interface MediaRow {
  owner_id: string | null;
  media: ExerciseMedia;
}

/**
 * Frame URLs for many rows: public URLs for system rows, signed URLs for own rows.
 * Own keys of every row are signed in one Storage request, so a list stays one SQL query plus one call.
 */
export async function resolveFrames(rows: readonly MediaRow[]): Promise<ExerciseFrame[][]> {
  const ownKeys = rows
    .filter((row) => row.owner_id !== null)
    .flatMap((row) => row.media.frames.flatMap((frame) => [frame.thumb, frame.full]));
  const signed =
    ownKeys.length > 0 && isStorageConfigured()
      ? await signUrls(EXERCISE_USER_MEDIA_BUCKET, ownKeys, SIGNED_URL_TTL_SECONDS).catch(
          (error: unknown) => {
            // A prerender that ends early rejects its fetches; Next must see that error, not a log line.
            unstable_rethrow(error);
            console.error('[storage] signing failed', error);
            return new Map<string, string>();
          },
        )
      : new Map<string, string>();

  return rows.map((row) =>
    row.media.frames.flatMap((frame) => {
      const own = row.owner_id !== null;
      const thumbUrl = own ? signed.get(frame.thumb) : publicMediaUrl(frame.thumb);
      const fullUrl = own ? signed.get(frame.full) : publicMediaUrl(frame.full);
      return thumbUrl && fullUrl ? [{ id: frame.id ?? null, thumbUrl, fullUrl }] : [];
    }),
  );
}
