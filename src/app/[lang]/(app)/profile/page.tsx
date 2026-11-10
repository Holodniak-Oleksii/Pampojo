import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ProfileSkeleton, ProfileView } from '@/features/profile';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getProfile } from '@/server/profile/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Profile · Pampojo') } };
}

async function ProfileContent() {
  // The (app) gate already redirected users without a session or a profile; the page still scopes by the session itself.
  const session = await getRequestSession();
  if (!session) return null;
  return <ProfileView initialProfile={await getProfile(session.user.id)} />;
}

export default function ProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
