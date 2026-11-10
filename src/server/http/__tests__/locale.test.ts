import { describe, expect, it } from 'vitest';
import { requestLocale } from '../locale';

const request = (headers: Record<string, string>) =>
  new Request('http://localhost/api/v1/exercises', { headers });

describe('requestLocale', () => {
  it('prefers the lang cookie', () => {
    expect(requestLocale(request({ cookie: 'a=1; lang=uk', 'accept-language': 'en' }))).toBe('uk');
  });

  it('falls back to Accept-Language, then English', () => {
    expect(requestLocale(request({ 'accept-language': 'uk-UA,uk;q=0.9' }))).toBe('uk');
    expect(requestLocale(request({ cookie: 'lang=de' }))).toBe('en');
  });
});
