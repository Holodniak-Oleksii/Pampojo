import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExerciseForm } from '@/features/exercises/ExerciseForm';
import { ExerciseFormSkeleton } from '@/features/exercises/ExerciseFormSkeleton';
import { getI18n, getLocale } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getRequestExercise } from '@/server/exercises/request-exercise';
import { exerciseIdParamsSchema } from '@/shared/schemas/exercise';

type Props = PageProps<'/[lang]/library/exercises/new'>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('New exercise | Pampojo') } };
}

async function NewExercise({ searchParams }: Pick<Props, 'searchParams'>) {
  const from = (await searchParams).from;
  const session = await getRequestSession();
  // Only a visible system exercise can be duplicated; anything else opens an empty form.
  const source =
    session && typeof from === 'string' && exerciseIdParamsSchema.shape.id.safeParse(from).success
      ? await getRequestExercise(session.user.id, await getLocale(), from)
      : null;
  return <ExerciseForm mode="create" source={source && !source.isOwn ? source : undefined} />;
}

export default function NewExercisePage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ExerciseFormSkeleton />}>
      <NewExercise searchParams={searchParams} />
    </Suspense>
  );
}
