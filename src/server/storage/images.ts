import 'server-only';
import sharp from 'sharp';
import { IMAGE_TYPES } from '@/constants/exercise';
import { DomainError } from '@/server/http/errors';

export const IMAGE_ERROR = { INVALID: 'IMAGE_INVALID', TOO_LARGE: 'IMAGE_TOO_LARGE' } as const;

const FORMATS = new Set(['jpeg', 'png', 'webp']);
const WIDTHS = { thumb: 160, full: 800 } as const;

function isAllowedType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

/** Validates an uploaded photo and returns WebP in the catalog's two sizes. */
export async function toWebpFrames(
  buffer: Uint8Array,
  mimeType: string,
): Promise<{ thumb: Buffer; full: Buffer }> {
  if (!isAllowedType(mimeType))
    throw new DomainError(IMAGE_ERROR.INVALID, 'Unsupported image type');
  let format: string | undefined;
  try {
    format = (await sharp(buffer).metadata()).format;
  } catch {
    throw new DomainError(IMAGE_ERROR.INVALID, 'Not an image');
  }
  if (!format || !FORMATS.has(format))
    throw new DomainError(IMAGE_ERROR.INVALID, 'Unsupported image');

  const convert = (width: number) =>
    // rotate() applies the EXIF orientation that phone photos carry.
    sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
  const [thumb, full] = await Promise.all([convert(WIDTHS.thumb), convert(WIDTHS.full)]);
  return { thumb, full };
}
