import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { QueryProvider } from '@/api/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/i18n/client';
import { LOCALES } from '@/i18n/config';
import { getCatalog, getI18n, getLocale } from '@/i18n/server';
import '../globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { metadataBase: new URL(SITE_URL), title: t('Pampojo') };
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale();
  const catalog = await getCatalog(locale);

  return (
    <html lang={locale} className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} catalog={catalog}>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
