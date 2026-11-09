import { redirect } from 'next/navigation';
import { AuthCard } from '@/features/auth/AuthCard';
import { safeNext } from '@/features/auth/utils';
import { getRequestSession } from '@/server/auth/request-session';
import { isGoogleEnabled } from '@/server/auth/google';

interface AuthGateProps {
  mode: 'login' | 'signup';
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function AuthGate({ mode, searchParams }: AuthGateProps) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getRequestSession()) redirect(next ?? '/today');

  const error = typeof params.error === 'string' ? params.error : undefined;
  return (
    <AuthCard mode={mode} next={next} googleEnabled={isGoogleEnabled()} initialError={error} />
  );
}
