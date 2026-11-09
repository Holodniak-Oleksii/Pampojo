import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/features/auth/AuthCardSkeleton';
import { getI18n } from '@/i18n/server';
import { AuthGate } from '../auth-gate';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Sign up · Pampojo') } };
}

export default function SignupPage({ searchParams }: PageProps<'/[lang]/signup'>) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthGate mode="signup" searchParams={searchParams} />
    </Suspense>
  );
}
