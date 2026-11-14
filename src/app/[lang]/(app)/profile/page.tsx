import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileSkeleton, ProfileView } from '@/features/profile';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { findGym } from '@/server/gym/service';
import { findProfile } from '@/server/profile/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Profile | Pampojo') } };
}

async function ProfileContent() {
  // Next.js renders this page in parallel with the (app) gate, so a user the gate is redirecting can
  // reach it without a profile; redirect too instead of throwing, which would log a server error.
  const session = await getRequestSession();
  if (!session) return null;
  const [profile, gym] = await Promise.all([
    findProfile(session.user.id),
    findGym(session.user.id),
  ]);
  if (!profile) redirect('/onboarding');
  return <ProfileView initialProfile={profile} initialGym={gym} />;
}

export default function ProfilePage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
