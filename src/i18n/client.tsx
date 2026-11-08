'use client';

import { createInstance } from 'i18next';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { i18nextOptions, type Catalog, type Locale } from './config';
import { formatNumber, formatPercent } from './format';

const LocaleContext = createContext<Locale | null>(null);

interface I18nProviderProps {
  locale: Locale;
  catalog: Catalog;
  children: ReactNode;
}

export function I18nProvider({ locale, catalog, children }: I18nProviderProps) {
  const [instance] = useState(() => {
    const created = createInstance().use(initReactI18next);
    void created.init({ ...i18nextOptions(locale, catalog), react: { useSuspense: false } });
    return created;
  });

  return (
    <I18nextProvider i18n={instance}>
      <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
    </I18nextProvider>
  );
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error('useLocale must be used inside I18nProvider');
  return locale;
}

export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(locale, value, options),
      percent: (value: number) => formatPercent(locale, value),
    }),
    [locale],
  );
}
