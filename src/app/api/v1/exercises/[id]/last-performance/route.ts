import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { getLastPerformance } from '@/server/sessions/service';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';

export const GET = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema },
  async ({ userId, params }) => json(await getLastPerformance(userId, params.id)),
);
