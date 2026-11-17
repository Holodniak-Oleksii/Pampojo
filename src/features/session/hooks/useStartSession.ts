'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchSession, fetchSessions } from '@/api/sessions';
import { calendarKeys, fetchCalendar } from '@/api/calendar';
import { fetchScheduleRules, planKeys } from '@/api/plan';
import { fetchWorkout, workoutKeys } from '@/api/workouts';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import {
  planZoneForStart,
  resolveScheduledFor,
  toStatusRule,
  useMakeUpPrompt,
  type ScheduledSession,
} from '@/features/plan';
import { todayIn } from '@/lib/dates';
import { addDays } from '@/shared/plan/occurrences';
import { computeCalendar, findMakeUpDate, type StatusSession } from '@/shared/plan/statuses';
import type { CalendarResponse } from '@/shared/schemas/calendar';
import { requestPersistentStorage } from '@/features/pwa';
import {
  findCompletedSessionsBetween,
  findScheduledSessions,
  prefetchLastPerformance,
  useLocalDb,
  useSessionRepository,
} from '@/services/local-db';
import type { ScheduleRule, ScheduleRuleListResponse } from '@/shared/schemas/plan';
import type { Workout } from '@/shared/schemas/workout';
import { buildSessionFromWorkout } from '../utils';

export const sessionHref = (id: string) => `/session/${id}`;

/** Starts a workout, or opens the session already in progress (one at a time). */
export function useStartSession() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const db = useLocalDb(userId);
  const repository = useSessionRepository(userId);
  const ask = useMakeUpPrompt();
  const [pending, setPending] = useState(false);

  const loadRules = useCallback(async (): Promise<ScheduleRule[]> => {
    const cached = queryClient.getQueryData<ScheduleRuleListResponse>(planKeys.list())?.items;
    if (cached || !navigator.onLine) return cached ?? [];
    try {
      return (
        await queryClient.fetchQuery({ queryKey: planKeys.list(), queryFn: fetchScheduleRules })
      ).items;
    } catch {
      return [];
    }
  }, [queryClient]);

  /** Today's date when this start fulfils today's plan for the workout, else null (spec 11). */
  const plannedDateFor = useCallback(
    async (workoutId: string, today: string): Promise<string | null> => {
      const sessions: ScheduledSession[] = await findScheduledSessions(db, today);
      const rules = await loadRules();
      if (navigator.onLine) {
        try {
          sessions.push(...(await fetchSessions({ scheduledFor: today })).items);
        } catch {
          // Without the server the local data decides.
        }
      }
      const live = rules.filter((rule) => !rule.workout.deleted);
      return resolveScheduledFor({ workoutId, rules: live, today, sessions });
    },
    [db, loadRules],
  );

  /** The latest missed date of the workout that this start can still make up, else null (spec 12). */
  const makeUpDateFor = useCallback(
    async (workoutId: string, today: string, timeZone: string): Promise<string | null> => {
      const from = addDays(today, -8);
      const to = addDays(today, -1);
      const key = calendarKeys.range(from, to);
      let remote = queryClient.getQueryData<CalendarResponse>(key);
      if (navigator.onLine) {
        try {
          remote = await queryClient.fetchQuery({
            queryKey: key,
            queryFn: () => fetchCalendar({ from, to }),
          });
        } catch {
          // The cached copy, if any, and this device's sessions decide.
        }
      }
      const sessions = new Map<string, StatusSession>();
      for (const day of remote?.days ?? []) {
        for (const session of day.sessions) sessions.set(session.id, session);
      }
      for (const session of await findCompletedSessionsBetween(db, from, to)) {
        sessions.set(session.id, session);
      }
      const rules = (await loadRules()).filter((rule) => !rule.workout.deleted);
      const days = computeCalendar({
        rules: rules.map(toStatusRule),
        sessions: [...sessions.values()],
        from,
        to,
        today,
        timeZone,
      });
      // Without the server's answer, a day this device knows nothing about may be done elsewhere.
      for (const day of remote?.days ?? []) {
        const local = days.find((item) => item.date === day.date);
        for (const occurrence of local?.occurrences ?? []) {
          const known = day.occurrences.find((item) => item.ruleId === occurrence.ruleId);
          if (known?.sessionId) occurrence.status = known.status;
        }
      }
      return remote || navigator.onLine === false
        ? findMakeUpDate({ days, workoutId, today })
        : null;
    },
    [queryClient, db, loadRules],
  );

  /** `scheduledFor` for a new session, or `undefined` when the user closed the make-up dialog. */
  const scheduleFor = useCallback(
    async (workout: Workout, makeUpFor?: string): Promise<string | null | undefined> => {
      if (makeUpFor) return makeUpFor;
      const timeZone = await planZoneForStart(queryClient);
      if (timeZone === null) return null;
      const today = todayIn(timeZone);
      const planned = await plannedDateFor(workout.id, today);
      if (planned !== null) return planned;
      const missed = await makeUpDateFor(workout.id, today, timeZone);
      if (missed === null) return null;
      const choice = await ask({ workoutName: workout.name, date: missed });
      if (choice === 'cancel') return undefined;
      return choice === 'make_up' ? missed : null;
    },
    [queryClient, plannedDateFor, makeUpDateFor, ask],
  );

  const start = useCallback(
    async (workoutId: string, options: { makeUpFor?: string } = {}): Promise<boolean> => {
      if (pending) return false;
      setPending(true);
      try {
        const local = await repository.findInProgress();
        if (local) {
          router.push(sessionHref(local.id));
          return true;
        }
        if (navigator.onLine) {
          try {
            const remote = (await fetchSessions({ status: SESSION_STATUS.IN_PROGRESS })).items[0];
            const session = remote ? await fetchSession(remote.id) : null;
            if (session) {
              await repository.importRemote(session);
              router.push(sessionHref(session.id));
              return true;
            }
          } catch {
            // The server could not be asked; start on this device.
          }
        }

        let workout: Workout | null | undefined;
        if (navigator.onLine) {
          try {
            workout = await queryClient.fetchQuery({
              queryKey: workoutKeys.detail(workoutId),
              queryFn: () => fetchWorkout(workoutId),
            });
          } catch {
            workout = queryClient.getQueryData<Workout | null>(workoutKeys.detail(workoutId));
          }
        } else {
          workout = queryClient.getQueryData<Workout | null>(workoutKeys.detail(workoutId));
        }
        if (!workout || workout.exercises.length === 0) {
          toast(t('Needs internet'));
          return false;
        }

        const scheduledFor = await scheduleFor(workout, options.makeUpFor);
        if (scheduledFor === undefined) return false;
        const id = crypto.randomUUID();
        const { workoutSnapshot, exercises } = buildSessionFromWorkout(workout);
        await repository.start({
          id,
          workoutId: workout.id,
          workoutSnapshot,
          exercises,
          startedAt: new Date().toISOString(),
          scheduledFor,
        });
        void requestPersistentStorage();
        void prefetchLastPerformance(
          db,
          exercises.map((item) => item.exerciseId),
        );
        router.push(sessionHref(id));
        return true;
      } catch {
        toast(t('Something went wrong. Try again.'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [pending, repository, router, queryClient, db, t, scheduleFor],
  );

  return { start, pending };
}
