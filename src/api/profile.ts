import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLocalProfile,
  putLocalProfile,
  useLocalQuery,
  useOptionalLocalDb,
} from '@/services/local-db';
import { requestSync } from '@/services/sync/request-sync';
import {
  profileSchema,
  type CompleteOnboardingInput,
  type Profile,
  type UpdateProfileInput,
} from '@/shared/schemas/profile';
import { http } from './http';

const PROFILE_PATH = '/api/v1/me/profile';

export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
};

export function fetchProfile(): Promise<Profile> {
  return http(PROFILE_PATH, { schema: profileSchema });
}

export function completeOnboarding(input: CompleteOnboardingInput): Promise<Profile> {
  return http(PROFILE_PATH, { method: 'PUT', body: input, schema: profileSchema });
}

export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return http(PROFILE_PATH, { method: 'PATCH', body: input, schema: profileSchema });
}

export function useProfileQuery({ initialData }: { initialData?: Profile } = {}) {
  const db = useOptionalLocalDb();
  return useLocalQuery({
    queryKey: profileKeys.me(),
    db,
    // Before the first pull the device has no copy, so the server answer is used once.
    read: async (local) => (await getLocalProfile(local)) ?? initialData ?? fetchProfile(),
    remote: fetchProfile,
    initialData,
  });
}

export function useCompleteOnboardingMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async (input: CompleteOnboardingInput) => {
      const profile = await completeOnboarding(input);
      if (db) await putLocalProfile(db, profile);
      return profile;
    },
    onSuccess: (profile) => {
      if (!db) queryClient.setQueryData(profileKeys.me(), profile);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const db = useOptionalLocalDb();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const profile = await updateProfile(input);
      if (db) await putLocalProfile(db, profile);
      return profile;
    },
    onSuccess: (profile) => {
      if (!db) queryClient.setQueryData(profileKeys.me(), profile);
      // A weight change writes a measurement on the server; the pull brings it.
      requestSync();
    },
  });
}
