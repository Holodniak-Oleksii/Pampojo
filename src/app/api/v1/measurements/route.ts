import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { listMeasurements } from '@/server/measurements/service';

export const GET = withHandler({ auth: 'required' }, async ({ userId }) =>
  json(await listMeasurements(userId)),
);
