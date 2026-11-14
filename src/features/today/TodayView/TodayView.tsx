'use client';

import { ListChecks } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { EmojiAvatar } from '@/components/EmojiAvatar';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AvatarColor, AvatarEmojiId } from '@/constants/avatar';
import { GymNudgeCard } from '@/features/gym/GymNudgeCard';
import type { Gym } from '@/shared/schemas/gym';
import { usePartOfDay } from '../usePartOfDay';
import { PART_OF_DAY } from '../utils';

export interface TodayViewProps {
  displayName: string;
  avatarEmoji: AvatarEmojiId;
  avatarColor: AvatarColor;
  initialGym: Gym | null;
}

export function TodayView({ displayName, avatarEmoji, avatarColor, initialGym }: TodayViewProps) {
  const { t } = useTranslation();
  const part = usePartOfDay();
  const greetings = {
    [PART_OF_DAY.MORNING]: t('Good morning, {{name}}', { name: displayName }),
    [PART_OF_DAY.AFTERNOON]: t('Good afternoon, {{name}}', { name: displayName }),
    [PART_OF_DAY.EVENING]: t('Good evening, {{name}}', { name: displayName }),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <EmojiAvatar emoji={avatarEmoji} color={avatarColor} size="lg" />
        <h1 className="min-w-0 flex-1 text-3xl font-extrabold break-words md:text-4xl">
          {part ? (
            greetings[part]
          ) : (
            <Skeleton aria-hidden="true" className="h-9 w-56 max-w-full md:h-10" />
          )}
        </h1>
      </div>
      <GymNudgeCard initialGym={initialGym} />
      <EmptyState
        icon={ListChecks}
        title={t('No workouts yet')}
        description={t('Create your first workout to start training.')}
        action={
          <Button asChild>
            <Link href="/library/workouts">{t('Create your first workout')}</Link>
          </Button>
        }
      />
    </div>
  );
}
