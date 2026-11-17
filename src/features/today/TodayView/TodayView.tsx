'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { GymNudgeCard } from '@/features/gym/GymNudgeCard';
import { InstallCard } from '@/features/pwa';
import type { Gym } from '@/shared/schemas/gym';
import { usePartOfDay } from '../usePartOfDay';
import { useTodayLabel } from '../useTodayLabel';
import { PART_OF_DAY } from '../utils';
import { LastSessionCard, TodayProgress } from '../TodayHistory';
import { TodayPlan } from '../TodayPlan';

export interface TodayViewProps {
  displayName: string;
  initialGym: Gym | null;
  hasWorkouts: boolean;
}

export function TodayView({ displayName, initialGym, hasWorkouts }: TodayViewProps) {
  const { t } = useTranslation();
  const part = usePartOfDay();
  const date = useTodayLabel();
  const greetings = {
    [PART_OF_DAY.MORNING]: t('Good morning, {{name}}', { name: displayName }),
    [PART_OF_DAY.AFTERNOON]: t('Good afternoon, {{name}}', { name: displayName }),
    [PART_OF_DAY.EVENING]: t('Good evening, {{name}}', { name: displayName }),
  };

  return (
    <div className="flex flex-col gap-4">
      {part && date ? (
        <p className="text-[15px] text-muted-foreground">
          {t('{{greeting}}. {{date}}', { greeting: greetings[part], date })}
        </p>
      ) : (
        <Skeleton aria-hidden="true" className="h-5 w-72 max-w-full" />
      )}
      <GymNudgeCard initialGym={initialGym} />
      <InstallCard />
      {/* One render per card: on desktop the grid puts the week and adherence in a right column. */}
      <div className="flex flex-col gap-3.5 lg:grid lg:max-w-[1040px] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-x-6 lg:gap-y-4">
        <div className="lg:col-start-1 lg:row-start-1">
          <TodayPlan hasWorkouts={hasWorkouts} />
        </div>
        <TodayProgress className="lg:col-start-2 lg:row-span-2 lg:row-start-1" />
        <LastSessionCard className="lg:col-start-1 lg:row-start-2" />
      </div>
    </div>
  );
}
