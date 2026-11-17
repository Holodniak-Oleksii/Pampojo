'use client';

import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';

export function MonthNumbers({
  workouts,
  volumeKg,
  className,
}: {
  workouts: number;
  volumeKg: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const items = [
    { label: t('Workouts this month'), value: formatNumber(locale, workouts) },
    {
      label: t('Volume this month'),
      value: t('{{value}} kg', {
        value: formatNumber(locale, volumeKg, { maximumFractionDigits: 0 }),
      }),
    },
  ];
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-4 border-y border-border-strong py-3.5 tabular-nums lg:rounded-lg lg:border-0 lg:bg-card lg:px-4',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col-reverse gap-0.5">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-2xl font-extrabold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
