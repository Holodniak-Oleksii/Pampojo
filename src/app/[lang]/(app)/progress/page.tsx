import { TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Progress · Pampojo') } };
}

export default async function ProgressPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('Progress')} />
      <EmptyState
        icon={TrendingUp}
        title={t('No progress yet')}
        description={t('Finish a workout to see your strength charts.')}
      />
    </div>
  );
}
