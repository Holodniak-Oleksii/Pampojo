import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExerciseCatalog } from '@/features/exercises/ExerciseCatalog';
import { ExerciseCatalogSkeleton } from '@/features/exercises/ExerciseCatalogSkeleton';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Exercises | Pampojo') } };
}

export default function LibraryExercisesPage() {
  return (
    // useSearchParams needs a Suspense boundary under Cache Components.
    <Suspense fallback={<ExerciseCatalogSkeleton />}>
      <ExerciseCatalog />
    </Suspense>
  );
}
