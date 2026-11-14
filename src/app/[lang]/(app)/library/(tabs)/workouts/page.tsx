import { ListChecks } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Library | Pampojo') } };
}

export default async function LibraryWorkoutsPage() {
  const { t } = await getI18n();
  return (
    <EmptyState
      icon={ListChecks}
      title={t('No workouts yet')}
      description={t('Workout builder is coming soon.')}
    />
  );
}
