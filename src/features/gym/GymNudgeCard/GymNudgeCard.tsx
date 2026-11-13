'use client';

import { Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useGymQuery } from '@/api/gym';
import { Button } from '@/components/ui/button';
import type { Gym } from '@/shared/schemas/gym';
import { GYM_PATH } from '../constants';

export interface GymNudgeCardProps {
  initialGym: Gym | null;
}

/** Shows until the first gym save; it cannot be dismissed. */
export function GymNudgeCard({ initialGym }: GymNudgeCardProps) {
  const { t } = useTranslation();
  const { data } = useGymQuery({ initialData: initialGym });
  if (data) return null;

  return (
    <section
      aria-labelledby="gym-nudge-title"
      className="flex flex-col gap-4 rounded-[20px] bg-card p-5 shadow-soft sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          <Dumbbell aria-hidden="true" className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="gym-nudge-title" className="text-lg font-extrabold">
            {t('Set up your gym')}
          </h2>
          <p className="text-muted-foreground">
            {t('Tick the equipment you have, and the app will show only exercises you can do.')}
          </p>
        </div>
      </div>
      <Button asChild className="w-full sm:w-auto">
        <Link href={GYM_PATH}>{t('Set up')}</Link>
      </Button>
    </section>
  );
}
