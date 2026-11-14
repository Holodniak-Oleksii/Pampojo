import { withHandler } from '@/server/http/handler';
import { requestLocale } from '@/server/http/locale';
import { json } from '@/server/http/response';
import { deleteWorkout, getWorkout, putWorkout } from '@/server/workouts/service';
import { putWorkoutInputSchema, workoutIdParamsSchema } from '@/shared/schemas/workout';

export const GET = withHandler(
  { auth: 'required', params: workoutIdParamsSchema },
  async ({ userId, params, request }) =>
    json(await getWorkout(userId, requestLocale(request), params.id)),
);

// Create or replace with a client-generated id, so a retried request writes the same row (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', params: workoutIdParamsSchema, body: putWorkoutInputSchema },
  async ({ userId, params, body, request }) =>
    json(await putWorkout(userId, requestLocale(request), params.id, body)),
);

export const DELETE = withHandler(
  { auth: 'required', params: workoutIdParamsSchema },
  async ({ userId, params }) => {
    await deleteWorkout(userId, params.id);
    return new Response(null, { status: 204 });
  },
);
