import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { LogOutButton } from '@/features/auth/LogOutButton';
import { getI18n } from '@/i18n/server';
import { getRequestSession } from '@/server/auth/request-session';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t('Pampojo') };
}

async function SignedInSummary() {
  const { t } = await getI18n();
  const session = await getRequestSession();
  return (
    <p className="text-lg">{t('Signed in as {{email}}', { email: session?.user.email ?? '' })}</p>
  );
}

// Placeholder until spec 05 builds the real Today screen.
export default async function TodayPage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto flex w-full max-w-[600px] flex-col gap-6 px-4 py-10 md:px-6">
      <PageHeader title={t("You're signed in")} />
      <Suspense fallback={null}>
        <SignedInSummary />
      </Suspense>
      <LogOutButton />
    </main>
  );
}
