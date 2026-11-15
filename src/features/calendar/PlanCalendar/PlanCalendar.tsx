'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScheduleRulesQuery } from '@/api/plan';
import { PageHeader } from '@/components/PageHeader';
import { useWorkoutsQuery } from '@/api/workouts';
import { usePlanToday, useTodaySessions } from '@/features/plan';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { maxDate } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { CalendarError, CalendarSkeleton } from '../CalendarStates';
import { DayPanel } from '../DayPanel';
import { DeleteRuleDialog } from '../DeleteRuleDialog';
import { MonthGrid } from '../MonthGrid';
import { MonthHeader } from '../MonthHeader';
import { RuleFormSheet, type RuleFormTarget } from '../RuleFormSheet';
import { addMonths, monthOf, occurrencesByDate, weeksOfMonth } from '../utils';

export function PlanCalendar() {
  const { t } = useTranslation();
  const today = usePlanToday();
  const online = useIsOnline();
  const desktop = useIsDesktop();
  const rulesQuery = useScheduleRulesQuery();
  const workoutsQuery = useWorkoutsQuery();
  const sessions = useTodaySessions(today);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => monthOf(today));
  const [shownToday, setShownToday] = useState(today);
  const [touched, setTouched] = useState(false);
  // Today first comes from the device zone and moves once the profile zone loads, or at midnight;
  // until the user picks a day, the selection follows it.
  if (today !== shownToday) {
    setShownToday(today);
    if (!touched) {
      setSelected(today);
      setMonth(monthOf(today));
    }
  }
  const [form, setForm] = useState<RuleFormTarget | null>(null);
  const [deleting, setDeleting] = useState<ScheduleRule | null>(null);

  const rules = rulesQuery.data?.items;
  const dates = useMemo(() => weeksOfMonth(month), [month]);
  const byDate = useMemo(
    () => occurrencesByDate(rules ?? [], dates[0] ?? today, dates.at(-1) ?? today),
    [rules, dates, today],
  );
  const library = useMemo(
    () => new Map((workoutsQuery.data?.items ?? []).map((item) => [item.id, item])),
    [workoutsQuery.data],
  );

  const select = (date: string) => {
    setTouched(true);
    setSelected(date);
    setMonth(monthOf(date));
  };

  let body;
  if (!rules) {
    body = rulesQuery.isError ? (
      <CalendarError onRetry={() => void rulesQuery.refetch()} />
    ) : (
      <CalendarSkeleton />
    );
  } else {
    body = (
      <div className="flex flex-col gap-3.5 lg:flex-row lg:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <MonthHeader
            month={month}
            showToday={month !== monthOf(today)}
            online={online}
            onMove={(delta) => {
              setTouched(true);
              setMonth(addMonths(month, delta));
            }}
            onToday={() => {
              select(today);
              setTouched(false);
            }}
            onSchedule={() => setForm({ kind: 'new', date: maxDate(selected, today) })}
          />
          <MonthGrid
            month={month}
            dates={dates}
            today={today}
            selected={selected}
            byDate={byDate}
            variant={desktop ? 'full' : 'compact'}
            onSelect={select}
          />
        </div>
        <DayPanel
          date={selected}
          today={today}
          rules={byDate.get(selected) ?? []}
          library={library}
          sessions={sessions}
          online={online}
          desktop={desktop}
          onSchedule={() => setForm({ kind: 'new', date: maxDate(selected, today) })}
          onEdit={(rule) => setForm({ kind: 'edit', rule })}
          onDelete={setDeleting}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader sectionTitle title={t('Calendar')} />
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
