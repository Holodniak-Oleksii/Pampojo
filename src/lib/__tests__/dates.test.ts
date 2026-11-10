import { describe, expect, it } from 'vitest';
import { ageOn, isRealDate, isValidTimeZone, todayIn, validateAge } from '../dates';

describe('ageOn', () => {
  it('counts full years', () => {
    expect(ageOn('1990-05-15', '2026-05-14')).toBe(35);
    expect(ageOn('1990-05-15', '2026-05-15')).toBe(36);
  });

  it('treats a Feb 29 birthday as passed on Mar 1 of a common year', () => {
    expect(ageOn('2008-02-29', '2025-02-28')).toBe(16);
    expect(ageOn('2008-02-29', '2025-03-01')).toBe(17);
  });
});

describe('validateAge', () => {
  it('rejects a user who turns 16 tomorrow and accepts one who turns 16 today', () => {
    expect(validateAge('2010-11-10', '2026-11-09')).toBe('too_young');
    expect(validateAge('2010-11-09', '2026-11-09')).toBeNull();
  });

  it('accepts 100 and rejects 101', () => {
    expect(validateAge('1926-11-09', '2026-11-09')).toBeNull();
    expect(validateAge('1925-11-09', '2026-11-09')).toBe('too_old');
  });
});

describe('isRealDate', () => {
  it('rejects dates that do not exist', () => {
    expect(isRealDate(2000, 2, 31)).toBe(false);
    expect(isRealDate(2001, 2, 29)).toBe(false);
    expect(isRealDate(2000, 13, 1)).toBe(false);
    expect(isRealDate(2000, 2, 29)).toBe(true);
  });
});

describe('todayIn', () => {
  it('uses the calendar date of the zone', () => {
    const now = new Date('2026-11-09T23:30:00Z');
    expect(todayIn('UTC', now)).toBe('2026-11-09');
    expect(todayIn('Europe/Kyiv', now)).toBe('2026-11-10');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-11-09');
  });

  it('validates zones', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
