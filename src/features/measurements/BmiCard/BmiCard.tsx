'use client';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { UNIT_SYSTEM } from '@/constants/profile';
import { dayMonth } from '@/features/plan/formatPlanDate';
import { useLocale } from '@/i18n/client';
import { formatNumber } from '@/i18n/format';
import { feetInchesFromCm, formatFeetInches } from '@/lib/units';
import { cn } from '@/lib/utils';
import { addDays } from '@/shared/plan/occurrences';
import type { Measurement } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import { bmi, bmiCategory, bmiCategoryName, bmiScalePosition, formatMeasurement } from '../utils';

// Segment widths follow BMI 15–18.5–25–30–40.
const SEGMENTS = [
  { from: 0, to: 18.5 },
  { from: 18.5, to: 25 },
  { from: 25, to: 30 },
  { from: 30, to: Infinity },
] as const;

const TICKS = [
  { value: 15, left: '0%', align: 'left' },
  { value: 18.5, left: '14%', align: 'center' },
  { value: 25, left: '40%', align: 'center' },
  { value: 30, left: '60%', align: 'center' },
  { value: 40, left: '100%', align: 'right' },
] as const;

export interface BmiCardProps {
  profile: Profile;
  /** Live weights, newest first. */
  weights: readonly Measurement[];
  today: string;
  online: boolean;
  onAddWeight: () => void;
}

export function BmiCard({ profile, weights, today, online, onAddWeight }: BmiCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const latest = weights[0];

  if (!latest) {
    return (
      <section aria-labelledby="bmi-title" className="flex flex-col gap-3 rounded-lg bg-card p-5">
        <h2 id="bmi-title" className="text-sm font-normal text-muted-foreground">
          {t('BMI')}
        </h2>
        <p className="text-base font-bold">{t('Add your weight to see your BMI.')}</p>
        <div aria-hidden="true" className="grid h-1.5 grid-cols-[14fr_26fr_20fr_40fr] gap-[3px]">
          {SEGMENTS.map((segment) => (
            <span
              key={segment.from}
              className="rounded-[1px] border border-dashed border-planned"
            />
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={!online}
          onClick={onAddWeight}
        >
          {t('Add weight')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('A rough indicator for adults.')}</p>
      </section>
    );
  }

  const value = bmi(latest.value, profile.heightCm);
  const category = bmiCategory(value);
  const metric = profile.unitSystem === UNIT_SYSTEM.METRIC;
  const height = metric
    ? t('{{value}} cm', { value: formatNumber(locale, Math.round(profile.heightCm)) })
    : formatFeetInches(feetInchesFromCm(profile.heightCm));
  const weight = formatMeasurement(t, locale, 'weight', latest.value, profile.unitSystem);
  const from = addDays(today, -90);
  const trend = weights.filter((item) => item.measuredOn >= from).reverse();

  return (
    <section aria-labelledby="bmi-title" className="flex flex-col gap-4 rounded-lg bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 id="bmi-title" className="text-sm font-normal text-muted-foreground">
            {t('BMI')}
          </h2>
          <p className="flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tabular-nums">
              {formatNumber(locale, value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-base font-bold">{bmiCategoryName(t, category)}</span>
          </p>
        </div>
        {trend.length >= 2 ? <WeightTrend points={trend} units={profile.unitSystem} /> : null}
      </div>

      <div aria-hidden="true" className="flex flex-col gap-1.5">
        <div className="relative h-[22px]">
          <div className="absolute inset-x-0 top-2 grid h-1.5 grid-cols-[14fr_26fr_20fr_40fr] gap-[3px]">
            {SEGMENTS.map((segment) => (
              <span
                key={segment.from}
                className={cn(
                  'rounded-[1px]',
                  value >= segment.from && value < segment.to
                    ? 'bg-foreground'
                    : 'bg-border-strong',
                )}
              />
            ))}
          </div>
          <span
            className="absolute top-1 box-border size-3.5 rotate-45 rounded-[2px] border-2 border-card bg-accent"
            style={{ left: `calc(${bmiScalePosition(value) * 100}% - 7px)` }}
          />
        </div>
        <div className="relative h-4 text-xs text-muted-foreground">
          {TICKS.map((tick) => (
            <span
              key={tick.value}
              className={cn(
                'absolute',
                tick.align === 'center' && '-translate-x-1/2',
                tick.align === 'right' && '-translate-x-full',
              )}
              style={{ left: tick.left }}
            >
              {formatNumber(locale, tick.value)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <p className="text-[15px] font-semibold">
          {t('Weight {{weight}}, height {{height}}', { weight, height })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('Updated {{date}}.', { date: dayMonth(locale, latest.measuredOn) })}{' '}
          {t('A rough indicator for adults.')}
        </p>
      </div>
    </section>
  );
}

function WeightTrend({
  points,
  units,
}: {
  points: readonly Measurement[];
  units: Profile['unitSystem'];
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const width = 124;
  const height = 44;
  const pad = 5;
  const coords = points.map((point, index) => [
    pad + (index / (points.length - 1)) * (width - pad * 2),
    pad + (1 - (point.value - min) / span) * (height - pad * 2),
  ]);
  const last = coords[coords.length - 1] ?? [0, 0];
  const first = points[0];
  const end = points[points.length - 1];
  const label = t('Weight over 90 days: from {{first}} to {{last}}', {
    first: first ? formatMeasurement(t, locale, 'weight', first.value, units) : '',
    last: end ? formatMeasurement(t, locale, 'weight', end.value, units) : '',
  });
  return (
    <figure className="m-0 flex shrink-0 flex-col items-end gap-1">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        className="h-11 w-[124px]"
      >
        <polyline
          points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <rect
          x={(last[0] ?? 0) - 4}
          y={(last[1] ?? 0) - 4}
          width={8}
          height={8}
          rx={1.5}
          fill="var(--accent)"
          transform={`rotate(45 ${last[0]} ${last[1]})`}
        />
      </svg>
      <figcaption className="text-[13px] text-muted-foreground">{t('Weight, 90 days')}</figcaption>
    </figure>
  );
}
