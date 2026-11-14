import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { listWorkouts } from '@/server/workouts/service';

export const GET = withHandler({ auth: 'required' }, async ({ userId, request }) =>
  json(await listWorkouts(userId, requestLocale(request))),
);
