import {
  LATE_WINDOW_DAYS,
  OCCURRENCE_STATUS,
  SESSION_KIND,
  type OccurrenceStatus,
  type SessionKind,
} from '@/constants/plan';
import { SESSION_STATUS, type SessionStatus } from '@/constants/session';
import { todayIn } from '@/lib/dates';
import { addDays, expandOccurrences, minDate, nextOccurrence, type RuleShape } from './occurrences';

export interface StatusRule extends RuleShape {
  id: string;
  workoutId: string;
  workoutName: string;
  /** A deleted workout keeps only the occurrences that a completed session fulfils. */
  workoutDeleted?: boolean;
}

export interface StatusSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  scheduledFor: string | null;
  status: SessionStatus;
  startedAt: string;
  finishedAt: string | null;
  setCount: number;
}

export interface CalendarOccurrence {
  ruleId: string;
  workoutId: string;
  workoutName: string;
  status: OccurrenceStatus;
  sessionId: string | null;
  lateWindowEnd: string | null;
}

export interface CalendarSession extends StatusSession {
  kind: SessionKind;
}

export interface CalendarDay {
  date: string;
  occurrences: CalendarOccurrence[];
  sessions: CalendarSession[];
}

export interface RangeSummary {
  onTime: number;
  late: number;
  missed: number;
  planned: number;
  extra: number;
  due: number;
  done: number;
  /** Whole percent, or null when nothing was due. */
  percent: number | null;
  /** The status of each due occurrence, in date order. */
  dueRow: OccurrenceStatus[];
}

const HOUR_MS = 3_600_000;

/** Bounds that hold every instant whose date in any time zone (UTC−12 … UTC+14) is in the range. */
export function instantRange(from: string, to: string): { fromInstant: Date; toInstant: Date } {
  return {
    fromInstant: new Date(Date.parse(`${from}T00:00:00Z`) - 14 * HOUR_MS),
    toInstant: new Date(Date.parse(`${to}T00:00:00Z`) + 38 * HOUR_MS),
  };
}

/** The calendar date on which the session started, in the profile time zone. */
export function startDateOf(session: Pick<StatusSession, 'startedAt'>, timeZone: string): string {
  return todayIn(timeZone, new Date(session.startedAt));
}

/**
 * The last day on which a missed occurrence of the workout on `date` can be made up, or null when
 * the window is empty. The window ends before the next occurrence of the same workout, and after
 * at most `LATE_WINDOW_DAYS` days.
 */
export function lateWindowEnd(
  rules: readonly (RuleShape & { workoutId: string })[],
  workoutId: string,
  date: string,
): string | null {
  let next: string | null = null;
  for (const rule of rules) {
    if (rule.workoutId !== workoutId) continue;
    const candidate = nextOccurrence(rule, date);
    if (candidate !== null && (next === null || candidate < next)) next = candidate;
  }
  const cap = addDays(date, LATE_WINDOW_DAYS);
  const end = next === null ? cap : minDate(addDays(next, -1), cap);
  return end < addDays(date, 1) ? null : end;
}

/** How a completed session relates to the plan, given the late window of its planned date. */
export function sessionKind(
  session: Pick<StatusSession, 'scheduledFor' | 'startedAt'>,
  timeZone: string,
  windowEnd: string | null,
): SessionKind {
  if (session.scheduledFor === null) return SESSION_KIND.EXTRA;
  const start = startDateOf(session, timeZone);
  if (start === session.scheduledFor) return SESSION_KIND.ON_TIME;
  if (start > session.scheduledFor && windowEnd !== null && start <= windowEnd) {
    return SESSION_KIND.LATE;
  }
  return SESSION_KIND.EXTRA;
}

/**
 * The kind of a stored session from its link alone. The server checked the late window when it
 * stored `scheduledFor`, so any later start is late.
 */
export function linkedKind(
  session: Pick<StatusSession, 'scheduledFor' | 'startedAt'>,
  timeZone: string,
): SessionKind {
  if (session.scheduledFor === null) return SESSION_KIND.EXTRA;
  const start = startDateOf(session, timeZone);
  if (start === session.scheduledFor) return SESSION_KIND.ON_TIME;
  return start > session.scheduledFor ? SESSION_KIND.LATE : SESSION_KIND.EXTRA;
}

const keyOf = (workoutId: string | null, date: string) => `${workoutId ?? ''}|${date}`;

