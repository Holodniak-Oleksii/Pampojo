'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { WorkoutIcon } from '@/components/BrandIcons';
import { StepList } from '@/components/StepList';
import { Button } from '@/components/ui/button';

export interface TodayEmptyProps {
  /** The user has built a workout but has no plan yet (spec 09). */
  hasWorkouts: boolean;
}

export function TodayEmpty({ hasWorkouts }: TodayEmptyProps) {
  const { t } = useTranslation();
  const steps = [
    { label: t('Pick exercises from the catalog'), done: hasWorkouts },
    { label: t('Set sets, reps and weight'), done: hasWorkouts },
    { label: t('Put it on your calendar and train') },
  ];
  return (
    <section aria-labelledby="today-empty" className="rounded-lg bg-card p-4 lg:p-6">
      <h1
        id="today-empty"
        className="flex items-center gap-2.5 text-3xl leading-tight font-extrabold"
      >
        <WorkoutIcon className="size-6" />
        {hasWorkouts ? t('Workout ready') : t('No workouts yet')}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {hasWorkouts
          ? t('Now put it on your calendar.')
          : t('Create your first workout to start training.')}
      </p>
      <StepList className="mt-4" steps={steps} doneLabel={t('Done: ')} />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button asChild className="w-full sm:w-auto">
          {hasWorkouts ? (
            <Link href="/library/workouts">{t('Your workouts')}</Link>
          ) : (
            <Link href="/library/workouts">{t('Create your first workout')}</Link>
          )}
        </Button>
        <Button asChild variant="ghost" className="w-full sm:w-auto">
          <Link href="/library/exercises">
            {t('Browse exercises')}
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
