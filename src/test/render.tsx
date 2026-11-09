import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { render as renderInBrowser } from 'vitest-browser-react';
import { I18nProvider } from '@/i18n/client';
import type { Catalog, Locale } from '@/i18n/config';
import en from '@/i18n/locales/en.json';
import uk from '@/i18n/locales/uk.json';

const catalogs: Record<Locale, Catalog> = { en, uk };

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

export function createQueryWrapper(client: QueryClient = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function render(ui: ReactNode, { locale = 'en' }: { locale?: Locale } = {}) {
  const client = createTestQueryClient();
  function AppProviders({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale} catalog={catalogs[locale]}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return renderInBrowser(ui, { wrapper: AppProviders });
}
