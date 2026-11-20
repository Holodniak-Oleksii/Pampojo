'use client';

import { useMeasurementsAvailable } from '../hooks/useMeasurementsAvailable';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasurementsQuery } from '@/api/measurements';
import { OfflineNotice } from '@/components/OfflineNotice';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/ui/skeleton';
import { type MeasurementType } from '@/constants/measurement';
import { DEFAULT_PROGRESS_RANGE, PROGRESS_RANGES, type ProgressRange } from '@/constants/progress';
import { CalendarError } from '@/features/calendar/CalendarStates';
import { dayMonth } from '@/features/plan/formatPlanDate';
import { rangeLabel, rangeSpan } from '@/features/progress';
import { useLocale } from '@/i18n/client';
import { todayIn } from '@/lib/dates';
import { rangeStart } from '@/shared/progress/metrics';
import type { Measurement } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import { AddMeasurementSheet } from '../AddMeasurementSheet/AddMeasurementSheet';
import { ChangeText } from '../ChangeText';
import { EditMeasurementSheet } from '../EditMeasurementSheet/EditMeasurementSheet';
import { AddMeasurementButton, latestOf } from '../MeasurementsSection/MeasurementsSection';
import { round2 as round } from '@/lib/units';
import { byType, displayValue, formatChange, formatMeasurement, typeName } from '../utils';

const PLOT = 'h-[180px]';

// Recharts is large, so only the history loads it.
const TrendChart = dynamic(() => import('@/components/TrendChart/TrendChart'), {
  ssr: false,
  loading: () => <Skeleton className={`${PLOT} w-full rounded-sm`} />,
});

export interface MeasurementHistoryProps {
  type: MeasurementType;
  initialProfile: Profile;
}

export function MeasurementHistory({ type, initialProfile }: MeasurementHistoryProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  // True offline too when the device keeps the data (spec 16).
  const online = useMeasurementsAvailable();
  const profile = initialProfile;
  const units = profile.unitSystem;
  const query = useMeasurementsQuery({ enabled: online });
  const [range, setRange] = useState<ProgressRange>(DEFAULT_PROGRESS_RANGE);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const today = todayIn(profile.timeZone);
  const grouped = useMemo(() => byType(query.data ?? []), [query.data]);
  const latest = useMemo(() => latestOf(grouped), [grouped]);
  const list = grouped.get(type) ?? [];
  const name = typeName(t, type);

  const from = rangeStart(today, range);
  const inRange = list.filter((row) => from === null || row.measuredOn >= from).reverse();
  const points = inRange.map((row) => ({
    date: row.measuredOn,
    value: displayValue(type, row.value, units),
  }));
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  const rangeChange = first && last && inRange.length > 1 ? round(last.value - first.value) : null;
  const span = rangeSpan(t, range);
  const latestRow = list[0];
  const summary = latestRow
    ? t('{{type}}: {{value}} {{date}}, {{change}} over {{range}}, {{count}} measurements', {
        type: name,
        value: formatMeasurement(t, locale, type, latestRow.value, units),
        date: dayMonth(locale, latestRow.measuredOn),
        change: rangeChange === null ? '—' : formatChange(t, locale, type, rangeChange, units),
        range: span,
        count: inRange.length,
      })
    : name;

  let body: React.ReactNode;
  if (!query.data) {
    if (query.isError) {
      body = (
        <CalendarError
          message={t("Couldn't load measurements.")}
          onRetry={() => void query.refetch()}
        />
      );
    } else if (!online) {
      body = <OfflineNotice>{t('Needs internet')}</OfflineNotice>;
    } else {
      body = <Skeleton aria-busy="true" className="h-[320px] w-full rounded-lg" />;
    }
  } else {
    body = (
      <>
        <figure className="m-0 flex flex-col gap-3 rounded-lg bg-card p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-muted-foreground">
                {t('{{type}} now', { type: name })}
              </span>
              <span className="text-2xl font-extrabold tabular-nums">
                {latestRow ? formatMeasurement(t, locale, type, latestRow.value, units) : '—'}
              </span>
            </div>
            {latestRow ? (
              <div className="flex flex-col items-end gap-0.5 text-sm">
                <span className="font-semibold tabular-nums">
                  {rangeChange === null ? '—' : formatChange(t, locale, type, rangeChange, units)}
                </span>
                <span className="text-muted-foreground">
                  {t('over {{range}}', { range: span })}
                </span>
              </div>
            ) : null}
          </div>
          <div role="img" aria-label={summary} className={PLOT}>
            {points.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('No measurements in this period.')}
              </p>
            ) : (
              <div aria-hidden="true" className="h-full">
                <TrendChart points={points} dense={range === '1m'} />
              </div>
            )}
          </div>
          <SegmentedControl
            name="measurement-range"
            legend={t('Range')}
            hideLegend
            options={PROGRESS_RANGES.map((value) => ({ value, label: rangeLabel(t, value) }))}
            value={range}
            onChange={setRange}
          />
        </figure>

        <section aria-labelledby="history-list" className="flex flex-col gap-3">
          <h2 id="history-list" className="text-lg font-extrabold">
            {t('All measurements')}
          </h2>
          {list.length === 0 ? (
            <p className="rounded-lg bg-card p-4 text-[15px] text-muted-foreground">
              {t('No measurements yet')}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg bg-card pl-4">
              {list.map((row, index) => {
                const older = list[index + 1];
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className="flex min-h-15 w-full items-center gap-3 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <span className="flex-1 text-[15px] text-muted-foreground">
                        {dayMonth(locale, row.measuredOn)}
                        {row.measuredOn.slice(0, 4) === today.slice(0, 4)
                          ? ''
                          : ` ${row.measuredOn.slice(0, 4)}`}
                      </span>
                      {older ? (
                        <ChangeText
                          type={type}
                          change={round(row.value - older.value)}
                          units={units}
                        />
                      ) : null}
                      <span className="w-[84px] text-right text-[15px] font-bold tabular-nums">
                        {formatMeasurement(t, locale, type, row.value, units)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </>
    );
  }

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-5">
      <Link
        href="/profile"
        className="flex min-h-11 items-center gap-2 self-start text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('Profile')}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-extrabold">{name}</h1>
        <AddMeasurementButton online={online} onClick={() => setAdding(true)} />
      </div>
      {body}
      <AddMeasurementSheet
        open={adding}
        onOpenChange={setAdding}
        profile={profile}
        today={today}
        latest={latest}
        focusType={type}
      />
      <EditMeasurementSheet
        measurement={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        units={units}
        today={today}
      />
    </div>
  );
}
