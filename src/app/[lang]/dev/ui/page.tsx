import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DevUiPage } from '@/features/dev-ui/DevUiPage';
import { isDevUiEnabled } from '@/features/dev-ui/utils';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('Design system · Pampojo') };
}

export default function DevUiRoute() {
  if (!isDevUiEnabled({ VERCEL_ENV: process.env.VERCEL_ENV })) notFound();
  return <DevUiPage />;
}
