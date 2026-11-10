import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { EXERCISE_PAGE_SIZE } from '@/constants/exercise';
import type { CatalogFilters } from '@/features/exercises/types';
import { exerciseListResponseSchema, type ExerciseListResponse } from '@/shared/schemas/exercise';
import { http } from './http';

const EXERCISES_PATH = '/api/v1/exercises';

export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: (filters: CatalogFilters) => [...exerciseKeys.lists(), filters] as const,
};

export function fetchExercises(
  filters: CatalogFilters,
  cursor?: string,
): Promise<ExerciseListResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const muscle of filters.muscles) params.append('muscle', muscle);
  for (const item of filters.equipment) params.append('equipment', item);
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
