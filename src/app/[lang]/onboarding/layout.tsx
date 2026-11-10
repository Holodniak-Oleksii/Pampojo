import Image from 'next/image';
import Link from 'next/link';
import { LogOutButton } from '@/features/auth/LogOutButton';
import { getI18n } from '@/i18n/server';

export default async function OnboardingLayout({ children }: LayoutProps<'/[lang]/onboarding'>) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6">
      <header className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label={t('Pampojo home')} className="rounded-xl">
          <Image
            src="/brand/pampojo-wordmark.svg"
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
        <div className="flex w-full flex-1 flex-col pt-2 lg:max-w-[480px] lg:flex-none lg:rounded-[32px] lg:bg-card lg:p-8 lg:shadow-soft">
          {children}
        </div>
      </main>
    </div>
  );
}
