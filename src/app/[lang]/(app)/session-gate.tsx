import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ORIGINAL_PATH_HEADER } from '@/constants/routing';
import { CurrentUserProvider } from '@/features/auth/CurrentUser';
import { safeNext } from '@/features/auth/utils';
import { getRequestSession } from '@/server/auth/request-session';
import { getRequestOnboardingComplete } from '@/server/profile/request-onboarding';

/** `fallback` shows while the device reads its local data state (spec 16). */
export async function SessionGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const session = await getRequestSession();
  if (!session) {
    const path = safeNext((await headers()).get(ORIGINAL_PATH_HEADER)) ?? '/today';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (!(await getRequestOnboardingComplete(session.user.id))) redirect('/onboarding');
  return (
    <CurrentUserProvider userId={session.user.id} fallback={fallback}>
      {children}
    </CurrentUserProvider>
  );
}
