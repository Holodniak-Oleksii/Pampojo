import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getRequestOnboardingComplete } from '@/server/profile/request-onboarding';
import { getOnboardingPrefill } from '@/server/profile/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Welcome · Pampojo') } };
}

async function OnboardingGate() {
  const session = await getRequestSession();
  if (!session) redirect(`/login?next=${encodeURIComponent('/onboarding')}`);
  if (await getRequestOnboardingComplete(session.user.id)) redirect('/today');
  const { name } = await getOnboardingPrefill(session.user.id, session.user.name);
  return <OnboardingFlow userId={session.user.id} prefillName={name} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingGate />
    </Suspense>
  );
}
