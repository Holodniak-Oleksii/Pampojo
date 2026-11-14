import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { WorkoutEditor, WorkoutEditorSkeleton } from '@/features/workouts/WorkoutEditor';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('New workout | Pampojo') } };
}

async function NewWorkout() {
  // The editor creates the workout's client id on render, which must not happen at build time.
  await connection();
  return <WorkoutEditor mode="new" />;
}

export default function NewWorkoutPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Suspense fallback={<WorkoutEditorSkeleton />}>
        <NewWorkout />
      </Suspense>
    </div>
  );
}
