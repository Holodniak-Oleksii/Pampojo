import type { Metadata } from 'next';
import { Suspense } from 'react';
import { WorkoutEditor, WorkoutEditorSkeleton } from '@/features/workouts/WorkoutEditor';
import { getI18n } from '@/i18n/server';

type Props = PageProps<'/[lang]/library/workouts/[id]'>;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Workout | Pampojo') } };
}

async function EditorContent({ params }: Pick<Props, 'params'>) {
  // The editor loads the workout on the client, so loading, offline and not found are its own.
  const { id } = await params;
  return <WorkoutEditor mode="edit" id={id} />;
}

export default function WorkoutPage({ params }: Props) {
  return (
    <div className="flex w-full flex-col gap-6">
      <Suspense fallback={<WorkoutEditorSkeleton />}>
        <EditorContent params={params} />
      </Suspense>
    </div>
  );
}
