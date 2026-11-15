import { createInstance, type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { i18nextOptions, type Locale } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';
import { dayHeading, monthTitle, nextDateLabel, shortDate } from '../formatPlanDate';
import { resolveScheduledFor, type ScheduledSession } from '../resolveScheduledFor';
import { ruleSummary } from '../ruleSummary';

function translator(locale: Locale): TFunction {
  const instance = createInstance();
  void instance.init(i18nextOptions(locale, locale === 'uk' ? uk : en));
  return instance.t;
}

const WORKOUT = 'w1';
const TODAY = '2026-11-16'; // a Monday
const rules = [
  { workoutId: WORKOUT, startDate: '2026-11-01', endDate: null, weekdays: [1, 4], intervalWeeks: 1 },
];
const session = (overrides: Partial<ScheduledSession>): ScheduledSession => ({
  id: 's1',
  workoutId: WORKOUT,
  scheduledFor: TODAY,
  status: 'completed',
  ...overrides,
});

describe('resolveScheduledFor (AC4)', () => {
  it('links a workout planned today with no session yet', () => {
    expect(resolveScheduledFor({ workoutId: WORKOUT, rules, today: TODAY, sessions: [] })).toBe(
      TODAY,
    );
  });

  it('does not link a workout that is already done or running today', () => {
    for (const status of ['completed', 'in_progress'] as const) {
      expect(
        resolveScheduledFor({
          workoutId: WORKOUT,
          rules,
          today: TODAY,
          sessions: [session({ status })],
        }),
      ).toBeNull();
    }
  });

  it('links again after an abandoned session', () => {
    expect(
      resolveScheduledFor({
        workoutId: WORKOUT,
        rules,
        today: TODAY,
        sessions: [session({ status: 'abandoned' })],
      }),
    ).toBe(TODAY);
  });

  it('does not link an unplanned workout or another day', () => {
    expect(resolveScheduledFor({ workoutId: 'w2', rules, today: TODAY, sessions: [] })).toBeNull();
    expect(
      resolveScheduledFor({ workoutId: WORKOUT, rules, today: '2026-11-17', sessions: [] }),
    ).toBeNull();
  });
});

describe('ruleSummary', () => {
  const base = { startDate: TODAY, endDate: null, weekdays: [1, 4], intervalWeeks: 1 };

  it('describes weekly rules in Ukrainian', () => {
    const t = translator('uk');
    expect(ruleSummary(t, 'uk', base)).toBe('Щопонеділка й щочетверга');
    expect(ruleSummary(t, 'uk', { ...base, weekdays: [1, 3, 5] })).toBe(
      'Щопонеділка, щосереди й щоп\'ятниці',
    );
    expect(ruleSummary(t, 'uk', { ...base, intervalWeeks: 2 })).toBe('Кожні 2 тижні: пн, чт');
    expect(ruleSummary(t, 'uk', { ...base, weekdays: [1, 2, 3, 4, 5, 6, 7] })).toBe('Щодня');
    expect(ruleSummary(t, 'uk', { ...base, weekdays: [], endDate: TODAY })).toBe('Один раз');
  });

  it('describes weekly rules in English', () => {
    const t = translator('en');
    expect(ruleSummary(t, 'en', base)).toBe('Every Monday and Thursday');
    expect(ruleSummary(t, 'en', { ...base, intervalWeeks: 3 })).toBe('Every 3 weeks: Mon, Thu');
  });
});

describe('plan date labels', () => {
  it('formats headings, the next date and the last date', () => {
    const t = translator('uk');
    expect(dayHeading(t, 'uk', '2026-11-15', '2026-11-15')).toBe('Сьогодні, неділя, 15 листопада');
    expect(dayHeading(t, 'uk', '2026-12-03', '2026-11-15')).toBe('Четвер, 3 грудня');
    expect(nextDateLabel(t, 'uk', '2026-11-18', 3)).toBe('у середу, 18 листопада');
    expect(shortDate('uk', '2026-12-10')).toBe('чт, 10 грудня');
    expect(monthTitle('uk', '2026-11')).toBe('Листопад 2026');
    expect(monthTitle('en', '2026-11')).toBe('November 2026');
    expect(nextDateLabel(translator('en'), 'en', '2026-11-18', 3)).toBe(
      'on Wednesday, November 18',
    );
  });
});
