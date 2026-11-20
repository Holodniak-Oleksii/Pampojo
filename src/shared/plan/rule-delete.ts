import { addDays } from './occurrences';

/** What a delete does to the list: a started rule ends yesterday, a future one disappears. */
export function applyRuleDelete<
  T extends { id: string; startDate: string; endDate: string | null },
>(items: readonly T[], id: string, today: string): T[] {
  return items.flatMap((rule) => {
    if (rule.id !== id) return [rule];
    if (rule.endDate !== null && rule.endDate < today) return [rule];
    if (rule.startDate < today) return [{ ...rule, endDate: addDays(today, -1) }];
    return [];
  });
}
