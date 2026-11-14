'use client';

import { useTranslation } from 'react-i18next';
import { WorkoutIcon } from '@/components/BrandIcons';
import { StepList } from '@/components/StepList';
import { OnlineLinkButton } from '@/features/exercises/OnlineLinkButton';

export function WorkoutListEmpty() {
  const { t } = useTranslation();
  const steps = [
    { label: t('Name the workout') },
    { label: t('Add exercises from the catalog') },
    { label: t('Set sets, reps and weight') },
  ];
  return (
    <section aria-labelledby="workouts-empty" className="rounded-lg bg-card p-4 lg:p-6">
      <h2
        id="workouts-empty"
        className="flex items-center gap-2.5 text-2xl leading-tight font-extrabold"
      >
        <WorkoutIcon className="size-6" />
        {t('No workouts yet')}
      </h2>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {t('Build a workout once and repeat it every week.')}
      </p>
      <StepList className="mt-4" steps={steps} doneLabel={t('Done: ')} />
      <OnlineLinkButton href="/library/workouts/new" className="mt-4 w-full sm:w-auto">
        {t('Create workout')}
      </OnlineLinkButton>
    </section>
  );
}
