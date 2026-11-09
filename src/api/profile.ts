import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useQuery({ queryKey: profileKeys.me(), queryFn: fetchProfile, initialData });
}

export function useCompleteOnboardingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeOnboarding,
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.me(), profile),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.me(), profile),
  });
}
