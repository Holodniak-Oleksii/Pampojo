'use client';

import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOpenStartSheet } from '@/features/app-shell/StartSheetContext';

export function ProgressSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      aria-busy="true"
      aria-label={t('Progress')}
      role="region"
      className="flex flex-col gap-3.5"
    >
      <Skeleton className="h-[72px] rounded-lg" />
      <Skeleton className="h-[72px] rounded-lg" />
      <Skeleton className="h-[300px] rounded-lg" />
      <div className="flex flex-col divide-y divide-border rounded-lg bg-card">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="m-3 h-10 rounded-sm" />
        ))}
      </div>
    </div>
  );
}

export function ProgressEmpty() {
  const { t } = useTranslation();
  const openStart = useOpenStartSheet();
  return (
    <div className="flex max-w-[640px] flex-col items-start gap-2.5 rounded-lg bg-card px-5 pt-6 pb-5">
      <Diamond
        tone="planned"
        variant="outline"
        className="mt-1 mb-2 ml-1 size-[22px] border-2 border-dashed"
      />
      <h2 className="text-xl font-extrabold">{t('No progress yet')}</h2>
      <p className="mb-2 text-muted-foreground">
        {t('Finish your first workout to see your strength charts here.')}
      </p>
      <Button className="w-full sm:w-auto" onClick={openStart}>
        {t('Start workout')}
      </Button>
    </div>
  );
}

/** Nothing cached for this view and no network. */
export function ProgressOffline({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      role="status"
      className={
        className ??
        'flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-card p-4 text-center text-sm text-muted-foreground'
      }
    >
      <WifiOff aria-hidden="true" className="size-[18px] shrink-0" />
      {t('Needs internet')}
    </p>
  );
}
