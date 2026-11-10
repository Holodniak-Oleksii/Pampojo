import { describe, expect, it } from 'vitest';
import { partOfDay } from '../utils';

describe('partOfDay', () => {
  it.each([
    [4, 59, 'evening'],
    [5, 0, 'morning'],
    [11, 59, 'morning'],
    [12, 0, 'afternoon'],
    [17, 59, 'afternoon'],
    [18, 0, 'evening'],
    [0, 0, 'evening'],
  ])('%i:%i is %s', (hours, minutes, expected) => {
    expect(partOfDay(new Date(2026, 0, 1, hours, minutes))).toBe(expected);
  });
});
