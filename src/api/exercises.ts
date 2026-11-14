import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { EXERCISE_PAGE_SIZE } from '@/constants/exercise';
import type { CatalogFilters } from '@/features/exercises/types';
import {
  exerciseListResponseSchema,
  exerciseSchema,
  type CreateExerciseInput,
  type Exercise,
  type ExerciseListResponse,
  type UpdateExerciseInput,
} from '@/shared/schemas/exercise';
import { http } from './http';
import { workoutKeys } from './workouts';

const EXERCISES_PATH = '/api/v1/exercises';

export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: (filters: CatalogFilters) => [...exerciseKeys.lists(), filters] as const,
  detail: (id: string) => [...exerciseKeys.all, 'detail', id] as const,
};

export function fetchExercises(
  filters: CatalogFilters,
  cursor?: string,
): Promise<ExerciseListResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const muscle of filters.muscles) params.append('muscle', muscle);
  for (const item of filters.equipment) params.append('equipment', item);
  if (filters.mine) params.set('mine', '1');
  if (filters.gym) params.set('gym', '1');
  params.set('limit', String(EXERCISE_PAGE_SIZE));
  if (cursor) params.set('cursor', cursor);
  return http(`${EXERCISES_PATH}?${params}`, { schema: exerciseListResponseSchema });
}

export function useExercisesInfiniteQuery(filters: CatalogFilters) {
  return useInfiniteQuery({
    queryKey: exerciseKeys.list(filters),
    queryFn: ({ pageParam }) => fetchExercises(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Keeps the current list on screen while new filters load, or fail offline.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

const exercisePath = (id: string) => `${EXERCISES_PATH}/${id}`;

/** Creates with a client id; repeating the call is safe (request-safety.md). */
export function createExercise(id: string, input: CreateExerciseInput): Promise<Exercise> {
  return http(exercisePath(id), { method: 'PUT', body: input, schema: exerciseSchema });
}

export function updateExercise(id: string, input: UpdateExerciseInput): Promise<Exercise> {
  return http(exercisePath(id), { method: 'PATCH', body: input, schema: exerciseSchema });
}

export async function deleteExercise(id: string): Promise<void> {
  await http(exercisePath(id), { method: 'DELETE' });
}

export function uploadFrame(id: string, frameId: string, image: Blob): Promise<Exercise> {
  const body = new FormData();
  body.set('file', image, 'photo');
  return http(`${exercisePath(id)}/frames/${frameId}`, {
    method: 'PUT',
    body,
    schema: exerciseSchema,
  });
}

export function deleteFrame(id: string, frameId: string): Promise<Exercise> {
  return http(`${exercisePath(id)}/frames/${frameId}`, {
    method: 'DELETE',
    schema: exerciseSchema,
  });
}

/** Refreshes the catalog and the details after any write. */
export function useInvalidateExercises() {
  const queryClient = useQueryClient();
  return (id: string) => {
    void queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: exerciseKeys.detail(id) });
  };
}

export function useDeleteExerciseMutation() {
  const invalidate = useInvalidateExercises();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExercise,
    onSuccess: (_data, id) => {
      invalidate(id);
      // The server also removed the exercise from the user's workouts.
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
