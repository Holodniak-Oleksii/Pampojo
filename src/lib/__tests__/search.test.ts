import { describe, expect, it } from 'vitest';
import { normalizeSearch } from '../search';

describe('normalizeSearch', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeSearch('ÉLÉVATION')).toBe('elevation');
    expect(normalizeSearch('Élévation')).toBe(normalizeSearch('elevation'));
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeSearch('  Bench   press ')).toBe('bench press');
  });

  it('treats Ukrainian letters with marks the same on both sides', () => {
    expect(normalizeSearch('Жим лежачи')).toBe('жим лежачи');
    expect(normalizeSearch('Її')).toBe(normalizeSearch('ії'));
    expect(normalizeSearch('й')).toBe(normalizeSearch('Й'));
  });
});
