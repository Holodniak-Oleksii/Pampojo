'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SEX, type Sex } from '@/constants/profile';
import { FemaleFigure, MaleFigure } from '../BodyDiagram/figures';

export function MeasurementsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" aria-label={t('Measurements')} className="flex flex-col gap-4">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="flex h-[260px] items-stretch gap-4">
        <div className="flex flex-1 flex-col items-end gap-5 pt-12">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="w-[110px] rounded-[40px_40px_12px_12px]" />
        <div className="flex flex-1 flex-col gap-5 pt-16">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

export function BmiSkeleton() {
  return <Skeleton aria-hidden="true" className="h-[168px] w-full rounded-lg" />;
}

export function MeasurementsEmpty({
  sex,
  online,
  onAdd,
}: {
  sex: Sex;
  online: boolean;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const Figure = sex === SEX.FEMALE ? FemaleFigure : MaleFigure;
  return (
    <div className="flex items-center gap-4">
      <Figure className="h-[240px] w-[92px] shrink-0 text-figure opacity-70" />
      <div className="flex flex-col gap-2.5">
        <h3 className="text-xl font-extrabold">{t('No measurements yet')}</h3>
        <p className="text-[15px] text-muted-foreground">
          {t(
            'Measure your chest, waist, hips, arms and legs. The values will appear on the figure.',
          )}
        </p>
        <Button size="sm" className="self-start" disabled={!online} onClick={onAdd}>
          {t('Add measurement')}
        </Button>
      </div>
    </div>
  );
}
