import { withHandler } from '@/server/http/handler';
import { json } from '@/server/http/response';
import { deleteRule, patchRule, putRule } from '@/server/plan/service';
import {
  patchScheduleRuleInputSchema,
  putScheduleRuleInputSchema,
  scheduleRuleIdParamsSchema,
} from '@/shared/schemas/plan';

// Create with a client-generated id, so a retried request finds the same row (request-safety.md).
export const PUT = withHandler(
  { auth: 'required', params: scheduleRuleIdParamsSchema, body: putScheduleRuleInputSchema },
  async ({ userId, params, body }) => {
    const { items, created } = await putRule(userId, params.id, body);
    return json({ items }, { status: created ? 201 : 200 });
  },
);

// `newId` is the client id of the rule a split creates, so a retry does not split twice.
export const PATCH = withHandler(
  { auth: 'required', params: scheduleRuleIdParamsSchema, body: patchScheduleRuleInputSchema },
  async ({ userId, params, body }) => json(await patchRule(userId, params.id, body)),
);

export const DELETE = withHandler(
  { auth: 'required', params: scheduleRuleIdParamsSchema },
  async ({ userId, params }) => {
    await deleteRule(userId, params.id);
    return new Response(null, { status: 204 });
  },
);