/** Statuses of the plan's occurrences and the completed sessions for each date in `[from, to]`. */
export function computeCalendar({
  rules,
  sessions,
  from,
  to,
  today,
  timeZone,
}: {
  rules: readonly StatusRule[];
  sessions: readonly StatusSession[];
  from: string;
  to: string;
  today: string;
  timeZone: string;
}): CalendarDay[] {
  const days = new Map<string, CalendarDay>();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.set(date, { date, occurrences: [], sessions: [] });
  }

  const occurrences: CalendarOccurrence[] = [];
  const occurrenceDates = new Map<CalendarOccurrence, string>();
  const deletedOccurrences = new Set<CalendarOccurrence>();
  const occurrenceKeys = new Set<string>();
  for (const rule of rules) {
    for (const date of expandOccurrences(rule, from, to)) {
      const occurrence: CalendarOccurrence = {
        ruleId: rule.id,
        workoutId: rule.workoutId,
        workoutName: rule.workoutName,
        status: OCCURRENCE_STATUS.PLANNED,
        sessionId: null,
        lateWindowEnd: lateWindowEnd(rules, rule.workoutId, date),
      };
      occurrences.push(occurrence);
      occurrenceDates.set(occurrence, date);
      if (rule.workoutDeleted) deletedOccurrences.add(occurrence);
      occurrenceKeys.add(keyOf(rule.workoutId, date));
    }
  }

  const completed = sessions
    .filter((session) => session.status === SESSION_STATUS.COMPLETED)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));

  // The first session that fulfils an occurrence wins; any later one for the same date is extra.
  const fulfilled = new Map<string, CalendarSession>();
  const placed: CalendarSession[] = [];
  for (const session of completed) {
    let kind: SessionKind = SESSION_KIND.EXTRA;
    if (session.scheduledFor !== null && session.workoutId !== null) {
      const key = keyOf(session.workoutId, session.scheduledFor);
      const windowEnd = lateWindowEnd(rules, session.workoutId, session.scheduledFor);
      const candidate = sessionKind(session, timeZone, windowEnd);
      if (candidate !== SESSION_KIND.EXTRA && occurrenceKeys.has(key) && !fulfilled.has(key)) {
        kind = candidate;
      }
      const entry = { ...session, kind };
      if (kind !== SESSION_KIND.EXTRA) fulfilled.set(key, entry);
      placed.push(entry);
    } else {
      placed.push({ ...session, kind });
    }
  }

  for (const occurrence of occurrences) {
    const date = occurrenceDates.get(occurrence) ?? '';
    const session = fulfilled.get(keyOf(occurrence.workoutId, date));
    if (session) {
      occurrence.sessionId = session.id;
      occurrence.status =
        session.kind === SESSION_KIND.ON_TIME ? OCCURRENCE_STATUS.ON_TIME : OCCURRENCE_STATUS.LATE;
    } else if (deletedOccurrences.has(occurrence)) {
      continue;
    } else if (date < today) {
      occurrence.status = OCCURRENCE_STATUS.MISSED;
    }
    days.get(date)?.occurrences.push(occurrence);
  }

  for (const session of placed) {
    days.get(startDateOf(session, timeZone))?.sessions.push(session);
  }

  const notDone = (status: OccurrenceStatus) =>
    status === OCCURRENCE_STATUS.MISSED || status === OCCURRENCE_STATUS.PLANNED;
  for (const day of days.values()) {
    day.occurrences.sort(
      (a, b) =>
        Number(notDone(b.status)) - Number(notDone(a.status)) ||
        a.workoutName.localeCompare(b.workoutName),
    );
  }
  return [...days.values()];
}

/** Adherence counts for the days in `[from, to]`. Today's occurrences are due only once done. */
export function summarize(
  days: Iterable<CalendarDay>,
  from: string,
  to: string,
  today: string,
): RangeSummary {
  const summary: RangeSummary = {
    onTime: 0,
    late: 0,
    missed: 0,
    planned: 0,
    extra: 0,
    due: 0,
    done: 0,
    percent: null,
    dueRow: [],
  };
  const inRange = [...days]
    .filter((day) => day.date >= from && day.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const day of inRange) {
    for (const occurrence of day.occurrences) {
      const { status } = occurrence;
      if (status === OCCURRENCE_STATUS.ON_TIME) summary.onTime += 1;
      else if (status === OCCURRENCE_STATUS.LATE) summary.late += 1;
      else if (status === OCCURRENCE_STATUS.MISSED) summary.missed += 1;
      else summary.planned += 1;
      const due = day.date < today || (day.date === today && status !== OCCURRENCE_STATUS.PLANNED);
      if (due) summary.dueRow.push(status);
    }
    summary.extra += day.sessions.filter((session) => session.kind === SESSION_KIND.EXTRA).length;
  }
  summary.due = summary.dueRow.length;
  summary.done = summary.onTime + summary.late;
  summary.percent = summary.due ? Math.round((summary.done / summary.due) * 100) : null;
  return summary;
}

/** The latest missed occurrence of the workout that can still be made up today, or null. */
export function findMakeUpDate({
  days,
  workoutId,
  today,
}: {
  days: Iterable<CalendarDay>;
  workoutId: string;
  today: string;
}): string | null {
  let latest: string | null = null;
  for (const day of days) {
    for (const occurrence of day.occurrences) {
      if (
        occurrence.workoutId === workoutId &&
        occurrence.status === OCCURRENCE_STATUS.MISSED &&
        occurrence.lateWindowEnd !== null &&
        occurrence.lateWindowEnd >= today &&
        (latest === null || day.date > latest)
      ) {
        latest = day.date;
      }
    }
  }
  return latest;
}
