import type { Metadata } from 'next';
import { LandingPage } from '@/features/landing/LandingPage';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const title = t('Pampojo — workout tracker that works offline');
  const description = t(
    'Build workouts, plan them in a calendar and log every set in the gym, even without a signal.',
  );
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: 'website', siteName: 'Pampojo' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default function HomePage() {
  return <LandingPage />;
}
