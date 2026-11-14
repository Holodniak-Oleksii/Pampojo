import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({ queryKey: gymKeys.me(), queryFn: fetchGym, initialData });
}

export function useSaveGymMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveGym,
    onSuccess: (gym) => {
      queryClient.setQueryData(gymKeys.me(), gym);
      // A list filtered by "Available in my gym" depends on the saved equipment.
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.lists() });
    },
  });
}
