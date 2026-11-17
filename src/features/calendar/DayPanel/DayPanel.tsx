import { Plus, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { Button } from '@/components/ui/button';
import { dayHeading, type ScheduledSession } from '@/features/plan';
import { useStartSession } from '@/features/session/hooks/useStartSession';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { CalendarDay, CalendarSession } from '@/shared/plan/statuses';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { WorkoutListItem } from '@/shared/schemas/workout';
import { MissedRow } from '../MissedRow';
import { PlannedRow } from '../PlannedRow';
import { SessionRow } from '../SessionRow';
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
  /** Statuses and finished sessions of the day (spec 12). */
  day: CalendarDay | undefined;
  /** Sessions of the visible range by id, to show a late session on its planned day. */
  sessionsById: ReadonlyMap<string, CalendarSession>;
  timeZone: string;
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
  day,
  sessionsById,
  timeZone,
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
  // On-time sessions already show as "Виконано" on their planned row; make-ups and extras do not.
  const finishedToday = isToday
    ? (day?.sessions ?? []).filter((session) => session.kind !== 'on_time')
    : [];
  const thumbnail = (workoutId: string | null) =>
    (workoutId ? library.get(workoutId)?.thumbnailUrls[0] : undefined) ?? null;

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
      {date < today ? (
        <PastDay
          day={day}
          sessionsById={sessionsById}
          library={library}
          today={today}
          timeZone={timeZone}
          starting={pending}
          onMakeUp={(workoutId) => void start(workoutId, { makeUpFor: date })}
        />
      ) : ordered.length > 0 || finishedToday.length > 0 ? (
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
          {finishedToday.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              thumbnailUrl={thumbnail(session.workoutId)}
              timeZone={timeZone}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-card p-4">
          <span className="flex items-center gap-2.5">
            <Diamond
              tone="planned"
              variant="outline"
              size="md"
              className="border-[1.5px] border-dashed"
            />
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

function PastDay({
  day,
  sessionsById,
  library,
  today,
  timeZone,
  starting,
  onMakeUp,
}: {
  day: CalendarDay | undefined;
  sessionsById: ReadonlyMap<string, CalendarSession>;
  library: ReadonlyMap<string, WorkoutListItem>;
  today: string;
  timeZone: string;
  starting: boolean;
  onMakeUp: (workoutId: string) => void;
}) {
  const { t } = useTranslation();
  const thumbnail = (workoutId: string | null) =>
    (workoutId ? library.get(workoutId)?.thumbnailUrls[0] : undefined) ?? null;
  const missed = day?.occurrences.filter((item) => item.status === 'missed') ?? [];
  // A late session started on a later day; it shows here too, on the day it was planned for.
  const madeUp = (day?.occurrences ?? []).flatMap((item) => {
    if (item.status !== 'late' || !item.sessionId) return [];
    const session = sessionsById.get(item.sessionId);
    return session ? [session] : [];
  });
  const sessions = day?.sessions ?? [];

  if (missed.length === 0 && madeUp.length === 0 && sessions.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-card p-4">
        <Diamond
          tone="planned"
          variant="outline"
          size="md"
          className="border-[1.5px] border-dashed"
        />
        <span className="text-muted-foreground">{t('Nothing planned on this day.')}</span>
      </div>
    );
  }
  return (
    <>
      {missed.map((occurrence) => (
        <MissedRow
          key={occurrence.ruleId}
          occurrence={occurrence}
          thumbnailUrl={thumbnail(occurrence.workoutId)}
          today={today}
          starting={starting}
          onMakeUp={() => onMakeUp(occurrence.workoutId)}
        />
      ))}
      {madeUp.length + sessions.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg bg-card">
          {madeUp.map((session) => (
            <SessionRow
              key={`planned-${session.id}`}
              session={session}
              thumbnailUrl={thumbnail(session.workoutId)}
              timeZone={timeZone}
              variant="occurrence"
            />
          ))}
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              thumbnailUrl={thumbnail(session.workoutId)}
              timeZone={timeZone}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
}
