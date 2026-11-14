'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useGymQuery } from '@/api/gym';
import { MyGymIcon } from '@/components/BrandIcons';
import { GYM_EQUIPMENT_KEYS } from '@/constants/gym';
import type { Gym } from '@/shared/schemas/gym';
import { GYM_PATH } from '../constants';

export interface GymProfileRowProps {
  initialGym: Gym | null;
}

export function GymProfileRow({ initialGym }: GymProfileRowProps) {
  const { t } = useTranslation();
  const { data } = useGymQuery({ initialData: initialGym });
  const value = data
    ? t('{{count}} of {{total}}', {
        count: data.equipment.length,
        total: GYM_EQUIPMENT_KEYS.length,
      })
    : t('Not set up');

  return (
    <Link
      href={GYM_PATH}
      className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-card px-5 py-4 outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 items-center gap-2.5 text-muted-foreground">
        <MyGymIcon className="size-5 text-foreground" />
        {t('Gym equipment')}
      </span>
      <span className="flex shrink-0 items-center gap-2 font-semibold whitespace-nowrap tabular-nums">
        {value}
        <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
      </span>
    </Link>
  );
}
