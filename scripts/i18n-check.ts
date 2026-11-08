import { readFileSync } from 'node:fs';
import { checkCatalogs } from '../src/i18n/check-catalogs.ts';

const read = (locale: string) =>
  JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')) as Record<string, string>;

const problems = checkCatalogs(read('en'), read('uk'));
if (problems.length > 0) {
  console.error(
    ['Translation catalogs are incomplete:', ...problems.map((p) => `- ${p}`)].join('\n'),
  );
  process.exit(1);
}
console.log('Translation catalogs are complete.');
