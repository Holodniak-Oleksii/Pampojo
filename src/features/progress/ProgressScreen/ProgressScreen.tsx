'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  cachedExerciseRecords,
  useExerciseProgressQuery,
  useProgressExercisesQuery,
} from '@/api/progress';
import { SegmentedControl } from '@/components/SegmentedControl';
import {
  DEFAULT_PROGRESS_RANGE,
  METRICS_BY_TRACKING,
  type ProgressMetric,
  type ProgressRange,
} from '@/constants/progress';
import { CalendarError } from '@/features/calendar/CalendarStates';
import { useIsOnline } from '@/hooks/useIsOnline';
import { ExerciseSelector } from '../ExerciseSelector';
import { MonthNumbers } from '../MonthNumbers';
import { ProgressChart, type ChartState } from '../ProgressChart';
import { RecordList } from '../RecordList';
import { ProgressEmpty, ProgressOffline, ProgressSkeleton } from '../ProgressStates';
import { metricName } from '../utils';

/** `/progress`: month numbers, the exercise chart with a metric and a range, and its records. */
export function ProgressScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const online = useIsOnline();
  const exercises = useProgressExercisesQuery({ enabled: online });
  const items = exercises.data?.items ?? [];
  const requested = searchParams.get('exercise');
  const selected = items.find((item) => item.exerciseId === requested) ?? items[0];
  const metrics = selected ? METRICS_BY_TRACKING[selected.trackingType] : [];
  const [range, setRange] = useState<ProgressRange>(DEFAULT_PROGRESS_RANGE);
  const [chosenMetric, setMetric] = useState<ProgressMetric | null>(null);
  const metric = chosenMetric && metrics.includes(chosenMetric) ? chosenMetric : metrics[0];
  const progress = useExerciseProgressQuery(selected?.exerciseId, range, { enabled: online });
  const queryClient = useQueryClient();

  if (!exercises.data) {
    if (!online) return <ProgressOffline />;
    if (exercises.isError) {
      return (
        <CalendarError
          message={t("Couldn't load progress.")}
          onRetry={() => void exercises.refetch()}
        />
      );
    }
    return <ProgressSkeleton />;
  }
  if (!selected || !metric) return <ProgressEmpty />;

  let chartState: ChartState = 'ready';
  if (!progress.data) {
    if (!online) chartState = 'offline';
    else if (progress.isError) chartState = 'error';
    else chartState = 'pending';
  }

  // While a range loads, or offline for a range that is not cached, keep the records on screen.
  const records =
    progress.data?.records ?? cachedExerciseRecords(queryClient, selected.exerciseId) ?? [];

  const select = (exerciseId: string) => {
    setMetric(null);
    router.replace(`${pathname}?exercise=${exerciseId}`, { scroll: false });
  };

  return (
    // The left column spans both rows. The `1fr` row takes its extra height, so the records stay under the month numbers.
    <div className="grid max-w-[1040px] gap-3.5 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-2 lg:row-start-1">
        <MonthNumbers
          workouts={exercises.data.month.workouts}
          volumeKg={exercises.data.month.volumeKg}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <ExerciseSelector items={items} selected={selected} onSelect={select} />
        {metrics.length > 1 ? (
          <SegmentedControl
            name="progress-metric"
            legend={t('Metric', { context: 'chart' })}
            hideLegend
            appearance="quiet"
            className="[&>div]:bg-border [&_label]:px-2 [&_label]:whitespace-nowrap"
            options={metrics.map((value) => ({ value, label: metricName(t, value) }))}
            value={metric}
            onChange={setMetric}
          />
        ) : null}
        <ProgressChart
          exerciseName={selected.name}
          metric={metric}
          range={range}
          onRangeChange={setRange}
          points={progress.data?.points ?? []}
          state={chartState}
          onRetry={() => void progress.refetch()}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-2 lg:row-start-2">
        <RecordList records={records} />
      </div>
    </div>
  );
}
