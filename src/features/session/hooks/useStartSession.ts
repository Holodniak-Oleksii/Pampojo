'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { fetchSession, fetchSessions } from '@/api/sessions';
import { fetchWorkout, workoutKeys } from '@/api/workouts';
import { SESSION_STATUS } from '@/constants/session';
import { useCurrentUserId } from '@/features/auth/CurrentUser';
import { prefetchLastPerformance, useLocalDb, useSessionRepository } from '@/services/local-db';
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
        await repository.start({
          id,
          workoutId: workout.id,
          workoutSnapshot,
          exercises,
          startedAt: new Date().toISOString(),
        });
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
    [pending, repository, router, queryClient, db, t],
  );

  return { start, pending };
}
