import { IMAGE_MAX_BYTES } from '@/constants/exercise';
import { deleteFrame, putFrame } from '@/server/exercises/write-service';
import { withHandler } from '@/server/http/handler';
import { DomainError } from '@/server/http/errors';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { IMAGE_ERROR } from '@/server/storage';
import { exerciseFrameParamsSchema } from '@/shared/schemas/exercise';

async function readFile(request: Request): Promise<{ bytes: Uint8Array; type: string }> {
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get('file');
  } catch {
    throw new DomainError(IMAGE_ERROR.INVALID, 'Expected multipart form data');
  }
  if (!(file instanceof File)) throw new DomainError(IMAGE_ERROR.INVALID, 'Missing file');
  // Checked before reading the bytes, so a huge upload is not buffered twice.
  if (file.size > IMAGE_MAX_BYTES) throw new DomainError(IMAGE_ERROR.TOO_LARGE, 'Image too large');
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type };
}

// The frame id comes from the client, so a retried upload overwrites the same frame.
export const PUT = withHandler(
  { auth: 'required', params: exerciseFrameParamsSchema },
  async ({ userId, params, request }) =>
    json(
      await putFrame(
        userId,
        requestLocale(request),
        params.id,
        params.frameId,
        await readFile(request),
      ),
    ),
);

export const DELETE = withHandler(
  { auth: 'required', params: exerciseFrameParamsSchema },
  async ({ userId, params, request }) =>
    json(await deleteFrame(userId, requestLocale(request), params.id, params.frameId)),
);
