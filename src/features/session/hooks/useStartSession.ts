'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { calendarKeys, fetchCalendar } from '@/api/calendar';
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
import { exerciseDetailPaths, requestPersistentStorage, warmPages } from '@/features/pwa';
import {
  findCompletedSessionsBetween,
  findScheduledSessions,
  getLocalProfile,
  getLocalWorkout,
  listLocalRules,
  prefetchLastPerformance,
  useLocalDb,
  useSessionRepository,
} from '@/services/local-db';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { Workout } from '@/shared/schemas/workout';
import { buildSessionFromWorkout } from '../utils';

export const sessionHref = (id: string) => `/session/${id}`;

/** Starts a workout, or opens the session already in progress (one at a time). */
export function useStartSession() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const db = useLocalDb(userId);
  const repository = useSessionRepository(userId);
  const ask = useMakeUpPrompt();
  const [pending, setPending] = useState(false);

  const loadRules = useCallback(
    async (): Promise<ScheduleRule[]> => (await listLocalRules(db)).items,
    [db],
  );

  /** Today's date when this start fulfils today's plan for the workout, else null (spec 11). */
  const plannedDateFor = useCallback(
    async (workoutId: string, today: string): Promise<string | null> => {
      // The device keeps every session of the last 30 days, so it knows today's sessions.
      const sessions: ScheduledSession[] = await findScheduledSessions(db, today);
      const rules = await loadRules();
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
      const timeZone =
        (await getLocalProfile(db))?.timeZone ?? (await planZoneForStart(queryClient));
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
    [queryClient, db, plannedDateFor, makeUpDateFor, ask],
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
        // Pull brings in-progress sessions of other devices, so the device copy decides.
        const workout: Workout | null = await getLocalWorkout(db, workoutId, i18n.language);
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
        void warmPages(exerciseDetailPaths(exercises.map((item) => item.exerciseId)));
        router.push(sessionHref(id));
        return true;
      } catch {
        toast(t('Something went wrong. Try again.'));
        return false;
      } finally {
        setPending(false);
      }
    },
    [pending, repository, router, db, t, i18n.language, scheduleFor],
  );

  return { start, pending };
}
