import type { InitOptions } from 'i18next';

export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'lang';

export type Catalog = Record<string, string>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Keys are English sentences, so `.` and `:` must not be read as nesting or namespace separators.
export function i18nextOptions(locale: Locale, catalog: Catalog): InitOptions {
  return {
    lng: locale,
    resources: { [locale]: { translation: catalog } },
    fallbackLng: false,
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    initAsync: false,
  };
}
