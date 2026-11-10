import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ExerciseDetails } from '@/features/exercises/ExerciseDetails';
import { ExerciseDetailsSkeleton } from '@/features/exercises/ExerciseDetailsSkeleton';
import { getI18n, getLocale } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getRequestExercise } from '@/server/exercises/request-exercise';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';

type Props = PageProps<'/[lang]/library/exercises/[id]'>;

async function loadExercise(id: string) {
  if (!exerciseIdParamsSchema.shape.id.safeParse(id).success) return null;
  // The (app) gate already redirected users without a session; the lookup still scopes by it.
  const session = await getRequestSession();
  if (!session) return null;
  return getRequestExercise(session.user.id, await getLocale(), id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await getI18n();
  const exercise = await loadExercise((await params).id);
  return {
    title: {
      absolute: exercise
        ? t('{{name}} · Pampojo', { name: exercise.name })
        : t('Exercises · Pampojo'),
    },
  };
}

async function DetailsContent({ params }: Pick<Props, 'params'>) {
  const exercise = await loadExercise((await params).id);
  if (!exercise) notFound();
  return <ExerciseDetails exercise={exercise} />;
}

export default function ExerciseDetailsPage({ params }: Props) {
  return (
    <Suspense fallback={<ExerciseDetailsSkeleton />}>
      <DetailsContent params={params} />
    </Suspense>
  );
}
