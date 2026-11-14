import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getI18n } from '@/i18n/server';
import { MobileMenu } from '../MobileMenu';

export async function MarketingHeader() {
  const { t } = await getI18n();
  const anchors = [
    { href: '#features', label: t('Features') },
    { href: '#how-it-works', label: t('How it works') },
    { href: '#faq', label: t('FAQ') },
  ];

  return (
    <header data-section="header" className="sticky top-0 z-40 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label={t('Pampojo home')} className="flex items-center rounded-md">
          <Image
            src="/brand/pampojo-wordmark.svg"
            alt=""
            width={148}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav aria-label={t('Menu')} className="hidden items-center gap-1 lg:flex">
          {anchors.map((anchor) => (
            <Button key={anchor.href} asChild variant="ghost" size="sm">
              <a href={anchor.href}>{anchor.label}</a>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t('Log in')}</Link>
          </Button>
          <Button asChild size="sm" className="hidden lg:inline-flex">
            <Link href="/signup">{t('Get started')}</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
