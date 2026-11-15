import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { listRules } from '@/server/plan/service';

export const GET = withHandler({ auth: 'required' }, async ({ userId }) =>
  json(await listRules(userId)),
);
