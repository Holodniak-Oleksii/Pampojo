'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { useTodayPlan } from '@/features/plan';
import { useStartSession } from '@/features/session/hooks/useStartSession';
import { TodayEmpty } from '../TodayView/TodayEmpty';
import { NextWorkoutCard } from './NextWorkoutCard';
import { PlannedCard } from './PlannedCard';

export interface TodayPlanProps {
  hasWorkouts: boolean;
}

/** Today's planned workouts, the next planned one when today is free, else the getting-started card. */
export function TodayPlan({ hasWorkouts }: TodayPlanProps) {
  const { t } = useTranslation();
  const plan = useTodayPlan();
  const { start, pending } = useStartSession();

  if (plan.status === 'loading') {
    return <Skeleton aria-hidden="true" className="h-64 w-full rounded-lg" />;
  }
  if (plan.items.length > 0) {
    return (
      <section aria-labelledby="today-plan" className="flex max-w-[960px] flex-col gap-3.5">
        <h1 id="today-plan" className="mt-1 text-[17px] font-extrabold lg:text-xl">
          {t('Planned for today')}
        </h1>
        <div className="grid items-start gap-3.5 lg:grid-cols-2 lg:gap-4">
          {plan.items.map((item) => (
            <PlannedCard
              key={item.rule.id}
              item={item}
              starting={pending}
              onStart={() => void start(item.rule.workoutId)}
            />
          ))}
        </div>
      </section>
    );
  }
  if (plan.next) {
    return <NextWorkoutCard next={plan.next} />;
  }
  return <TodayEmpty hasWorkouts={hasWorkouts} />;
}
