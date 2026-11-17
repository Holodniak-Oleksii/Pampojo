import { useTranslation } from 'react-i18next';
import { OCCURRENCE_STATUS, SESSION_KIND } from '@/constants/plan';
import { formatPercent } from '@/i18n/format';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { RangeSummary } from '@/shared/plan/statuses';
import { capitalize } from '../formatPlanDate';
import { StatusMarker, type MarkerStatus } from '../StatusMarker';

export interface MonthSummaryProps {
  summary: RangeSummary;
  /** `counts` lists each status with its marker (the calendar legend); `sentence` is for Today. */
  variant: 'counts' | 'sentence';
  /** "у листопаді" / "in November", for the sentence. */
  monthLabel?: string;
  headingId: string;
  className?: string;
}

/** Plan adherence: the percent, one diamond per due occurrence, and the counts. */
export function MonthSummary({
  summary,
  variant,
  monthLabel = '',
  headingId,
  className,
}: MonthSummaryProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const counts: { status: MarkerStatus; count: number; label: string; quiet?: boolean }[] = [
    {
      status: OCCURRENCE_STATUS.ON_TIME,
      count: summary.onTime,
      label: t('{{count}} on time', { count: summary.onTime }),
    },
    {
      status: OCCURRENCE_STATUS.LATE,
      count: summary.late,
      label: t('{{count}} late', { count: summary.late }),
    },
    {
      status: OCCURRENCE_STATUS.MISSED,
      count: summary.missed,
      label: t('{{count}} missed', { count: summary.missed }),
    },
    {
      status: OCCURRENCE_STATUS.PLANNED,
      count: summary.planned,
      label: t('{{count}} planned', { count: summary.planned }),
      quiet: true,
    },
    {
      status: SESSION_KIND.EXTRA,
      count: summary.extra,
      label: t('{{count}} extra', { count: summary.extra }),
      quiet: true,
    },
  ];

  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-baseline gap-3">
        <h2 id={headingId} className="flex-1 text-base font-bold">
          {t('Plan adherence', { context: 'history' })}
        </h2>
        <span className="text-xl font-extrabold tabular-nums">
          {summary.percent === null ? '—' : formatPercent(locale, summary.percent)}
        </span>
      </div>
      {summary.due > 0 ? (
        <span
          role="img"
          aria-label={t('{{done}} of {{due}} planned workouts done', {
            done: summary.done,
            due: summary.due,
          })}
          className="flex flex-wrap gap-[9px] px-px py-0.5"
        >
          {summary.dueRow.map((status, index) => (
            <StatusMarker key={index} status={status} size="lg" />
          ))}
        </span>
      ) : null}
      {variant === 'counts' ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {counts
            .filter((item) => item.count > 0)
            .map((item) => (
              <li
                key={item.status}
                className={cn(
                  'inline-flex items-center gap-[7px]',
                  item.quiet && 'text-muted-foreground',
                )}
              >
                <StatusMarker status={item.status} />
                <CountLabel label={item.label} count={item.count} />
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {summary.due > 0
            ? t(
                '{{done}} of {{due}} planned workouts {{month}}: {{onTime}} on time, {{late}} late, {{missed}} missed.',
                {
                  done: summary.done,
                  due: summary.due,
                  month: monthLabel,
                  onTime: summary.onTime,
                  late: summary.late,
                  missed: summary.missed,
                },
              )
            : capitalize(locale, t('No planned workouts {{month}} yet.', { month: monthLabel }))}
        </p>
      )}
    </section>
  );
}

/** The number in bold, in the text colour even when the label is muted. */
function CountLabel({ label, count }: { label: string; count: number }) {
  const text = String(count);
  const at = label.indexOf(text);
  if (at < 0) return <span>{label}</span>;
  return (
    <span>
      {label.slice(0, at)}
      <b className="text-foreground tabular-nums">{text}</b>
      {label.slice(at + text.length)}
    </span>
  );
}
