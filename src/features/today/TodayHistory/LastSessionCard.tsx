'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useSessionsQuery } from '@/api/sessions';
import { CALENDAR_RANGE_MAX_DAYS } from '@/constants/plan';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import {
  formatDuration,
  longDate,
  StatusMarker,
  statusLabel,
  usePlanTimeZone,
  usePlanToday,
} from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { useLocalCompletedSessions } from '@/services/local-db';
import { addDays } from '@/shared/plan/occurrences';
import { linkedKind, startDateOf, type StatusSession } from '@/shared/plan/statuses';

/** The latest completed workout, from the server or this device; hidden when there is none. */
export function LastSessionCard({ className }: { className?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const today = usePlanToday();
  const timeZone = usePlanTimeZone();
  const remote = useSessionsQuery(
    { status: SESSION_STATUS.COMPLETED, limit: 1 },
    { enabled: online },
  );
  const local = useLocalCompletedSessions(
    userId,
    addDays(today, 1 - CALENDAR_RANGE_MAX_DAYS),
    today,
  );

  const candidates: StatusSession[] = [
    ...(remote.data?.items ?? []),
    ...(local ?? []).filter((session) => session.status === SESSION_STATUS.COMPLETED),
  ];
  const last = candidates.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (!last) return null;

  const kind = linkedKind(last, timeZone);
  const seconds = last.finishedAt
    ? (Date.parse(last.finishedAt) - Date.parse(last.startedAt)) / 1000
    : 0;
  return (
    <section
      aria-labelledby="last-session"
      className={cn('flex flex-col gap-1.5 rounded-lg bg-card p-4', className)}
    >
      <h2 id="last-session" className="text-sm font-bold text-muted-foreground">
        {t('Last workout')}
      </h2>
      <div className="mt-0.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] leading-tight font-extrabold">{last.workoutName}</p>
          <p className="mt-0.5 text-muted-foreground tabular-nums">
            {t('{{date}}. {{duration}}, {{count}} sets', {
              date: longDate(locale, startDateOf(last, timeZone)),
              duration: formatDuration(t, seconds),
              count: last.setCount,
            })}
          </p>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-sm bg-background px-2.5 text-sm font-bold">
          <StatusMarker status={kind} />
          {statusLabel(t, kind)}
        </span>
      </div>
      <Link
        href={sessionHref(last.id)}
        className="inline-flex min-h-11 items-center gap-1 self-start font-bold"
      >
        {t('View summary')}
        <ChevronRight aria-hidden="true" className="size-[18px]" />
      </Link>
    </section>
  );
}
