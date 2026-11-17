import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { addDays } from '@/shared/plan/occurrences';
import {
  scheduleRuleListResponseSchema,
  type PatchScheduleRuleInput,
  type PutScheduleRuleInput,
  type ScheduleRule,
  type ScheduleRuleListResponse,
} from '@/shared/schemas/plan';
import { calendarKeys } from './calendar';
import { http } from './http';

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
}

export function useScheduleRulesQuery() {
  return useQuery({ queryKey: planKeys.list(), queryFn: fetchScheduleRules, staleTime: 60_000 });
}

export function usePutScheduleRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PutScheduleRuleInput }) =>
      putScheduleRule(id, input),
    onSuccess: () => invalidatePlan(queryClient),
  });
}

export function usePatchScheduleRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchScheduleRuleInput }) =>
      patchScheduleRule(id, input),
    onSuccess: () => invalidatePlan(queryClient),
  });
}

/** What a delete does to the list: a started rule ends yesterday, a future one disappears. */
export function applyRuleDelete(
  items: readonly ScheduleRule[],
  id: string,
  today: string,
): ScheduleRule[] {
  return items.flatMap((rule) => {
    if (rule.id !== id) return [rule];
    if (rule.endDate !== null && rule.endDate < today) return [rule];
    if (rule.startDate < today) return [{ ...rule, endDate: addDays(today, -1) }];
    return [];
  });
}

export function useDeleteScheduleRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; today: string }) => deleteScheduleRule(id),
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
