import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { pullChanges } from '@/server/sync/pull';
import { pullQuerySchema } from '@/shared/schemas/sync';

export const GET = withHandler(
  { auth: 'required', query: pullQuerySchema },
  async ({ userId, query }) => json(await pullChanges(userId, query.since)),
);
