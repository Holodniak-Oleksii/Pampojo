import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import uk from '../locales/uk.json';

describe('committed catalogs', () => {
  it('contain the /dev/ui title in both languages', () => {
    expect(en).toHaveProperty(['Design system'], 'Design system');
    expect(uk).toHaveProperty(['Design system'], 'Дизайн-система');
  });
});

describe('copy rules', () => {
  it.each([
    ['en', en],
    ['uk', uk],
  ])('the %s catalog has no "·" or "•" separators', (_, catalog) => {
    const offending = Object.values(catalog).filter((value) => /[·•]/.test(value));
    expect(offending).toEqual([]);
  });

  it('Ukrainian calls sets «підходи», never «сети»', () => {
    const offending = Object.values(uk).filter((value) => /сет/i.test(value));
    expect(offending).toEqual([]);
  });
});
