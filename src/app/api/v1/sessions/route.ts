import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { listSessions } from '@/server/sessions/service';
import { sessionListQuerySchema } from '@/shared/schemas/session';

export const GET = withHandler(
  { auth: 'required', query: sessionListQuerySchema },
  async ({ userId, query }) => json(await listSessions(userId, query)),
);
