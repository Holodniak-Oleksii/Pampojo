import type { TFunction } from 'i18next';
import { OCCURRENCE_STATUS, SESSION_KIND } from '@/constants/plan';
import { statusLabel, weekdayShortOf, type MarkerStatus } from '@/features/plan';
import type { Locale } from '@/i18n/config';
import { addDays, expandOccurrences, isoWeekday } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { CalendarDay } from '@/shared/plan/statuses';

/** `YYYY-MM` of a date. */
export const monthOf = (date: string) => date.slice(0, 7);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = (y ?? 0) * 12 + (m ?? 1) - 1 + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The Monday-first grid of a month: whole weeks, 5 or 6 of them. */
export function weeksOfMonth(month: string): string[] {
  const first = `${month}-01`;
  const start = addDays(first, 1 - isoWeekday(first));
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const end = addDays(last, 7 - isoWeekday(last));
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Rules occurring on each date of `[from, to]`. */
export function occurrencesByDate(
  rules: readonly ScheduleRule[],
  from: string,
  to: string,
): Map<string, ScheduleRule[]> {
  const byDate = new Map<string, ScheduleRule[]>();
  for (const rule of rules) {
    for (const date of expandOccurrences(rule, from, to)) {
      const list = byDate.get(date) ?? [];
      list.push(rule);
      byDate.set(date, list);
    }
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.workout.name.localeCompare(b.workout.name));
  }
  return byDate;
}

export interface DayMarker {
  key: string;
  status: MarkerStatus;
  /** The line on a desktop cell. */
  name: string;
  /** Only on desktop: a late session on its own day, which the phone grid leaves out. */
  desktopOnly?: boolean;
}

/** Markers of a day: occurrences by name, then extra sessions, then late make-ups by start. */
export function markersOf(t: TFunction, locale: Locale, day: CalendarDay | undefined): DayMarker[] {
  if (!day) return [];
  const markers: DayMarker[] = day.occurrences.map((occurrence) => ({
    key: `${occurrence.ruleId}`,
    status: occurrence.status,
    name: occurrence.workoutName,
  }));
  for (const session of day.sessions) {
    if (session.kind === SESSION_KIND.EXTRA) {
      markers.push({ key: session.id, status: SESSION_KIND.EXTRA, name: session.workoutName });
    } else if (session.kind === SESSION_KIND.LATE && session.scheduledFor) {
      markers.push({
        key: session.id,
        status: OCCURRENCE_STATUS.LATE,
        name: t('{{name}}, for {{weekday}}', {
          name: session.workoutName,
          weekday: weekdayShortOf(locale, session.scheduledFor),
        }),
        desktopOnly: true,
      });
    }
  }
  return markers;
}

/** "16 листопада, пропущено, сьогодні" for a grid cell or a week strip day. */
export function dayLabel(
  t: TFunction,
  date: string,
  dateLabel: string,
  markers: readonly DayMarker[],
  isToday: boolean,
): string {
  const parts = [
    dateLabel,
    ...markers.filter((m) => !m.desktopOnly).map((m) => statusLabel(t, m.status).toLowerCase()),
  ];
  if (isToday) parts.push(t('today'));
  return parts.join(', ');
}

/** A rule can still change: it has not ended and its workout exists. */
export function isEditable(rule: ScheduleRule, today: string): boolean {
  return !rule.workout.deleted && (rule.endDate === null || rule.endDate >= today);
}
