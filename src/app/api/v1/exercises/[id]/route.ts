import { getExercise } from '@/server/exercises/service';
import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';

export const GET = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema },
  async ({ userId, params, request }) =>
    json(await getExercise(userId, requestLocale(request), params.id)),
);
