'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { useWorkoutsQuery } from '@/api/workouts';
import { HistoryList } from '@/features/history/HistoryList';
import { MonthSummary, useCalendarDays, usePlanToday, useTodaySessions } from '@/features/plan';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { addDays, maxDate } from '@/shared/plan/occurrences';
import { summarize, type CalendarSession } from '@/shared/plan/statuses';
import { calendarDateSchema } from '@/shared/schemas/utils';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { CalendarError, CalendarSkeleton } from '../CalendarStates';
import { CalendarViewToggle, type CalendarView } from '../CalendarViewToggle';
import { DayPanel } from '../DayPanel';
import { DeleteRuleDialog } from '../DeleteRuleDialog';
import { MonthGrid } from '../MonthGrid';
import { MonthHeader } from '../MonthHeader';
import { RuleFormSheet, type RuleFormTarget } from '../RuleFormSheet';
import {
  addMonths,
  markersOf,
  monthOf,
  occurrencesByDate,
  weeksOfMonth,
  type DayMarker,
} from '../utils';

export function PlanCalendar() {
  const { t } = useTranslation();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const online = useIsOnline();
  const desktop = useIsDesktop();
  const workoutsQuery = useWorkoutsQuery();

  const view: CalendarView = params.get('view') === 'list' ? 'list' : 'month';
  const linked = calendarDateSchema.safeParse(params.get('date') ?? '');
  const linkedDate = linked.success ? linked.data : null;

  const [month, setMonth] = useState<string | null>(linkedDate ? monthOf(linkedDate) : null);
  const [selected, setSelected] = useState<string | null>(linkedDate);
  const [form, setForm] = useState<RuleFormTarget | null>(null);
  const [deleting, setDeleting] = useState<ScheduleRule | null>(null);

  // Until the user picks a day or a month, the view follows today (profile zone, midnight).
  const today = usePlanToday();
  const currentMonth = month ?? monthOf(today);
  const currentSelected = selected ?? today;
  const dates = useMemo(() => weeksOfMonth(currentMonth), [currentMonth]);
  const from = dates[0] ?? `${currentMonth}-01`;
  const to = dates.at(-1) ?? from;
  const calendar = useCalendarDays(from, to);
  const { timeZone, rules, days } = calendar;
  const sessions = useTodaySessions(today);

  const byDate = useMemo(() => occurrencesByDate(rules, from, to), [rules, from, to]);
  const markers = useMemo(() => {
    const map = new Map<string, DayMarker[]>();
    for (const [date, day] of days) map.set(date, markersOf(t, locale, day));
    return map;
  }, [days, t, locale]);
  const sessionsById = useMemo(() => {
    const map = new Map<string, CalendarSession>();
    for (const day of days.values())
      for (const session of day.sessions) map.set(session.id, session);
    return map;
  }, [days]);
  const library = useMemo(
    () => new Map((workoutsQuery.data?.items ?? []).map((item) => [item.id, item])),
    [workoutsQuery.data],
  );
  const monthEnd = addDays(`${addMonths(currentMonth, 1)}-01`, -1);
  const summary = useMemo(
    () => summarize(days.values(), `${currentMonth}-01`, monthEnd, today),
    [days, currentMonth, monthEnd, today],
  );
  const showSummary = calendar.historyKnown && currentMonth <= monthOf(today);

  const select = (date: string) => {
    setSelected(date);
    setMonth(monthOf(date));
  };

  const setView = (next: CalendarView) => {
    const query = new URLSearchParams();
    if (next === 'list') query.set('view', 'list');
    else if (selected) query.set('date', selected);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const toggle = <CalendarViewToggle value={view} onChange={setView} />;
  const summaryBlock = showSummary ? (
    <MonthSummary
      summary={summary}
      variant="counts"
      headingId="month-summary"
      className={desktop ? 'rounded-lg bg-card p-4' : 'border-t border-border-strong pt-3.5'}
    />
  ) : null;

  let body;
  if (view === 'list') {
    body = <HistoryList />;
  } else if (calendar.status !== 'ready') {
    body =
      calendar.status === 'error' ? (
        <CalendarError onRetry={calendar.refetch} />
      ) : (
        <CalendarSkeleton />
      );
  } else {
    body = (
      <div className="flex flex-col gap-3.5 lg:flex-row lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <MonthHeader
            month={currentMonth}
            showToday={currentMonth !== monthOf(today)}
            online={online}
            onMove={(delta) => {
              setMonth(addMonths(currentMonth, delta));
              setSelected(currentSelected);
            }}
            onToday={() => {
              setSelected(null);
              setMonth(null);
            }}
            onSchedule={() => setForm({ kind: 'new', date: maxDate(currentSelected, today) })}
          />
          <MonthGrid
            month={currentMonth}
            dates={dates}
            today={today}
            selected={currentSelected}
            markers={markers}
            variant={desktop ? 'full' : 'compact'}
            onSelect={select}
          />
          {desktop ? null : summaryBlock}
        </div>
        <div className="flex flex-col gap-5 lg:w-[340px] lg:shrink-0">
          {desktop ? summaryBlock : null}
          <DayPanel
            date={currentSelected}
            today={today}
            rules={byDate.get(currentSelected) ?? []}
            library={library}
            sessions={sessions}
            online={online}
            desktop={desktop}
            day={days.get(currentSelected)}
            sessionsById={sessionsById}
            timeZone={timeZone}
            onSchedule={() => setForm({ kind: 'new', date: maxDate(currentSelected, today) })}
            onEdit={(rule) => setForm({ kind: 'edit', rule })}
            onDelete={setDeleting}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* On desktop the toggle shares the title row; in the month row it would cut the month name. */}
      <PageHeader
        sectionTitle
        title={view === 'list' ? t('Workout history') : t('Calendar')}
        actions={desktop ? <div className="w-[220px]">{toggle}</div> : undefined}
        className={cn('lg:items-center', view === 'list' && 'lg:max-w-[1000px]')}
      />
      {desktop ? null : toggle}
      {body}
      <RuleFormSheet
        target={form}
        today={today}
        onOpenChange={(open) => (open ? undefined : setForm(null))}
        onSaved={(startDate) => {
          setForm(null);
          select(startDate);
        }}
      />
      <DeleteRuleDialog
        rule={deleting}
        today={today}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
      />
    </div>
  );
}
