import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workoutListResponseSchema,
  workoutSchema,
  type PutWorkoutInput,
  type Workout,
  type WorkoutListResponse,
} from '@/shared/schemas/workout';
import { ApiError, http } from './http';

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
  return useQuery({ queryKey: workoutKeys.list(), queryFn: fetchWorkouts });
}

export function useWorkoutQuery(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: workoutKeys.detail(id),
    queryFn: () => fetchWorkout(id),
    enabled: enabled && Boolean(id),
  });
}

export function usePutWorkoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PutWorkoutInput }) => putWorkout(id, input),
    onSuccess: (workout) => {
      queryClient.setQueryData(workoutKeys.detail(workout.id), workout);
      void queryClient.invalidateQueries({ queryKey: workoutKeys.list() });
    },
  });
}

export function useDeleteWorkoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: workoutKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: workoutKeys.list() });
    },
  });
}
