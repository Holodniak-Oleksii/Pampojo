'use client';

import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PROGRESS_RANGES, type ProgressMetric, type ProgressRange } from '@/constants/progress';
import { dayMonth } from '@/features/plan';
import { useLocale } from '@/i18n/client';
import type { ProgressPoint } from '@/shared/schemas/progress';
import { ProgressOffline } from '../ProgressStates';
import {
  chartSummary,
  formatChange,
  formatMetricValue,
  metricName,
  rangeLabel,
  rangeSpan,
} from '../utils';

const PLOT = 'h-[196px]';

// Recharts is large, so only this screen loads it.
const LineChartView = dynamic(() => import('./LineChartView'), {
  ssr: false,
  loading: () => <Skeleton className={`${PLOT} w-full rounded-sm`} />,
});

export type ChartState = 'ready' | 'pending' | 'error' | 'offline';

export function ProgressChart({
  exerciseName,
  metric,
  range,
  onRangeChange,
  points,
  state,
  onRetry,
}: {
  exerciseName: string;
  metric: ProgressMetric;
  range: ProgressRange;
  onRangeChange: (range: ProgressRange) => void;
  points: readonly ProgressPoint[];
  state: ChartState;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const series = points.flatMap((point) => {
    const value = point[metric];
    return value === null ? [] : [{ date: point.date, value }];
  });
  const latest = series.at(-1);
  const name = metricName(t, metric);
  const change = formatChange(
    t,
    locale,
    metric,
    series.map((point) => point.value),
  );
  const span = rangeSpan(t, range);
  const summary = chartSummary(t, locale, {
    metric,
    exercise: exerciseName,
    range,
    series,
    formatDate: (date) => dayMonth(locale, date),
  });

  let plot;
  if (state === 'offline') {
    plot = (
      <ProgressOffline
        className={`${PLOT} flex flex-col items-center justify-center gap-2.5 text-center text-sm text-muted-foreground`}
      />
    );
  } else if (state === 'error') {
    plot = (
      <div
        role="alert"
        className={`${PLOT} flex flex-col items-center justify-center gap-3 text-center`}
      >
        <p className="font-bold">{t("Couldn't load progress.")}</p>
        <Button onClick={onRetry}>{t('Try again')}</Button>
      </div>
    );
  } else if (state === 'pending') {
    plot = <Skeleton className={`${PLOT} w-full rounded-sm`} />;
  } else if (series.length === 0) {
    plot = (
      <p
        className={`${PLOT} flex items-center justify-center text-center text-sm text-muted-foreground`}
      >
        {t('No workouts in this period.')}
      </p>
    );
  } else {
    plot = (
      <div role="img" aria-label={summary} className={PLOT}>
        <LineChartView points={series} dense={range === '1m'} />
      </div>
    );
  }

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3 rounded-lg bg-card p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">
            {t('{{metric}} now', { metric: name })}
          </span>
          <span className="text-2xl font-extrabold tabular-nums">
            {latest ? formatMetricValue(t, locale, metric, latest.value) : '—'}
          </span>
        </div>
        {latest ? (
          <span className="pb-[3px] text-right text-sm font-semibold tabular-nums">
            {change}{' '}
            <span className="font-normal text-muted-foreground">
              {t('over {{range}}', { range: span })}
            </span>
          </span>
        ) : null}
      </div>
      {plot}
      <SegmentedControl
        name="progress-range"
        legend={t('Range')}
        hideLegend
        appearance="quiet"
        className="[&>div]:grid-cols-5"
        options={PROGRESS_RANGES.map((value) => ({ value, label: rangeLabel(t, value) }))}
        value={range}
        onChange={onRangeChange}
      />
    </figure>
  );
}
