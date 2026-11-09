import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/features/auth/AuthCardSkeleton';
import { getI18n } from '@/i18n/server';
import { AuthGate } from '../auth-gate';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Log in · Pampojo') } };
}

export default function LoginPage({ searchParams }: PageProps<'/[lang]/login'>) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthGate mode="login" searchParams={searchParams} />
    </Suspense>
  );
}
