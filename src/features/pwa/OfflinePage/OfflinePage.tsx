import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';
import { cn } from '@/lib/utils';
import { BRAND_ASSETS } from '../brand-assets';
import { RetryButton } from './RetryButton';

/** Served by the service worker for app pages that were never opened online; no app shell. */
export async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 items-center px-4 lg:px-8">
        {/* Plain images: next/image would request /_next/image, which is not cached offline. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img
          src={BRAND_ASSETS.wordmark}
          alt="Pampojo"
          width={132}
          height={32}
          className="dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
        <img
          src={BRAND_ASSETS.wordmarkDark}
          alt="Pampojo"
          width={132}
          height={32}
          className="hidden dark:block"
        />
      </header>
      <main className="grid flex-1 place-items-center p-4 pb-24">
        <section
          aria-labelledby="offline-title"
          className="flex w-full max-w-[440px] flex-col items-center gap-3.5 rounded-lg bg-card px-6 pt-8 pb-6 text-center"
        >
          <span aria-hidden="true" className="flex h-16 items-center">
            <span className="size-10 rotate-45 rounded-md border-[2.5px] border-dashed border-planned" />
          </span>
          <h1 id="offline-title" className="text-2xl font-extrabold">
            {t('No connection')}
          </h1>
          <p className="max-w-[32ch] text-muted-foreground">
            {t('This page is not saved on this device yet. Open it online at least once.')}
          </p>
          <RetryButton />
          <Link href="/today" className={cn(buttonVariants({ variant: 'ghost' }), 'w-full')}>
            {t('Go to Today', { context: 'offline' })}
          </Link>
        </section>
      </main>
    </div>
  );
}
