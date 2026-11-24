'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { dayLabel, markersOf } from '@/features/calendar/utils';
import {
  dayMonth,
  StatusMarker,
  useCalendarDays,
  usePlanToday,
  weekdayShortOf,
} from '@/features/plan';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { addDays, mondayOf } from '@/shared/plan/occurrences';
import { summarize } from '@/shared/plan/statuses';

/** "Цей тиждень" on Today; hidden when the user has no plan. */
export function TodayProgress({ className }: { className?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const today = usePlanToday();
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const calendar = useCalendarDays(monday, sunday);
  const { days } = calendar;

  const week = useMemo(
    () => summarize(days.values(), monday, sunday, today),
    [days, monday, sunday, today],
  );

  if (calendar.status !== 'ready' || calendar.rules.length === 0) return null;

  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <section
        aria-labelledby="week-heading"
        className="flex flex-col gap-1.5 rounded-lg bg-card px-3 pt-3.5 pb-2"
      >
        <div className="flex items-baseline px-1">
          <h2 id="week-heading" className="flex-1 text-base font-bold">
            {t('This week')}
          </h2>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {t('{{done}} of {{due}} done', { done: week.done, due: week.due })}
          </span>
        </div>
        <ol className="grid grid-cols-7">
          {weekDates.map((date) => {
            const isToday = date === today;
            const markers = markersOf(t, locale, days.get(date)).filter((m) => !m.desktopOnly);
            return (
              <li key={date}>
                <Link
                  href={`/calendar?date=${date}`}
                  aria-label={dayLabel(t, date, dayMonth(locale, date), markers, isToday)}
                  className="flex min-h-11 flex-col items-center gap-1.5 rounded-sm py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'text-[13px] capitalize',
                      isToday
                        ? 'font-extrabold text-foreground'
                        : 'font-semibold text-muted-foreground',
                    )}
                  >
                    {weekdayShortOf(locale, date)}
                  </span>
                  <span aria-hidden="true" className="flex h-3 items-center gap-1">
                    {markers.slice(0, 2).map((marker) => (
                      <StatusMarker key={marker.key} status={marker.status} size="lg" />
                    ))}
                  </span>
                  <span
                    className={cn(
                      'text-[15px] tabular-nums',
                      isToday ? 'font-extrabold' : 'font-semibold',
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {isToday ? (
                    <span
                      aria-hidden="true"
                      className="-mt-1 h-0.5 w-3.5 rounded-full bg-foreground"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
