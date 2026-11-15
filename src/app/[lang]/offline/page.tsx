import type { Metadata } from 'next';
import { OfflinePage } from '@/features/pwa/OfflinePage';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('No connection | Pampojo') } };
}

export default function Offline() {
  return <OfflinePage />;
}
