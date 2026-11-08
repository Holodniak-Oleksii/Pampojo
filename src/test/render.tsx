import type { ReactNode } from 'react';
import { render as renderInBrowser } from 'vitest-browser-react';
import { I18nProvider } from '@/i18n/client';
import type { Catalog, Locale } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';

const catalogs: Record<Locale, Catalog> = { en, uk };

// QueryClient joins these providers in the first spec that adds a query.
export function render(ui: ReactNode, { locale = 'en' }: { locale?: Locale } = {}) {
  function AppProviders({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} catalog={catalogs[locale]}>
        {children}
      </I18nProvider>
    );
  }
  return renderInBrowser(ui, { wrapper: AppProviders });
}
