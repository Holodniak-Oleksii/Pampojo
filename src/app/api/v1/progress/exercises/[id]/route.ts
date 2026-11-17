import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { getExerciseProgress } from '@/server/progress/service';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';
import { progressQuerySchema } from '@/shared/schemas/progress';

export const GET = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema, query: progressQuerySchema },
  async ({ userId, params, query, request }) =>
    json(await getExerciseProgress(userId, requestLocale(request), params.id, query.range)),
);
