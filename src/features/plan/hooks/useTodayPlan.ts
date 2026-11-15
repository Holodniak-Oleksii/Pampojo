'use client';

import { useMemo } from 'react';
import { useScheduleRulesQuery } from '@/api/plan';
import { useWorkoutsQuery } from '@/api/workouts';
import { SESSION_STATUS } from '@/constants/session';
import { nextOccurrence, occursOn } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { WorkoutListItem } from '@/shared/schemas/workout';
import type { ScheduledSession } from '../resolveScheduledFor';
import { usePlanToday } from './usePlanToday';
import { useTodaySessions } from './useTodaySessions';

export interface PlannedWorkout {
  rule: ScheduleRule;
  /** The library item, for thumbnails; missing for a workout that is gone. */
  workout: WorkoutListItem | undefined;
  done: ScheduledSession | null;
  active: ScheduledSession | null;
}

export interface TodayPlan {
  status: 'loading' | 'error' | 'ready';
  today: string;
  rules: ScheduleRule[];
  items: PlannedWorkout[];
  next: { date: string; rule: ScheduleRule; workout: WorkoutListItem | undefined } | null;
}

/** Today's planned workouts with their done state, and the next planned day when today is free. */
export function useTodayPlan(): TodayPlan {
  const today = usePlanToday();
  const rulesQuery = useScheduleRulesQuery();
  const workoutsQuery = useWorkoutsQuery();
  const sessions = useTodaySessions(today);

  return useMemo(() => {
    const rules = rulesQuery.data?.items ?? [];
    const status = rulesQuery.data ? 'ready' : rulesQuery.isError ? 'error' : 'loading';
    const library = new Map((workoutsQuery.data?.items ?? []).map((item) => [item.id, item]));
    const live = rules.filter((rule) => !rule.workout.deleted);

    const items = live
      .filter((rule) => occursOn(rule, today))
      .map((rule) => {
        const own = sessions.filter((session) => session.workoutId === rule.workoutId);
        return {
          rule,
          workout: library.get(rule.workoutId),
          done: own.find((session) => session.status === SESSION_STATUS.COMPLETED) ?? null,
          active: own.find((session) => session.status === SESSION_STATUS.IN_PROGRESS) ?? null,
        };
      })
      .sort(
        (a, b) =>
          Number(a.done !== null) - Number(b.done !== null) ||
          a.rule.workout.name.localeCompare(b.rule.workout.name),
      );

    let next: TodayPlan['next'] = null;
    for (const rule of live) {
      const date = nextOccurrence(rule, today);
      if (date && (!next || date < next.date)) {
        next = { date, rule, workout: library.get(rule.workoutId) };
      }
    }
    return { status, today, rules, items, next };
  }, [rulesQuery.data, rulesQuery.isError, workoutsQuery.data, sessions, today]);
}
