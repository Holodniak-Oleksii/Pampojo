import type { Viewport } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { LogOutButton } from '@/features/auth/LogOutButton';
import { getI18n } from '@/i18n/server';

// Without viewport-fit=cover iOS reports every env(safe-area-inset-*) as 0, and the sticky footer
// sits under the home indicator.
export const viewport: Viewport = { viewportFit: 'cover' };

export default async function OnboardingLayout({ children }: LayoutProps<'/[lang]/onboarding'>) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pt-[env(safe-area-inset-top)] md:px-6">
      <header className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={t('Pampojo home')} className="rounded-md">
          <BrandMark
            variant="wordmark"
            alt=""
            width={148}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <LogOutButton variant="ghost" size="sm" />
      </header>
      <main className="flex flex-1 flex-col lg:items-center lg:justify-center lg:pb-16">
        <div className="flex w-full flex-1 flex-col pt-2 lg:max-w-[480px] lg:flex-none lg:rounded-lg lg:bg-card lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
