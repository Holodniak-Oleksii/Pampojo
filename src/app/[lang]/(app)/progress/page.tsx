import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ProgressScreen } from '@/features/progress';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Progress | Pampojo') } };
}

export default async function ProgressPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-3.5 lg:gap-6">
      <PageHeader sectionTitle title={t('Progress')} />
      <Suspense>
        <ProgressScreen />
      </Suspense>
    </div>
  );
}
