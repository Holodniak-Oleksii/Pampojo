import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { getSession, patchSession, putSession } from '@/server/sessions/service';
import {
  patchSessionInputSchema,
  putSessionInputSchema,
  sessionIdParamsSchema,
} from '@/shared/schemas/session';

export const GET = withHandler(
  { auth: 'required', params: sessionIdParamsSchema },
  async ({ userId, params }) => json(await getSession(userId, params.id)),
);

// Create with a client-generated id, so a replayed outbox entry finds the same row (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', params: sessionIdParamsSchema, body: putSessionInputSchema },
  async ({ userId, params, body }) => json(await putSession(userId, params.id, body)),
);

export const PATCH = withHandler(
  { auth: 'required', params: sessionIdParamsSchema, body: patchSessionInputSchema },
  async ({ userId, params, body }) => json(await patchSession(userId, params.id, body)),
);
