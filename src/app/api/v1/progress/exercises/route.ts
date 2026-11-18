import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { listProgressExercises } from '@/server/progress/service';

export const GET = withHandler({ auth: 'required' }, async ({ userId, request }) =>
  json(await listProgressExercises(userId, requestLocale(request))),
);
