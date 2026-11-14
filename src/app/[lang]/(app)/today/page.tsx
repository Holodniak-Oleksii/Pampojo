import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { TodaySkeleton } from '@/features/today/TodaySkeleton';
import { TodayView } from '@/features/today/TodayView';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { findGym } from '@/server/gym/service';
import { findProfile } from '@/server/profile/service';
import { hasWorkouts } from '@/server/workouts/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Today | Pampojo') } };
}

async function TodayContent() {
  // Next.js renders this page in parallel with the (app) gate, so a user the gate is redirecting can
  // reach it without a profile; redirect too instead of throwing, which would log a server error.
  const session = await getRequestSession();
  if (!session) return null;
  const [profile, gym, workouts] = await Promise.all([
    findProfile(session.user.id),
    findGym(session.user.id),
    hasWorkouts(session.user.id),
  ]);
  if (!profile) redirect('/onboarding');
  return <TodayView displayName={profile.displayName} initialGym={gym} hasWorkouts={workouts} />;
}

export default function TodayPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent />
      </Suspense>
    </div>
  );
}
