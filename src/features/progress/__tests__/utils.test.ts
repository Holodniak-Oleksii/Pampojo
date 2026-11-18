import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';
import { i18nextOptions, type Locale } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';
import { dayMonth } from '@/features/plan';
import { chartSummary } from '../utils';

function tFor(locale: Locale) {
  const instance = createInstance();
  void instance.init(i18nextOptions(locale, locale === 'uk' ? uk : en));
  return instance.t;
}

const input = (locale: Locale, series: { date: string; value: number }[]) => ({
  metric: 'e1rmKg' as const,
  exercise: 'Bench Press',
  range: '3m' as const,
  series,
  formatDate: (date: string) => dayMonth(locale, date),
});

describe('chartSummary (AC8)', () => {
  it('is empty with no points', () => {
    expect(chartSummary(tFor('en'), 'en', input('en', []))).toBe('');
  });

  it('leaves out the change with one point', () => {
    const series = [{ date: '2026-07-21', value: 116.67 }];
    expect(chartSummary(tFor('en'), 'en', input('en', series))).toBe(
      'Estimated 1RM, Bench Press: 116.7 kg July 21, 1 workout',
    );
  });

  it('gives the change over the range with two points or more', () => {
    const series = [
      { date: '2026-08-25', value: 98.17 },
      { date: '2026-11-17', value: 99 },
    ];
    expect(chartSummary(tFor('uk'), 'uk', input('uk', series))).toBe(
      'Оцінка 1ПМ, Bench Press: 99 кг 17 листопада, +0,8 кг за 3 місяці, 2 тренування',
    );
  });
});
