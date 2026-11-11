import { IMAGE_MAX_BYTES, IMAGE_TYPES, IMAGE_UPLOAD_MAX_SIDE } from '@/constants/exercise';

export const IMAGE_PICK_ERROR = { TYPE: 'type', SIZE: 'size' } as const;
export type ImagePickError = (typeof IMAGE_PICK_ERROR)[keyof typeof IMAGE_PICK_ERROR];

export class ImagePickFailure extends Error {
  constructor(readonly reason: ImagePickError) {
    super(reason);
  }
}

/**
 * Checks a picked photo and scales it to the upload size. JPEG, because Safari cannot encode WebP
 * from a canvas; the server converts to WebP anyway. Keeps requests far below Vercel's body limit.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImagePickFailure(IMAGE_PICK_ERROR.TYPE);
  }
  if (file.size > IMAGE_MAX_BYTES) throw new ImagePickFailure(IMAGE_PICK_ERROR.SIZE);

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, IMAGE_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImagePickFailure(IMAGE_PICK_ERROR.TYPE))),
      'image/jpeg',
      0.85,
    ),
  );
}
