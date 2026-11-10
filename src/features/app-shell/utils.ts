import { LOCALES } from '@/i18n/config';
import { SECTION, type Section } from './constants';

const SECTIONS: readonly Section[] = Object.values(SECTION);

const isSection = (value: string | undefined): value is Section =>
  SECTIONS.some((section) => section === value);

export function sectionFromPathname(pathname: string): Section | null {
  const segments = pathname.split('/').filter(Boolean);
  // During server render the hidden [lang] rewrite can show up as the first segment.
  if (LOCALES.some((locale) => locale === segments[0])) segments.shift();
  const first = segments[0];
  return isSection(first) ? first : null;
}
