import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TodaySkeleton } from '@/features/today/TodaySkeleton';
import { TodayView } from '@/features/today/TodayView';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { getProfile } from '@/server/profile/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t('Today · Pampojo') } };
}

async function TodayContent() {
  // The (app) gate already redirected users without a session or a profile; the page still scopes by the session itself.
  const session = await getRequestSession();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  return (
    <TodayView
      displayName={profile.displayName}
      avatarEmoji={profile.avatarEmoji}
      avatarColor={profile.avatarColor}
    />
  );
}

export default function TodayPage() {
  return (
    <div className="flex w-full max-w-[600px] flex-col gap-6">
      <Suspense fallback={<TodaySkeleton />}>
        <TodayContent />
      </Suspense>
    </div>
  );
}
