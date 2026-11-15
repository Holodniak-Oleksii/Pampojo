import { Plus, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import { dayHeading, type ScheduledSession } from '@/features/plan';
import { useStartSession } from '@/features/session/hooks/useStartSession';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { WorkoutListItem } from '@/shared/schemas/workout';
import { PlannedRow } from '../PlannedRow';
import { isEditable } from '../utils';

export interface DayPanelProps {
  date: string;
  today: string;
  rules: readonly ScheduleRule[];
  library: ReadonlyMap<string, WorkoutListItem>;
  /** Today's sessions linked to the plan, to tell done workouts. */
  sessions: readonly ScheduledSession[];
  online: boolean;
  desktop: boolean;
  onSchedule: () => void;
  onEdit: (rule: ScheduleRule) => void;
  onDelete: (rule: ScheduleRule) => void;
}

export function DayPanel({
  date,
  today,
  rules,
  library,
  sessions,
  online,
  desktop,
  onSchedule,
  onEdit,
  onDelete,
}: DayPanelProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { start, pending } = useStartSession();
  const isToday = date === today;
  const canSchedule = online && date >= today;
  const doneOf = (rule: ScheduleRule) =>
    isToday
      ? (sessions.find(
          (session) => session.workoutId === rule.workoutId && session.status === 'completed',
        ) ?? null)
      : null;
  const ordered = [...rules].sort(
    (a, b) => Number(doneOf(a) !== null) - Number(doneOf(b) !== null),
  );

  return (
    <section
      aria-labelledby="day-panel-heading"
      className={cn(
        'flex flex-col gap-2.5',
        desktop ? 'w-[340px] shrink-0' : 'border-t border-border-strong pt-1.5',
      )}
    >
      <h2
        id="day-panel-heading"
        className={cn('mt-1.5 font-extrabold', desktop ? 'mt-2 mb-1 text-xl' : 'text-[17px]')}
      >
        {dayHeading(t, locale, date, today)}
      </h2>
      {ordered.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg bg-card">
          {ordered.map((rule) => (
            <PlannedRow
              key={rule.id}
              rule={rule}
              workout={library.get(rule.workoutId)}
              isToday={isToday}
              done={doneOf(rule)}
              editable={isEditable(rule, today)}
              online={online}
              starting={pending}
              onStart={() => void start(rule.workoutId)}
              onEdit={() => onEdit(rule)}
              onDelete={() => onDelete(rule)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-4">
          <span className="flex items-center gap-2.5">
            <Diamond tone="planned" variant="outline" size="md" className="border-[1.5px] border-dashed" />
            <span className="text-muted-foreground">{t('Nothing planned on this day.')}</span>
          </span>
          {canSchedule && !desktop ? (
            <Button className="w-full" onClick={onSchedule}>
              {t('Schedule workout')}
            </Button>
          ) : null}
        </div>
      )}
      {desktop && canSchedule ? (
        <Button variant="secondary" className="w-full" onClick={onSchedule}>
          <Plus aria-hidden="true" strokeWidth={2.4} />
          {t('Schedule on this day')}
        </Button>
      ) : null}
      {!online ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff aria-hidden="true" className="size-4" />
          {t('Needs internet to change the schedule.')}
        </p>
      ) : null}
    </section>
  );
}
