import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { completeOnboarding, getProfile, updateProfile } from '@/server/profile/service';
import { completeOnboardingInputSchema, updateProfileInputSchema } from '@/shared/schemas/profile';

export const GET = withHandler({ auth: 'required' }, async ({ userId }) =>
  json(await getProfile(userId)),
);

export const PUT = withHandler(
  { auth: 'required', body: completeOnboardingInputSchema },
  async ({ userId, body }) => json(await completeOnboarding(userId, body)),
);

export const PATCH = withHandler(
  { auth: 'required', body: updateProfileInputSchema },
  async ({ userId, body }) => json(await updateProfile(userId, body)),
);
