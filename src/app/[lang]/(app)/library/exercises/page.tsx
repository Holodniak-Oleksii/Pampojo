import { Dumbbell } from 'lucide-react';
import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Library · Pampojo') } };
}

export default async function LibraryExercisesPage() {
  const { t } = await getI18n();
  return <EmptyState icon={Dumbbell} title={t('Exercise catalog is coming soon.')} />;
}
