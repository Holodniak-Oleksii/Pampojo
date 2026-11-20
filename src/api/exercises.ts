import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EXERCISE_PAGE_SIZE } from '@/constants/exercise';
import { useIsOnline } from '@/hooks/useIsOnline';
import type { Locale } from '@/i18n/config';
import {
  countLocalExercises,
  deleteLocalExercise,
  getLocalExercise,
  getLocalGym,
  searchLocalExercises,
  useLocalQuery,
  useOptionalLocalDb,
} from '@/services/local-db';
import { requestSync } from '@/services/sync/request-sync';
import type { CatalogFilters } from '@/features/exercises/types';
import {
  exerciseListResponseSchema,
  exerciseSchema,
  type CreateExerciseInput,
  type Exercise,
  type ExerciseListResponse,
  type UpdateExerciseInput,
} from '@/shared/schemas/exercise';
import { ApiError, http } from './http';
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

/** One exercise from the server, or null when it does not exist for this user. */
export async function fetchExercise(id: string): Promise<Exercise | null> {
  try {
    return await http(`${EXERCISES_PATH}/${id}`, { schema: exerciseSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Exercise details: the device copy first, then the server for an exercise the device lacks.
 * The server read is a separate query, so the Dexie live query never calls the network.
 */
export function useExerciseQuery(id: string) {
  const db = useOptionalLocalDb();
  const lang = useTranslation().i18n.language;
  const online = useIsOnline();
  const local = useLocalQuery({
    queryKey: [...exerciseKeys.detail(id), lang],
    db,
    read: (localDb) => getLocalExercise(localDb, id, lang),
    remote: () => fetchExercise(id),
  });
  const missing = db !== null && local.data === null;
  const remote = useQuery({
    queryKey: [...exerciseKeys.detail(id), lang, 'remote'],
    queryFn: () => fetchExercise(id),
    enabled: missing && online,
  });
  return missing && online ? remote : local;
}

/** True offline on the device: the catalog then lists only the exercises the device keeps. */
export function useLocalCatalog(): boolean {
  const db = useOptionalLocalDb();
  return !useIsOnline() && db !== null;
}

export function useLocalExerciseCount() {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: [...exerciseKeys.all, 'local-count'],
    db,
    read: countLocalExercises,
    remote: () => Promise.resolve(0),
  });
}

export function useExercisesInfiniteQuery(filters: CatalogFilters) {
  const db = useOptionalLocalDb();
  const local = useLocalCatalog();
  const lang = useTranslation().i18n.language as Locale;
  return useInfiniteQuery({
    queryKey: [...exerciseKeys.list(filters), local ? 'local' : 'remote', lang],
    queryFn: async ({ pageParam }): Promise<ExerciseListResponse> => {
      if (local && db) {
        const gym = (await getLocalGym(db)) ?? null;
        const items = await searchLocalExercises(db, filters, lang, gym?.equipment ?? null);
        return { items, nextCursor: null };
      }
      return fetchExercises(filters, pageParam);
    },
    networkMode: local ? 'always' : 'online',
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
    // Own exercises reach the device through the pull, which also signs their frame URLs.
    requestSync();
  };
}

export function useDeleteExerciseMutation() {
  const invalidate = useInvalidateExercises();
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteExercise(id);
      if (db) await deleteLocalExercise(db, id);
    },
    onSuccess: (_data, id) => {
      // The pull brings the workouts and sets the server changed with the delete.
      requestSync();
      invalidate(id);
      // The server also removed the exercise from the user's workouts.
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
