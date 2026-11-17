import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ExerciseImage } from '@/features/exercises/ExerciseImage';
import {
  formatDuration,
  nextDateLabel,
  startTime,
  StatusMarker,
  statusLabel,
  weekdayFor,
} from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { useLocale } from '@/i18n/client';
import { isoWeekday } from '@/shared/plan/occurrences';
import { startDateOf, type CalendarSession } from '@/shared/plan/statuses';
import { cn } from '@/lib/utils';

export interface SessionRowProps {
  session: CalendarSession;
  thumbnailUrl: string | null;
  timeZone: string;
  /** On the planned day of a late session the row says when it was done. */
  variant?: 'start' | 'occurrence';
  className?: string;
}

/** "Вчасно" or "Із запізненням, за четвер", and the start time, duration and sets. */
export function sessionStatusText(
  t: ReturnType<typeof useTranslation>['t'],
  session: CalendarSession,
  variant: 'start' | 'occurrence',
): string {
  if (session.kind === 'late' && variant === 'start' && session.scheduledFor) {
    return t('Done late, for {{weekday}}', {
      weekday: weekdayFor(t, isoWeekday(session.scheduledFor)),
    });
  }
  return statusLabel(t, session.kind);
}

export function sessionMeta(
  t: ReturnType<typeof useTranslation>['t'],
  locale: ReturnType<typeof useLocale>,
  session: CalendarSession,
  timeZone: string,
): string {
  const seconds = session.finishedAt
    ? (Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000
    : 0;
  return t('{{time}}, {{duration}}, {{count}} sets', {
    time: startTime(locale, session.startedAt, timeZone),
    duration: formatDuration(t, seconds),
    count: session.setCount,
  });
}

export function SessionRow({
  session,
  thumbnailUrl,
  timeZone,
  variant = 'start',
  className,
}: SessionRowProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const start = startDateOf(session, timeZone);
  return (
    <li className={className}>
      <Link
        href={sessionHref(session.id)}
        className="flex min-h-16 items-center gap-3 py-3 pr-2 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ExerciseImage
          src={thumbnailUrl}
          name={session.workoutName}
          alt=""
          compact
          className="size-12 shrink-0 self-start rounded-sm"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-base font-bold">{session.workoutName}</span>
          <span className={cn('inline-flex items-center gap-[7px] text-sm font-semibold')}>
            <StatusMarker status={session.kind} />
            {sessionStatusText(t, session, variant)}
          </span>
          {session.kind === 'late' && variant === 'occurrence' ? (
            <span className="text-sm text-muted-foreground">
              {t('Done {{date}}', { date: nextDateLabel(t, locale, start, isoWeekday(start)) })}
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground tabular-nums">
            {sessionMeta(t, locale, session, timeZone)}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
