'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchSession, fetchSessions } from '@/api/sessions';
import { fetchScheduleRules, planKeys } from '@/api/plan';
import { fetchWorkout, workoutKeys } from '@/api/workouts';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { planTodayForStart, resolveScheduledFor, type ScheduledSession } from '@/features/plan';
import { requestPersistentStorage } from '@/features/pwa';
import {
  findScheduledSessions,
  prefetchLastPerformance,
  useLocalDb,
  useSessionRepository,
} from '@/services/local-db';
import type { ScheduleRuleListResponse } from '@/shared/schemas/plan';
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
  const [pending, setPending] = useState(false);

  /** Today's date when this start fulfils today's plan for the workout, else null (spec 11). */
  const plannedDateFor = useCallback(
    async (workoutId: string): Promise<string | null> => {
      const today = await planTodayForStart(queryClient);
      if (today === null) return null;
      let rules = queryClient.getQueryData<ScheduleRuleListResponse>(planKeys.list())?.items;
      const sessions: ScheduledSession[] = await findScheduledSessions(db, today);
      if (navigator.onLine) {
        try {
          rules ??= await queryClient
            .fetchQuery({
              queryKey: planKeys.list(),
              queryFn: fetchScheduleRules,
            })
            .then((response) => response.items);
          sessions.push(...(await fetchSessions({ scheduledFor: today })).items);
        } catch {
          // Without the server the local data decides.
        }
      }
      const live = (rules ?? []).filter((rule) => !rule.workout.deleted);
      return resolveScheduledFor({ workoutId, rules: live, today, sessions });
    },
    [queryClient, db],
  );

  const start = useCallback(
    async (workoutId: string): Promise<boolean> => {
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

        const id = crypto.randomUUID();
        const { workoutSnapshot, exercises } = buildSessionFromWorkout(workout);
        const scheduledFor = await plannedDateFor(workout.id);
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
    [pending, repository, router, queryClient, db, t, plannedDateFor],
  );

  return { start, pending };
}
