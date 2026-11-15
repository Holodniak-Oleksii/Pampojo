'use client';

import type { QueryClient } from '@tanstack/react-query';
import { fetchProfile, profileKeys, useProfileQuery } from '@/api/profile';
import { useNow } from '@/features/session/hooks/useNow';
import { todayIn } from '@/lib/dates';
import type { Profile } from '@/shared/schemas/profile';

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Today in the profile time zone for a session start, loading the profile when it is not cached.
 * Null when the zone is unknown: the server checks `scheduledFor` against the profile zone, and a
 * guessed date would be rejected and drop the session from the outbox.
 */
export async function planTodayForStart(
  queryClient: QueryClient,
  at: Date = new Date(),
): Promise<string | null> {
  let zone = queryClient.getQueryData<Profile>(profileKeys.me())?.timeZone;
  if (!zone && navigator.onLine) {
    try {
      zone = (await queryClient.fetchQuery({ queryKey: profileKeys.me(), queryFn: fetchProfile }))
        .timeZone;
    } catch {
      // Unknown zone: start without a planned date.
    }
  }
  return zone ? todayIn(zone, at) : null;
}

/** Today in the profile time zone; re-renders each minute so the day flips at midnight. */
export function usePlanToday(): string {
  const profile = useProfileQuery();
  const now = useNow(60_000);
  return todayIn(profile.data?.timeZone ?? deviceZone(), new Date(now));
}
