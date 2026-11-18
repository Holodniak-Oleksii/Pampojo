import type { TFunction } from 'i18next';
import {
  PROGRESS_METRIC,
  RECORD_TYPE,
  type ProgressMetric,
  type ProgressRange,
  type RecordType,
} from '@/constants/progress';
import type { Locale } from '@/i18n/config';
import { formatNumber } from '@/i18n/format';

const kg = (t: TFunction, locale: Locale, value: number) =>
  t('{{value}} kg', { value: formatNumber(locale, value, { maximumFractionDigits: 1 }) });

/** A chart value in the units of the spec 10 summary. */
export function formatMetricValue(
  t: TFunction,
  locale: Locale,
  metric: ProgressMetric,
  value: number,
): string {
  switch (metric) {
    case PROGRESS_METRIC.E1RM:
    case PROGRESS_METRIC.TOP_WEIGHT:
      return kg(t, locale, value);
    case PROGRESS_METRIC.VOLUME:
      return t('{{value}} kg', {
        value: formatNumber(locale, value, { maximumFractionDigits: 0 }),
      });
    case PROGRESS_METRIC.REPS:
      return formatNumber(locale, value);
    case PROGRESS_METRIC.DURATION:
      return t('{{value}} s', { value: formatNumber(locale, value) });
    case PROGRESS_METRIC.DISTANCE:
      return value >= 1000
        ? t('{{value}} km', {
            value: formatNumber(locale, value / 1000, { maximumFractionDigits: 2 }),
          })
        : t('{{value}} m', { value: formatNumber(locale, value) });
  }
}

/** The metric a record type is measured in. */
export const RECORD_METRIC: Record<RecordType, ProgressMetric> = {
  heaviest_weight: PROGRESS_METRIC.TOP_WEIGHT,
  best_e1rm: PROGRESS_METRIC.E1RM,
  most_reps: PROGRESS_METRIC.REPS,
  best_volume: PROGRESS_METRIC.VOLUME,
  longest_duration: PROGRESS_METRIC.DURATION,
  longest_distance: PROGRESS_METRIC.DISTANCE,
};

export function formatRecordValue(
  t: TFunction,
  locale: Locale,
  record: { type: RecordType; value: number; weightKg: number | null },
): string {
  if (record.type === RECORD_TYPE.MOST_REPS && record.weightKg !== null && record.weightKg > 0) {
    return t('{{reps}} × {{weight}}', {
      reps: formatNumber(locale, record.value),
      weight: kg(t, locale, record.weightKg),
    });
  }
  return formatMetricValue(t, locale, RECORD_METRIC[record.type], record.value);
}

/** Literal keys so extraction finds them. */
export function recordName(t: TFunction, type: RecordType): string {
  switch (type) {
    case RECORD_TYPE.HEAVIEST_WEIGHT:
      return t('Heaviest weight');
    case RECORD_TYPE.BEST_E1RM:
      return t('Estimated 1RM');
    case RECORD_TYPE.MOST_REPS:
      return t('Most reps');
    case RECORD_TYPE.BEST_VOLUME:
      return t('Best volume');
    case RECORD_TYPE.LONGEST_DURATION:
      return t('Longest time');
    case RECORD_TYPE.LONGEST_DISTANCE:
      return t('Longest distance');
  }
}

export function metricName(t: TFunction, metric: ProgressMetric): string {
  switch (metric) {
    case PROGRESS_METRIC.E1RM:
      return t('Estimated 1RM');
    case PROGRESS_METRIC.TOP_WEIGHT:
      return t('Weight');
    case PROGRESS_METRIC.VOLUME:
      return t('Volume');
    case PROGRESS_METRIC.REPS:
      return t('Reps', { context: 'chart' });
    case PROGRESS_METRIC.DURATION:
      return t('Time');
    case PROGRESS_METRIC.DISTANCE:
      return t('Distance');
  }
}

export function rangeLabel(t: TFunction, range: ProgressRange): string {
  switch (range) {
    case '1m':
      return t('1M');
    case '3m':
      return t('3M');
    case '6m':
      return t('6M');
    case '1y':
      return t('1Y');
    case 'all':
      return t('All', { context: 'range' });
  }
}

/** "3 місяці" / "3 months", used after "за" / "over". */
export function rangeSpan(t: TFunction, range: ProgressRange): string {
  switch (range) {
    case '1m':
      return t('{{count}} months', { count: 1 });
    case '3m':
      return t('{{count}} months', { count: 3 });
    case '6m':
      return t('{{count}} months', { count: 6 });
    case '1y':
      return t('1 year');
    case 'all':
      return t('all time');
  }
}

/**
 * The accessible chart summary: metric, exercise, latest value with its date, change and count.
 * Empty with no points. With one point there is no change, so the label leaves it out.
 * The caller gives `formatDate`: this file is also on the server path of the page, and the date
 * helpers come from the plan feature, which loads client components.
 */
export function chartSummary(
  t: TFunction,
  locale: Locale,
  input: {
    metric: ProgressMetric;
    exercise: string;
    range: ProgressRange;
    series: readonly { date: string; value: number }[];
    formatDate: (date: string) => string;
  },
): string {
  const latest = input.series.at(-1);
  if (!latest) return '';
  const count = input.series.length;
  // `count` stays a literal option in each call, so the key extractor finds the plural keys.
  const base = {
    metric: metricName(t, input.metric),
    exercise: input.exercise,
    value: formatMetricValue(t, locale, input.metric, latest.value),
    date: input.formatDate(latest.date),
  };
  if (count < 2) {
    return t('{{metric}}, {{exercise}}: {{value}} {{date}}, {{count}} workouts', {
      ...base,
      count,
    });
  }
  return t(
    '{{metric}}, {{exercise}}: {{value}} {{date}}, {{change}} over {{range}}, {{count}} workouts',
    {
      ...base,
      count,
      change: formatChange(
        t,
        locale,
        input.metric,
        input.series.map((point) => point.value),
      ),
      range: rangeSpan(t, input.range),
    },
  );
}

/** A signed change, "+10,1 кг" or "−2 кг"; "—" when there is no earlier point. */
export function formatChange(
  t: TFunction,
  locale: Locale,
  metric: ProgressMetric,
  values: readonly number[],
): string {
  const first = values[0];
  const last = values.at(-1);
  if (values.length < 2 || first === undefined || last === undefined) return '—';
  const change = Math.round((last - first) * 100) / 100;
  const text = formatMetricValue(t, locale, metric, Math.abs(change));
  if (change > 0) return `+${text}`;
  if (change < 0) return `−${text}`;
  return text;
}
