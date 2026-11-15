import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addYears,
  expandOccurrences,
  firstCommonDate,
  isoWeekday,
  nextOccurrence,
  nthOccurrence,
  occursOn,
  type RuleShape,
} from '../occurrences';

const weekly = (overrides: Partial<RuleShape> = {}): RuleShape => ({
  startDate: '2026-11-16',
  endDate: null,
  weekdays: [1, 4],
  intervalWeeks: 1,
  ...overrides,
});

describe('isoWeekday', () => {
  it('numbers Monday 1 and Sunday 7', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-15')).toBe(7);
    expect(isoWeekday('1970-01-01')).toBe(4);
  });
});

describe('expandOccurrences', () => {
  it('yields Mondays and Thursdays up to the end date inclusive (AC1)', () => {
    const rule = weekly({ startDate: '2027-02-15', endDate: '2027-03-01' });
    expect(expandOccurrences(rule, '2027-01-01', '2027-04-01')).toEqual([
      '2027-02-15',
      '2027-02-18',
      '2027-02-22',
      '2027-02-25',
      '2027-03-01',
    ]);
  });

  it('starts on the start date even mid-week', () => {
    const rule = weekly({ startDate: '2026-11-17' });
    expect(expandOccurrences(rule, '2026-11-16', '2026-11-24')).toEqual([
      '2026-11-19',
      '2026-11-23',
    ]);
  });

  it('yields one date for a one-off (AC2)', () => {
    const rule = weekly({ weekdays: [], startDate: '2026-12-03', endDate: '2026-12-03' });
    expect(expandOccurrences(rule, '2026-11-01', '2027-01-31')).toEqual(['2026-12-03']);
  });

  it('counts every 2 weeks from the start week, not the start date (AC3)', () => {
    // The start is a Wednesday; the Monday of that week is week 0 even though it is before the start.
    const rule = weekly({ startDate: '2026-11-18', weekdays: [1, 5], intervalWeeks: 2 });
    expect(expandOccurrences(rule, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-20',
      '2026-11-30',
      '2026-12-04',
      '2026-12-14',
      '2026-12-18',
      '2026-12-28',
    ]);
  });
});

describe.each(['Europe/Kyiv', 'America/New_York'])('across DST in %s (AC3)', (zone) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  it('keeps the same dates through the spring and autumn changes', () => {
    const rule = weekly({ startDate: '2027-03-01', weekdays: [7], intervalWeeks: 1 });
    expect(expandOccurrences(rule, '2027-03-01', '2027-04-04')).toEqual([
      '2027-03-07',
      '2027-03-14',
      '2027-03-21',
      '2027-03-28',
      '2027-04-04',
    ]);
    const autumn = weekly({ startDate: '2027-10-25', weekdays: [7], intervalWeeks: 1 });
    expect(expandOccurrences(autumn, '2027-10-25', '2027-11-14')).toEqual([
      '2027-10-31',
      '2027-11-07',
      '2027-11-14',
    ]);
  });
});

describe('nthOccurrence', () => {
  it('returns the 5th date (AC2)', () => {
    expect(nthOccurrence(weekly(), 5)).toBe('2026-11-30');
    expect(nthOccurrence(weekly(), 1)).toBe('2026-11-16');
  });

  it('returns null past the two-year horizon', () => {
    const rule = weekly({ weekdays: [1], intervalWeeks: 4 });
    expect(nthOccurrence(rule, 100)).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('finds the next date after a given day', () => {
    expect(nextOccurrence(weekly(), '2026-11-16')).toBe('2026-11-19');
    expect(nextOccurrence(weekly(), '2026-11-01')).toBe('2026-11-16');
  });

  it('respects the interval and the end', () => {
    const rule = weekly({ weekdays: [1], intervalWeeks: 4 });
    expect(nextOccurrence(rule, '2026-11-16')).toBe('2026-12-14');
    expect(nextOccurrence({ ...rule, endDate: '2026-12-01' }, '2026-11-16')).toBeNull();
  });
});

describe('firstCommonDate', () => {
  it('finds a shared weekday', () => {
    expect(firstCommonDate(weekly(), weekly({ weekdays: [4] }))).toBe('2026-11-19');
  });

  it('sees that alternating weeks never meet', () => {
    const a = weekly({ weekdays: [1], intervalWeeks: 2 });
    const b = weekly({ startDate: '2026-11-23', weekdays: [1], intervalWeeks: 2 });
    expect(firstCommonDate(a, b)).toBeNull();
  });

  it('finds a meeting of 3- and 4-week intervals', () => {
    const a = weekly({ weekdays: [1], intervalWeeks: 3 });
    const b = weekly({ startDate: '2026-11-23', weekdays: [1], intervalWeeks: 4 });
    expect(firstCommonDate(a, b)).toBe('2027-01-18');
  });

  it('ignores ranges that do not touch', () => {
    const a = weekly({ endDate: '2026-11-30' });
    const b = weekly({ startDate: '2026-12-01' });
    expect(firstCommonDate(a, b)).toBeNull();
  });
});

describe('occursOn and addYears', () => {
  it('treats the end date as inclusive', () => {
    expect(occursOn(weekly({ endDate: '2026-11-19' }), '2026-11-19')).toBe(true);
  });

  it('moves Feb 29 to Feb 28', () => {
    expect(addYears('2028-02-29', 2)).toBe('2030-02-28');
  });
});
