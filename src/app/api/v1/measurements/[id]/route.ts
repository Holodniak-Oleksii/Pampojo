import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { deleteMeasurement, putMeasurement } from '@/server/measurements/service';
import { measurementIdParamsSchema, putMeasurementInputSchema } from '@/shared/schemas/measurement';

// Create with a client-generated id, so a retried request finds the same row (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', params: measurementIdParamsSchema, body: putMeasurementInputSchema },
  async ({ userId, params, body }) => {
    const { item, created } = await putMeasurement(userId, params.id, body);
    return json({ item }, { status: created ? 201 : 200 });
  },
);

export const DELETE = withHandler(
  { auth: 'required', params: measurementIdParamsSchema },
  async ({ userId, params }) => {
    await deleteMeasurement(userId, params.id);
    return new Response(null, { status: 204 });
  },
);
