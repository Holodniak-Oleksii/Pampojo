import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import uk from '../locales/uk.json';

describe('committed catalogs', () => {
  it('contain the /dev/ui title in both languages', () => {
    expect(en).toHaveProperty(['Design system'], 'Design system');
    expect(uk).toHaveProperty(['Design system'], 'Дизайн-система');
  });
});
