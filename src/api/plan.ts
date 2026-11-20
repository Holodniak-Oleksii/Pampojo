import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  applyLocalRuleDelete,
  listLocalRules,
  putLocalRules,
  useLocalQuery,
  useOptionalLocalDb,
} from '@/services/local-db';
import { requestSync } from '@/services/sync/request-sync';
import {
  scheduleRuleListResponseSchema,
  type PatchScheduleRuleInput,
  type PutScheduleRuleInput,
  type ScheduleRuleListResponse,
} from '@/shared/schemas/plan';
import { calendarKeys } from './calendar';
import { http } from './http';

import { applyRuleDelete } from '@/shared/plan/rule-delete';

export { applyRuleDelete };

const RULES_PATH = '/api/v1/schedule-rules';

export const planKeys = {
  all: ['schedule-rules'] as const,
  list: () => [...planKeys.all, 'list'] as const,
};

const rulePath = (id: string) => `${RULES_PATH}/${id}`;

export function fetchScheduleRules(): Promise<ScheduleRuleListResponse> {
  return http(RULES_PATH, { schema: scheduleRuleListResponseSchema });
}

/** Creates with a client id; repeating the call is safe (request-safety.md). */
export function putScheduleRule(
  id: string,
  input: PutScheduleRuleInput,
): Promise<ScheduleRuleListResponse> {
  return http(rulePath(id), { method: 'PUT', body: input, schema: scheduleRuleListResponseSchema });
}

/** `input.newId` names the rule a split creates, so a retry does not split twice. */
export function patchScheduleRule(
  id: string,
  input: PatchScheduleRuleInput,
): Promise<ScheduleRuleListResponse> {
  return http(rulePath(id), {
    method: 'PATCH',
    body: input,
    schema: scheduleRuleListResponseSchema,
  });
}

export async function deleteScheduleRule(id: string): Promise<void> {
  await http(rulePath(id), { method: 'DELETE' });
}

// A rule change moves occurrences, so the statuses of the calendar change with it.
function invalidatePlan(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: planKeys.all });
  void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  requestSync();
}

export function useScheduleRulesQuery() {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: planKeys.list(),
    db,
    read: listLocalRules,
    remote: fetchScheduleRules,
  });
}

export function usePutScheduleRuleMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PutScheduleRuleInput }) => {
      const response = await putScheduleRule(id, input);
      if (db) await putLocalRules(db, response.items);
      return response;
    },
    onSuccess: () => invalidatePlan(queryClient),
  });
}

export function usePatchScheduleRuleMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PatchScheduleRuleInput }) => {
      const response = await patchScheduleRule(id, input);
      if (db) await putLocalRules(db, response.items);
      return response;
    },
    onSuccess: () => invalidatePlan(queryClient),
  });
}

export function useDeleteScheduleRuleMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async ({ id, today }: { id: string; today: string }) => {
      await deleteScheduleRule(id);
      if (db) await applyLocalRuleDelete(db, id, today);
    },
    onMutate: async ({ id, today }) => {
      await queryClient.cancelQueries({ queryKey: planKeys.list() });
      const previous = queryClient.getQueryData<ScheduleRuleListResponse>(planKeys.list());
      if (previous) {
        queryClient.setQueryData<ScheduleRuleListResponse>(planKeys.list(), {
          items: applyRuleDelete(previous.items, id, today),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(planKeys.list(), context.previous);
    },
    onSettled: () => invalidatePlan(queryClient),
  });
}
