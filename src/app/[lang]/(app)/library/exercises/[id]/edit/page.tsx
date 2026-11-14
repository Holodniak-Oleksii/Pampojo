import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ExerciseForm } from '@/features/exercises/ExerciseForm';
import { ExerciseFormSkeleton } from '@/features/exercises/ExerciseFormSkeleton';
import { getI18n, getLocale } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getRequestExercise } from '@/server/exercises/request-exercise';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';

type Props = PageProps<'/[lang]/library/exercises/[id]/edit'>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Edit exercise | Pampojo') } };
}

async function EditExercise({ params }: Pick<Props, 'params'>) {
  const { id } = await params;
  if (!exerciseIdParamsSchema.shape.id.safeParse(id).success) notFound();
  const session = await getRequestSession();
  const exercise = session
    ? await getRequestExercise(session.user.id, await getLocale(), id)
    : null;
  // System exercises are read-only, so their edit URL is not found like a foreign one.
  if (!exercise?.isOwn) notFound();
  return <ExerciseForm mode="edit" exercise={exercise} />;
}

export default function EditExercisePage({ params }: Props) {
  return (
    <Suspense fallback={<ExerciseFormSkeleton />}>
      <EditExercise params={params} />
    </Suspense>
  );
}
