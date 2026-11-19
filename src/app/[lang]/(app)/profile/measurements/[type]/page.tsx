import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { MeasurementHistory, typeName } from '@/features/measurements';
import { ProfileSkeleton } from '@/features/profile';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';
import { findProfile } from '@/server/profile/service';
import { measurementTypeSchema } from '@/shared/schemas/measurement';

type Props = PageProps<'/[lang]/profile/measurements/[type]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = await getI18n();
  const parsed = measurementTypeSchema.safeParse((await params).type);
  return {
    title: {
      absolute: parsed.success
        ? t('{{type}} | Pampojo', { type: typeName(t, parsed.data) })
        : t('Profile | Pampojo'),
    },
  };
}

async function HistoryContent({ params }: Pick<Props, 'params'>) {
  const parsed = measurementTypeSchema.safeParse((await params).type);
  if (!parsed.success) notFound();
  // The (app) gate already redirects users without a session or a profile; see profile/page.tsx.
  const session = await getRequestSession();
  if (!session) return null;
  const profile = await findProfile(session.user.id);
  if (!profile) redirect('/onboarding');
  return <MeasurementHistory type={parsed.data} initialProfile={profile} />;
}

export default function MeasurementHistoryPage({ params }: Props) {
  return (
    <div className="flex w-full flex-col gap-6">
      <Suspense fallback={<ProfileSkeleton />}>
        <HistoryContent params={params} />
      </Suspense>
    </div>
  );
}
