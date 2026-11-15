import { addDays, expandOccurrences, isoWeekday } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';

/** `YYYY-MM` of a date. */
export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = (y ?? 0) * 12 + (m ?? 1) - 1 + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The Monday-first grid of a month: whole weeks, 5 or 6 of them. */
export function weeksOfMonth(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, 1 - isoWeekday(first));
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const end = addDays(last, 7 - isoWeekday(last));
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Rules occurring on each date of `[from, to]`. */
export function occurrencesByDate(
  rules: readonly ScheduleRule[],
  from: string,
  to: string,
): Map<string, ScheduleRule[]> {
  const byDate = new Map<string, ScheduleRule[]>();
  for (const rule of rules) {
    for (const date of expandOccurrences(rule, from, to)) {
      const list = byDate.get(date) ?? [];
      list.push(rule);
      byDate.set(date, list);
    }
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.workout.name.localeCompare(b.workout.name));
  }
  return byDate;
}

/** A rule can still change: it has not ended and its workout exists. */
export function isEditable(rule: ScheduleRule, today: string): boolean {
  return !rule.workout.deleted && (rule.endDate === null || rule.endDate >= today);
}
