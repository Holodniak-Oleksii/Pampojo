import 'server-only';
import { EXERCISE_MEDIA_BUCKET } from '@/constants/exercise';
import { getEnv } from '@/server/env';
import type { ExerciseMedia } from '@/shared/schemas/exercise';

/** Public Storage URL of a media key, or null when Storage is not configured (images fall back to a placeholder). */
export function publicMediaUrl(key: string): string | null {
  const base = getEnv().SUPABASE_URL?.replace(/\/$/, '');
  return base ? `${base}/storage/v1/object/public/${EXERCISE_MEDIA_BUCKET}/${key}` : null;
}

export function toFrames(media: ExerciseMedia): { thumbUrl: string; fullUrl: string }[] {
  return media.frames.flatMap((frame) => {
    const thumbUrl = publicMediaUrl(frame.thumb);
    const fullUrl = publicMediaUrl(frame.full);
    return thumbUrl && fullUrl ? [{ thumbUrl, fullUrl }] : [];
  });
}

export function firstFrame(media: ExerciseMedia): {
  thumbnailUrl: string | null;
  imageUrl: string | null;
} {
  const frame = media.frames[0];
  return {
    thumbnailUrl: frame ? publicMediaUrl(frame.thumb) : null,
    imageUrl: frame ? publicMediaUrl(frame.full) : null,
  };
}
