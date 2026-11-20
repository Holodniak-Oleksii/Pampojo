import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { render as renderInBrowser } from 'vitest-browser-react';
import { CurrentUserIdProvider } from '@/features/auth/CurrentUser';
import { I18nProvider } from '@/i18n/client';
import { LocalDbProvider } from '@/services/local-db';
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

export const TEST_USER_ID = '00000000-0000-4000-8000-00000000ffff';

export function render(
  ui: ReactNode,
  {
    locale = 'en',
    userId = TEST_USER_ID,
    client = createTestQueryClient(),
    localDb = false,
  }: {
    locale?: Locale;
    userId?: string;
    client?: QueryClient;
    /** Reads come from the user's Dexie database, as in the signed-in app (spec 16). */
    localDb?: boolean;
  } = {},
) {
  function AppProviders({ children }: { children: ReactNode }) {
    const content = <CurrentUserIdProvider userId={userId}>{children}</CurrentUserIdProvider>;
    return (
      <I18nProvider locale={locale} catalog={catalogs[locale]}>
        <QueryClientProvider client={client}>
          {localDb ? <LocalDbProvider userId={userId}>{content}</LocalDbProvider> : content}
        </QueryClientProvider>
      </I18nProvider>
    );
  }
  return renderInBrowser(ui, { wrapper: AppProviders });
}
