import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ORIGINAL_PATH_HEADER } from '@/constants/routing';
import { safeNext } from '@/features/auth/utils';
import { getRequestSession } from '@/server/auth/request-session';

export async function SessionGate({ children }: { children: ReactNode }) {
  if (!(await getRequestSession())) {
    const path = safeNext((await headers()).get(ORIGINAL_PATH_HEADER)) ?? '/today';
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return <>{children}</>;
}
