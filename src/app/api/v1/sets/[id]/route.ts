import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { deleteSet, patchSet, putSet } from '@/server/sessions/service';
import {
  patchSetInputSchema,
  putSetInputSchema,
  setIdParamsSchema,
} from '@/shared/schemas/session';

// Create or replace with a client-generated id, so a retried request writes the same row.
export const PUT = withHandler(
  { auth: 'required', params: setIdParamsSchema, body: putSetInputSchema },
  async ({ userId, params, body }) => json(await putSet(userId, params.id, body)),
);

export const PATCH = withHandler(
  { auth: 'required', params: setIdParamsSchema, body: patchSetInputSchema },
  async ({ userId, params, body }) => json(await patchSet(userId, params.id, body)),
);

export const DELETE = withHandler(
  { auth: 'required', params: setIdParamsSchema },
  async ({ userId, params }) => {
    await deleteSet(userId, params.id);
    return new Response(null, { status: 204 });
  },
);
