import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { applyPush } from '@/server/sync/push';
import { pushRequestSchema } from '@/shared/schemas/sync';

// Idempotent by mutation id (request-safety.md rule 3), so it needs no Idempotency-Key.
export const POST = withHandler(
  { auth: 'required', body: pushRequestSchema },
  async ({ userId, body }) => json({ results: await applyPush(userId, body.mutations) }),
);
