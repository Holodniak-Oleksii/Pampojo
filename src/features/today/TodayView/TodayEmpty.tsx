'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { WorkoutIcon } from '@/components/BrandIcons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function TodayEmpty() {
  const { t } = useTranslation();
  const steps = [
    t('Pick exercises from the catalog'),
    t('Set sets, reps and weight'),
    t('Put it on your calendar and train'),
  ];
  return (
    <section aria-labelledby="today-empty" className="rounded-lg bg-card p-4 lg:p-6">
      <h1
        id="today-empty"
        className="flex items-center gap-2.5 text-3xl leading-tight font-extrabold"
      >
        <WorkoutIcon className="size-6" />
        {t('No workouts yet')}
      </h1>
      <p className="mt-1.5 text-[15px] text-muted-foreground">
        {t('Create your first workout to start training.')}
      </p>
      <ol className="mt-4 border-t border-border">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex min-h-14 items-center gap-4 border-b border-border text-[15px] font-semibold"
          >
            <span
              aria-hidden="true"
              className={cn(
                'ml-1 flex size-[22px] shrink-0 rotate-45 items-center justify-center rounded-[4px]',
                index === 0 ? 'bg-accent text-foreground' : 'bg-foreground text-card',
              )}
            >
              <span className="-rotate-45 text-xs font-extrabold">{index + 1}</span>
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button asChild className="w-full sm:w-auto">
          <Link href="/library/workouts">{t('Create your first workout')}</Link>
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
