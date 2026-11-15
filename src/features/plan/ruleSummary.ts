import type { TFunction } from 'i18next';
import type { Locale } from '@/i18n/config';
import type { RuleShape } from '@/shared/plan/occurrences';
import { capitalize, weekdayEvery, weekdayShort } from './formatPlanDate';

function joinList(t: TFunction, items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return t('{{a}} and {{b}}', { a: items.slice(0, -1).join(', '), b: items.at(-1) });
}

/** "Щопонеділка й щочетверга", "Кожні 2 тижні: пн, чт", "Один раз". */
export function ruleSummary(t: TFunction, locale: Locale, rule: RuleShape): string {
  if (rule.weekdays.length === 0) return t('Once');
  if (rule.intervalWeeks === 1) {
    if (rule.weekdays.length === 7) return t('Every day');
    const names = rule.weekdays.map((day) => weekdayEvery(t, day));
    return capitalize(locale, t('Every {{days}}', { days: joinList(t, names) }));
  }
  return t('Every {{count}} weeks: {{days}}', {
    count: rule.intervalWeeks,
    days: rule.weekdays.map((day) => weekdayShort(locale, day)).join(', '),
  });
}
