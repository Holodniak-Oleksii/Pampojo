import type { Metadata } from 'next';
import { LegalPlaceholder } from '@/features/landing/LegalPlaceholder';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: `${t('Terms of use')} · Pampojo` };
}

export default async function TermsPage() {
  const { t } = await getI18n();
  return <LegalPlaceholder title={t('Terms of use')} />;
}
