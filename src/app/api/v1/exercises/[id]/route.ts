import { getExercise } from '@/server/exercises/service';
import {
  createOwnExercise,
  deleteOwnExercise,
  updateOwnExercise,
} from '@/server/exercises/write-service';
import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import {
  createExerciseInputSchema,
  exerciseIdParamsSchema,
  updateExerciseInputSchema,
} from '@/shared/schemas/exercise';

export const GET = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema },
  async ({ userId, params, request }) =>
    json(await getExercise(userId, requestLocale(request), params.id)),
);

// Create with a client-generated id, so a retried request finds the same row (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema, body: createExerciseInputSchema },
  async ({ userId, params, body, request }) =>
    json(await createOwnExercise(userId, requestLocale(request), params.id, body)),
);

export const PATCH = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema, body: updateExerciseInputSchema },
  async ({ userId, params, body, request }) =>
    json(await updateOwnExercise(userId, requestLocale(request), params.id, body)),
);

export const DELETE = withHandler(
  { auth: 'required', params: exerciseIdParamsSchema },
  async ({ userId, params }) => {
    await deleteOwnExercise(userId, params.id);
    return new Response(null, { status: 204 });
  },
);
