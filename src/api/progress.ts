import { useQuery, type QueryClient } from '@tanstack/react-query';
import { PROGRESS_GC_MS, PROGRESS_STALE_MS, type ProgressRange } from '@/constants/progress';
import {
  exerciseProgressResponseSchema,
  progressExercisesResponseSchema,
  type ExerciseProgressResponse,
  type ProgressExercisesResponse,
  type ProgressRecord,
} from '@/shared/schemas/progress';
import { http } from './http';

export const progressKeys = {
  all: ['progress'] as const,
  exercises: () => [...progressKeys.all, 'exercises'] as const,
  exercise: (id: string, range: ProgressRange) =>
    [...progressKeys.all, 'exercise', id, range] as const,
};

export function fetchProgressExercises(): Promise<ProgressExercisesResponse> {
  return http('/api/v1/progress/exercises', { schema: progressExercisesResponseSchema });
}

export function fetchExerciseProgress(
  id: string,
  range: ProgressRange,
): Promise<ExerciseProgressResponse> {
  const params = new URLSearchParams({ range });
  return http(`/api/v1/progress/exercises/${id}?${params.toString()}`, {
    schema: exerciseProgressResponseSchema,
  });
}

export function useProgressExercisesQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: progressKeys.exercises(),
    queryFn: fetchProgressExercises,
    staleTime: PROGRESS_STALE_MS,
    gcTime: PROGRESS_GC_MS,
    enabled,
  });
}

/** Records are all-time, so a cached response of any range of the exercise has them. */
export function cachedExerciseRecords(
  client: QueryClient,
  id: string,
): ProgressRecord[] | undefined {
  const cached = client.getQueriesData<ExerciseProgressResponse>({
    queryKey: [...progressKeys.all, 'exercise', id],
  });
  return cached.find(([, data]) => data)?.[1]?.records;
}

export function useExerciseProgressQuery(
  id: string | undefined,
  range: ProgressRange,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: progressKeys.exercise(id ?? '', range),
    queryFn: () => fetchExerciseProgress(id ?? '', range),
    staleTime: PROGRESS_STALE_MS,
    gcTime: PROGRESS_GC_MS,
    enabled: enabled && Boolean(id),
  });
}
