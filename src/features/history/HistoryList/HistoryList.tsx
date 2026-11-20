'use client';

import { ChevronRight, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessionHistoryQuery, useSessionsQuery } from '@/api/sessions';
import { CALENDAR_RANGE_MAX_DAYS } from '@/constants/plan';
import { SESSION_STATUS } from '@/constants/session';
import { useOpenStartSheet } from '@/features/app-shell/StartSheetContext';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { CalendarError } from '@/features/calendar/CalendarStates';
import { sessionMeta, sessionStatusText } from '@/features/calendar/SessionRow';
import {
  dayMonth,
  formatDuration,
  monthTitle,
  startTime,
  StatusMarker,
  usePlanTimeZone,
  usePlanToday,
  weekdayShortOf,
} from '@/features/plan';
import { useInProgress } from '@/features/session/hooks/useInProgress';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocale } from '@/i18n/client';
import { useLocalCompletedSessions, useOptionalLocalDb } from '@/services/local-db';
import { addDays } from '@/shared/plan/occurrences';
import {
  linkedKind,
  startDateOf,
  type CalendarSession,
  type StatusSession,
} from '@/shared/plan/statuses';

interface HistoryRow {
  session: CalendarSession;
  start: string;
}

/** Completed sessions, newest first, grouped by month; loads older pages at the end. */
export function HistoryList() {
  const { t } = useTranslation();
  const locale = useLocale();
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const desktop = useIsDesktop();
  const today = usePlanToday();
  const timeZone = usePlanTimeZone();
  const openStart = useOpenStartSheet();
  const history = useSessionHistoryQuery({ enabled: online });
  const local = useLocalCompletedSessions(
    userId,
    addDays(today, 1 - CALENDAR_RANGE_MAX_DAYS),
    today,
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = history;

  const groups = useMemo(() => {
    const byId = new Map<string, StatusSession>();
    const loaded = history.data?.pages.flatMap((page) => page.items) ?? [];
    for (const item of loaded) byId.set(item.id, item);
    // Unsynced sessions join the loaded part of the list; older ones arrive with their page.
    const oldest = loaded.at(-1)?.startedAt ?? '';
    for (const session of local ?? []) {
      if (session.status !== SESSION_STATUS.COMPLETED) continue;
      if (!hasNextPage || session.startedAt >= oldest) byId.set(session.id, session);
    }
    const rows: HistoryRow[] = [...byId.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id))
      .map((session) => {
        const start = startDateOf(session, timeZone);
        return { session: { ...session, kind: linkedKind(session, timeZone) }, start };
      });
    const months: { month: string; rows: HistoryRow[] }[] = [];
    for (const row of rows) {
      const month = row.start.slice(0, 7);
      const last = months.at(-1);
      if (last?.month === month) last.rows.push(row);
      else months.push({ month, rows: [row] });
    }
    return months;
  }, [history.data, local, hasNextPage, timeZone]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || !online) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, online, groups]);

  const empty = groups.length === 0;
  let content: ReactNode;
  if (empty && history.isPending && online) {
    content = (
      <div
        aria-busy="true"
        aria-label={t('Workout history')}
        role="region"
        className="flex flex-col divide-y divide-border rounded-lg bg-card"
      >
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="m-3 h-10 rounded-sm" />
        ))}
      </div>
    );
  } else if (empty && history.isError) {
    content = (
      <CalendarError
        message={t("Couldn't load the history.")}
        onRetry={() => void history.refetch()}
      />
    );
  } else if (empty && !history.data && !online) {
    // Nothing loaded yet: the server may hold history this device has never seen.
    content = (
      <p
        role="status"
        className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-card p-4 text-center text-sm text-muted-foreground"
      >
        <WifiOff aria-hidden="true" className="size-[18px] shrink-0" />
        {t('Older workouts appear when you are online.')}
      </p>
    );
  } else if (empty && history.isSuccess && local !== undefined) {
    content = (
      <div className="flex flex-col items-start gap-2.5 rounded-lg bg-card px-5 pt-6 pb-5">
        <Diamond
          tone="planned"
          variant="outline"
          className="mt-1 mb-2 ml-1 size-[22px] border-2 border-dashed"
        />
        <h2 className="text-xl font-extrabold">{t('Your history will be here')}</h2>
        <p className="mb-2 text-muted-foreground">
          {t('Finish your first workout, and it appears in this list.')}
        </p>
        <Button className="w-full sm:w-auto" onClick={openStart}>
          {t('Start workout')}
        </Button>
      </div>
    );
  } else if (desktop) {
    content = <HistoryTable groups={groups} timeZone={timeZone} />;
  } else {
    content = groups.map(({ month, rows }) => (
      <section key={month} className="flex flex-col gap-2">
        <h2 className="mt-1.5 text-base font-bold">{monthTitle(locale, month)}</h2>
        <ul className="divide-y divide-border rounded-lg bg-card">
          {rows.map(({ session, start }) => (
            <li key={session.id}>
              <Link
                href={sessionHref(session.id)}
                className="flex min-h-16 items-center gap-3 py-2.5 pr-2 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex w-9 shrink-0 flex-col items-center leading-tight">
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {weekdayShortOf(locale, start)}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums">
                    {Number(start.slice(8))}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-base font-bold">{session.workoutName}</span>
                  <span className="inline-flex items-center gap-[7px] text-sm font-semibold">
                    <StatusMarker status={session.kind} />
                    {sessionStatusText(t, session, 'start')}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {sessionMeta(t, locale, session, timeZone)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ));
  }

  return (
    <div className="flex max-w-[1000px] flex-col gap-3.5">
      <OtherDeviceSessions />
      {content}
      {/* Offline with only local rows, the server may still hold older sessions. */}
      {!empty && (hasNextPage || (!online && !history.data)) ? (
        <div ref={sentinel}>
          <p
            role="status"
            className="flex min-h-12 items-center justify-center gap-2.5 text-center text-sm text-muted-foreground"
          >
            {online ? (
              <>
                <StatusMarker status="planned" size="lg" />
                {t('Loading older workouts')}
              </>
            ) : (
              <>
                <WifiOff aria-hidden="true" className="size-[18px] shrink-0" />
                {t('Older workouts appear when you are online.')}
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function HistoryTable({
  groups,
  timeZone,
}: {
  groups: { month: string; rows: HistoryRow[] }[];
  timeZone: string;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg bg-card tabular-nums">
      <thead>
        <tr className="text-left text-[13px] text-muted-foreground">
          <th scope="col" className="px-4 py-3 font-bold">
            {t('Date')}
          </th>
          <th scope="col" className="px-2 py-3 font-bold">
            {t('Workout')}
          </th>
          <th scope="col" className="px-2 py-3 font-bold">
            {t('Status')}
          </th>
          <th scope="col" className="px-2 py-3 font-bold">
            {t('Start', { context: 'column' })}
          </th>
          <th scope="col" className="px-2 py-3 font-bold">
            {t('Duration')}
          </th>
          <th scope="col" className="px-2 py-3 font-bold">
            {t('Sets')}
          </th>
          <th scope="col" className="w-11">
            <span className="sr-only">{t('Summary')}</span>
          </th>
        </tr>
      </thead>
      {groups.map(({ month, rows }) => (
        <tbody key={month}>
          <tr>
            <th
              scope="rowgroup"
              colSpan={7}
              className="border-t border-border px-4 pt-4 pb-2 text-left text-base font-bold"
            >
              {monthTitle(locale, month)}
            </th>
          </tr>
          {rows.map(({ session, start }) => {
            const seconds = session.finishedAt
              ? (Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000
              : 0;
            return (
              <tr key={session.id} className="relative h-14 border-t border-border">
                <td className="px-4 font-semibold">
                  {weekdayShortOf(locale, start)}, {dayMonth(locale, start)}
                </td>
                <td className="px-2 font-bold">
                  <Link
                    href={sessionHref(session.id)}
                    className="outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {session.workoutName}
                  </Link>
                </td>
                <td className="px-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    <StatusMarker status={session.kind} />
                    {sessionStatusText(t, session, 'start')}
                  </span>
                </td>
                <td className="px-2 text-muted-foreground">
                  {startTime(locale, session.startedAt, timeZone)}
                </td>
                <td className="px-2 text-muted-foreground">{formatDuration(t, seconds)}</td>
                <td className="px-2 text-muted-foreground">{session.setCount}</td>
                <td className="px-2 text-muted-foreground">
                  <ChevronRight aria-hidden="true" className="size-5" />
                </td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}

/** In-progress sessions of other devices: this device has its own active session (spec 16). */
function OtherDeviceSessions() {
  const { t } = useTranslation();
  const active = useInProgress();
  // Only the device copy knows which session is active here, so the list needs it.
  const inProgress = useSessionsQuery(
    { status: SESSION_STATUS.IN_PROGRESS },
    { enabled: useOptionalLocalDb() !== null },
  );
  const others = (inProgress.data?.items ?? []).filter(
    (item) => active !== undefined && item.id !== active?.session.id,
  );
  if (others.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-lg bg-card">
      {others.map((session) => (
        <li key={session.id}>
          <Link
            href={sessionHref(session.id)}
            className="flex min-h-16 items-center gap-3 py-2.5 pr-2 pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-bold">{session.workoutName}</span>
              <span className="inline-flex items-center gap-[7px] text-sm font-semibold">
                <StatusMarker status="planned" />
                {t('Workout in progress')}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
