import { describe, expect, it } from 'vitest';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { addMonths, isEditable, occurrencesByDate, weeksOfMonth } from '../utils';

const rule = (overrides: Partial<ScheduleRule> = {}): ScheduleRule => ({
  id: 'r1',
  workoutId: 'w1',
  startDate: '2026-11-02',
  endDate: null,
  weekdays: [1, 4],
  intervalWeeks: 1,
  updatedAt: '2026-11-01T00:00:00.000Z',
  workout: { id: 'w1', name: 'Push Day', exerciseCount: 5, deleted: false },
  ...overrides,
});

describe('calendar utils', () => {
  it('builds Monday-first weeks', () => {
    const november = weeksOfMonth('2026-11');
    expect(november[0]).toBe('2026-10-26');
    expect(november).toHaveLength(42);
    expect(november.at(-1)).toBe('2026-12-06');
    expect(weeksOfMonth('2027-02')).toHaveLength(28);
  });

  it('moves across years', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('groups occurrences by date (AC1)', () => {
    const map = occurrencesByDate([rule()], '2026-11-01', '2026-11-08');
    expect([...map.keys()]).toEqual(['2026-11-02', '2026-11-05']);
  });

  it('locks ended rules and deleted workouts', () => {
    expect(isEditable(rule(), '2026-11-15')).toBe(true);
    expect(isEditable(rule({ endDate: '2026-11-14' }), '2026-11-15')).toBe(false);
    expect(
      isEditable(rule({ workout: { id: 'w1', name: 'x', exerciseCount: 1, deleted: true } }), '2026-11-15'),
    ).toBe(false);
  });
});
