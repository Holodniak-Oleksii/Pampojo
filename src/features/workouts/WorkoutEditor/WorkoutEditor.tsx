'use client';

import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useWorkoutQuery } from '@/api/workouts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { draftFromWorkout, emptyDraft } from '../utils';
import { WorkoutEditorForm } from './WorkoutEditorForm';

export type WorkoutEditorProps = { mode: 'new' } | { mode: 'edit'; id: string };

function WorkoutNotFound() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col items-start gap-2 rounded-lg bg-card px-5 py-6">
      <SearchX aria-hidden="true" className="size-7" />
      <h1 className="mt-1 text-2xl font-extrabold">{t('Workout not found')}</h1>
      <p className="text-muted-foreground">
        {t('It may have been deleted, or the link is wrong.')}
      </p>
      <Button asChild className="mt-3">
        <Link href="/library/workouts">{t('Back to workouts')}</Link>
      </Button>
    </section>
  );
}

export function WorkoutEditorSkeleton() {
  return (
    <div aria-hidden="true" data-testid="workout-editor-skeleton" className="flex flex-col gap-5">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-12 w-full lg:w-1/2" />
      <Skeleton className="h-16 w-full" />
      <div className="flex flex-col gap-2 rounded-lg bg-card p-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

function NewWorkout() {
  const [initial] = useState(() => emptyDraft(crypto.randomUUID()));
  return <WorkoutEditorForm initial={initial} />;
}

function ExistingWorkout({ id }: { id: string }) {
  const { t } = useTranslation();
  const valid = z.uuid().safeParse(id).success;
  const query = useWorkoutQuery(id, { enabled: valid });
  if (!valid || query.data === null) return <WorkoutNotFound />;
  if (query.isPending) return <WorkoutEditorSkeleton />;
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-card p-4">
        <p className="font-semibold">{t("Couldn't load workouts.")}</p>
        <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
          {t('Try again')}
        </Button>
      </div>
    );
  }
  // Keyed by the save time, so a refetch after a save seeds a fresh draft.
  return <WorkoutEditorForm key={query.data.updatedAt} initial={draftFromWorkout(query.data)} />;
}

export function WorkoutEditor(props: WorkoutEditorProps) {
  return props.mode === 'new' ? <NewWorkout /> : <ExistingWorkout id={props.id} />;
}
