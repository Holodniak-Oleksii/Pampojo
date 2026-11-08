import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../resolve-locale';

describe('resolveLocale', () => {
  it('prefers a valid cookie over Accept-Language', () => {
    expect(resolveLocale({ cookie: 'uk', acceptLanguage: 'en-US' })).toBe('uk');
  });

  it('ignores an invalid cookie', () => {
    expect(resolveLocale({ cookie: 'de', acceptLanguage: 'uk-UA' })).toBe('uk');
  });

  it.each([
    ['uk-UA,uk;q=0.9', 'uk'],
    ['en-US,uk;q=0.8', 'en'],
    ['ru,uk;q=0.8,en;q=0.5', 'uk'],
    ['en;q=0.4,uk;q=0.6', 'uk'],
    ['de', 'en'],
    ['*', 'en'],
    ['', 'en'],
  ] as const)('maps "%s" to %s', (acceptLanguage, expected) => {
    expect(resolveLocale({ acceptLanguage })).toBe(expected);
  });

  it('falls back to English without any input', () => {
    expect(resolveLocale({})).toBe('en');
  });
});
