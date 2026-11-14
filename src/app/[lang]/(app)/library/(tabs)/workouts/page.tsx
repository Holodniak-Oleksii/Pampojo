import type { Metadata } from 'next';
import { WorkoutList } from '@/features/workouts/WorkoutList';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Library | Pampojo') } };
}

export default function LibraryWorkoutsPage() {
  return <WorkoutList />;
}
