import { getGym, saveGym } from '@/server/gym/service';
import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { putGymInputSchema } from '@/shared/schemas/gym';

export const GET = withHandler({ auth: 'required' }, async ({ userId }) =>
  json(await getGym(userId)),
);

// A natural upsert keyed by the user, so a retried request is safe (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', body: putGymInputSchema },
  async ({ userId, body }) => json(await saveGym(userId, body.equipment)),
);
