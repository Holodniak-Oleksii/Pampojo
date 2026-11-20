import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getLocalGym, putLocalGym, useLocalQuery, useOptionalLocalDb } from '@/services/local-db';
import { gymSchema, type Gym, type PutGymInput } from '@/shared/schemas/gym';
import { exerciseKeys } from './exercises';
import { ApiError, http } from './http';

const GYM_PATH = '/api/v1/me/gym';
const NOT_FOUND = 'GYM_PROFILE_NOT_FOUND';

export const gymKeys = {
  all: ['gym'] as const,
  me: () => [...gymKeys.all, 'me'] as const,
};

/** `null` before the first save. */
export async function fetchGym(): Promise<Gym | null> {
  try {
    return await http(GYM_PATH, { schema: gymSchema });
  } catch (error) {
    if (error instanceof ApiError && error.code === NOT_FOUND) return null;
    throw error;
  }
}

export function saveGym(input: PutGymInput): Promise<Gym> {
  return http(GYM_PATH, { method: 'PUT', body: input, schema: gymSchema });
}

export function useGymQuery({ initialData }: { initialData?: Gym | null } = {}) {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: gymKeys.me(),
    db,
    // Before the first pull the device has no copy, so the server answer is used once.
    read: async (local) => {
      const gym = await getLocalGym(local);
      return gym === undefined ? (initialData ?? fetchGym()) : gym;
    },
    remote: fetchGym,
    initialData,
  });
}

export function useSaveGymMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async (input: PutGymInput) => {
      const gym = await saveGym(input);
      if (db) await putLocalGym(db, gym);
      return gym;
    },
    onSuccess: (gym) => {
      queryClient.setQueryData(gymKeys.me(), gym);
      // A list filtered by "Available in my gym" depends on the saved equipment.
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
  });
}
