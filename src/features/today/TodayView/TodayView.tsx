'use client';

import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { GymNudgeCard } from '@/features/gym/GymNudgeCard';
import type { Gym } from '@/shared/schemas/gym';
import { usePartOfDay } from '../usePartOfDay';
import { useTodayLabel } from '../useTodayLabel';
import { PART_OF_DAY } from '../utils';
import { TodayEmpty } from './TodayEmpty';

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
      <TodayEmpty hasWorkouts={hasWorkouts} />
    </div>
  );
}
