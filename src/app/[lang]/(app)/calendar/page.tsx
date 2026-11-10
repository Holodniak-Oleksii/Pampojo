import { CalendarDays } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Calendar · Pampojo') } };
}

export default async function CalendarPage() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('Calendar')} />
      <EmptyState
        icon={CalendarDays}
        title={t('Nothing scheduled yet')}
        description={t('Your planned and past workouts will show up here.')}
      />
    </div>
  );
}
