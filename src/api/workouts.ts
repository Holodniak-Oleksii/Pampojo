import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/i18n/config';
import {
  fromWorkoutResponse,
  getLocalWorkout,
  listLocalWorkouts,
  markLocalWorkoutDeleted,
  putLocalWorkout,
  putMissingWorkoutExercises,
  useLocalQuery,
  useOptionalLocalDb,
  type PampojoDb,
} from '@/services/local-db';
import { requestSync } from '@/services/sync/request-sync';
import {
  workoutListResponseSchema,
  workoutSchema,
  type PutWorkoutInput,
  type Workout,
  type WorkoutListResponse,
} from '@/shared/schemas/workout';
import { ApiError, http } from './http';
import { planKeys } from './plan';

const WORKOUTS_PATH = '/api/v1/workouts';
const NOT_FOUND = 'WORKOUT_NOT_FOUND';

export const workoutKeys = {
  all: ['workouts'] as const,
  list: () => [...workoutKeys.all, 'list'] as const,
  detail: (id: string) => [...workoutKeys.all, 'detail', id] as const,
};

const workoutPath = (id: string) => `${WORKOUTS_PATH}/${id}`;

export function fetchWorkouts(): Promise<WorkoutListResponse> {
  return http(WORKOUTS_PATH, { schema: workoutListResponseSchema });
}

/** `null` for a missing, deleted or foreign workout. */
export async function fetchWorkout(id: string): Promise<Workout | null> {
  try {
    return await http(workoutPath(id), { schema: workoutSchema });
  } catch (error) {
    if (error instanceof ApiError && error.code === NOT_FOUND) return null;
    throw error;
  }
}

/** Creates or replaces with a client id; repeating the call is safe (request-safety.md). */
export function putWorkout(id: string, input: PutWorkoutInput): Promise<Workout> {
  return http(workoutPath(id), { method: 'PUT', body: input, schema: workoutSchema });
}

export async function deleteWorkout(id: string): Promise<void> {
  await http(workoutPath(id), { method: 'DELETE' });
}

export function useWorkoutsQuery() {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: workoutKeys.list(),
    db,
    read: listLocalWorkouts,
    remote: fetchWorkouts,
  });
}

export function useWorkoutQuery(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  const db = useOptionalLocalDb();
  const lang = useTranslation().i18n.language;
  return useLocalQuery({
    queryKey: [...workoutKeys.detail(id), lang],
    db,
    read: (local) => getLocalWorkout(local, id, lang),
    remote: () => fetchWorkout(id),
    enabled: enabled && Boolean(id),
  });
}

/** Puts a written workout on the device, with placeholders for exercises it does not have yet. */
async function storeWorkout(db: PampojoDb, workout: Workout, lang: Locale): Promise<void> {
  await db.transaction('rw', [db.workouts, db.exercises], async () => {
    await putLocalWorkout(db, fromWorkoutResponse(workout));
    await putMissingWorkoutExercises(db, workout, lang);
  });
}

export function usePutWorkoutMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  const lang = useTranslation().i18n.language as Locale;
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PutWorkoutInput }) => {
      const workout = await putWorkout(id, input);
      if (db) await storeWorkout(db, workout, lang);
      return workout;
    },
    onSuccess: (workout) => {
      if (!db) queryClient.setQueryData(workoutKeys.detail(workout.id), workout);
      void queryClient.invalidateQueries({ queryKey: workoutKeys.list() });
      // The pull brings the exercises and "last time" that a new workout entry needs.
      requestSync();
    },
  });
}

export function useDeleteWorkoutMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteWorkout(id);
      if (db) await markLocalWorkoutDeleted(db, id);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: workoutKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: workoutKeys.list() });
      // The server ended the workout's schedule rules in the same delete.
      void queryClient.invalidateQueries({ queryKey: planKeys.all });
      requestSync();
    },
  });
}
