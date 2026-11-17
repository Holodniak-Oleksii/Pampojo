'use client';

import { useMemo } from 'react';
import { useCalendarQuery } from '@/api/calendar';
import { useScheduleRulesQuery } from '@/api/plan';
import { OCCURRENCE_STATUS } from '@/constants/plan';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLocalCompletedSessions } from '@/services/local-db';
import {
  computeCalendar,
  type CalendarDay,
  type StatusRule,
  type StatusSession,
} from '@/shared/plan/statuses';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { usePlanTimeZone, usePlanToday } from './usePlanToday';

export interface CalendarDays {
  status: 'loading' | 'error' | 'ready';
  /** False until the server answered for this range; past days are then not called missed. */
  historyKnown: boolean;
  today: string;
  timeZone: string;
  rules: ScheduleRule[];
  days: Map<string, CalendarDay>;
  refetch: () => void;
}

export const toStatusRule = (rule: ScheduleRule): StatusRule => ({
  id: rule.id,
  workoutId: rule.workoutId,
  workoutName: rule.workout.name,
  startDate: rule.startDate,
  endDate: rule.endDate,
  weekdays: rule.weekdays,
  intervalWeeks: rule.intervalWeeks,
});

/**
 * Statuses for `[from, to]`, computed on the device from the rules, the server's sessions and this
 * device's sessions, so a workout finished offline counts before it syncs.
 */
export function useCalendarDays(from: string, to: string): CalendarDays {
  const userId = useCurrentUserId();
  const online = useIsOnline();
  const today = usePlanToday();
  const timeZone = usePlanTimeZone();
  const rulesQuery = useScheduleRulesQuery();
  const remote = useCalendarQuery({ from, to }, { enabled: online });
  const local = useLocalCompletedSessions(userId, from, to);

  const rules = useMemo(() => rulesQuery.data?.items ?? [], [rulesQuery.data]);
  const days = useMemo(() => {
    const sessions = new Map<string, StatusSession>();
    for (const day of remote.data?.days ?? []) {
      for (const session of day.sessions) sessions.set(session.id, session);
    }
    for (const session of local ?? []) sessions.set(session.id, session);
    const computed = computeCalendar({
      rules: rules.map(toStatusRule),
      sessions: [...sessions.values()],
      from,
      to,
      today,
      timeZone,
    });
    const server = new Map((remote.data?.days ?? []).map((day) => [day.date, day]));
    for (const day of computed) {
      for (const occurrence of day.occurrences) {
        // A session that started after `to` is not in the response, but the server saw it.
        const known = server
          .get(day.date)
          ?.occurrences.find(
            (item) => item.ruleId === occurrence.ruleId && item.sessionId !== null,
          );
        if (known && occurrence.sessionId === null) {
          occurrence.status = known.status;
          occurrence.sessionId = known.sessionId;
        }
        if (!remote.data && occurrence.status === OCCURRENCE_STATUS.MISSED) {
          occurrence.status = OCCURRENCE_STATUS.PLANNED;
        }
      }
    }
    return new Map(computed.map((day) => [day.date, day]));
  }, [remote.data, local, rules, from, to, today, timeZone]);

  let status: CalendarDays['status'] = 'ready';
  if (!rulesQuery.data) status = rulesQuery.isError ? 'error' : 'loading';

  return {
    status,
    historyKnown: Boolean(remote.data),
    today,
    timeZone,
    rules,
    days,
    refetch: () => {
      void rulesQuery.refetch();
      void remote.refetch();
    },
  };
}
