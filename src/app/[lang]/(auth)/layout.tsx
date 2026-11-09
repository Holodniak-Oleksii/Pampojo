import Image from 'next/image';
import Link from 'next/link';
import { AuthBrandPanel } from '@/features/auth/AuthBrandPanel';
import { getI18n } from '@/i18n/server';

export default async function AuthLayout({ children }: LayoutProps<'/[lang]'>) {
  const { t } = await getI18n();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 md:px-6">
      <header className="flex h-16 items-center lg:hidden">
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
      </header>
      {/* Desktop fits one screen: the row is pinned to the viewport and the brand panel clips its
          mockup, down to a height where the card itself would no longer fit. */}
      <div className="grid flex-1 gap-12 pb-10 lg:h-dvh lg:min-h-[640px] lg:flex-none lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:py-10 lg:[@media(max-height:760px)]:py-6">
        <AuthBrandPanel />
        {/* Safe centering: a card taller than the screen starts at the top and scrolls, never clips. */}
        <main className="flex flex-col pt-2 lg:justify-center-safe lg:pt-0">
          <div className="mx-auto w-full max-w-[440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
