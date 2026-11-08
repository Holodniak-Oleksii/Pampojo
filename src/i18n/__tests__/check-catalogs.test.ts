import { describe, expect, it } from 'vitest';
import { checkCatalogs } from '../check-catalogs';
import en from '../locales/en.json';
import uk from '../locales/uk.json';

describe('checkCatalogs', () => {
  it('passes for the committed catalogs', () => {
    expect(checkCatalogs(en, uk)).toEqual([]);
  });

  it('reports a key missing in uk', () => {
    expect(checkCatalogs({ Online: 'Online' }, {})).toEqual(['uk is missing "Online"']);
  });

  it('reports an empty uk value', () => {
    expect(checkCatalogs({ Online: 'Online' }, { Online: ' ' })).toEqual([
      'uk has an empty value for "Online"',
    ]);
  });

  it('reports missing Ukrainian plural forms', () => {
    const problems = checkCatalogs(
      { '{{count}} set_one': '{{count}} set', '{{count}} set_other': '{{count}} sets' },
      { '{{count}} set_one': '{{count}} підхід', '{{count}} set_other': '{{count}} підходи' },
    );
    expect(problems).toEqual([
      'uk is missing plural form "{{count}} set_few"',
      'uk is missing plural form "{{count}} set_many"',
    ]);
  });
});
