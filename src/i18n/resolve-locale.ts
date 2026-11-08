import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

interface LanguageRange {
  tag: string;
  q: number;
}

function parseAcceptLanguage(header: string): LanguageRange[] {
  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.find((param) => param.trim().startsWith('q='));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((range) => range.tag !== '' && range.q > 0)
    .sort((a, b) => b.q - a.q);
}

export function resolveLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  if (!input.acceptLanguage) return DEFAULT_LOCALE;

  for (const { tag } of parseAcceptLanguage(input.acceptLanguage)) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
