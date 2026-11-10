import { listExercises } from '@/server/exercises/service';
import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { listExercisesQuerySchema } from '@/shared/schemas/exercise';

export const GET = withHandler(
  { auth: 'required', query: listExercisesQuerySchema },
  async ({ userId, query, request }) =>
    json(await listExercises(userId, requestLocale(request), query)),
);
