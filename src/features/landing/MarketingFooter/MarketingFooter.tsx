import Image from 'next/image';
import Link from 'next/link';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { getI18n } from '@/i18n/server';

export async function MarketingFooter() {
  const { t } = await getI18n();
  const columns = [
    {
      title: t('Product'),
      links: [
        { href: '/#features', label: t('Features') },
        { href: '/#how-it-works', label: t('How it works') },
        { href: '/#faq', label: t('FAQ') },
      ],
    },
    {
      title: t('Legal'),
      links: [
        { href: '/privacy', label: t('Privacy') },
        { href: '/terms', label: t('Terms') },
      ],
    },
  ];

  return (
    <footer data-section="footer" className="border-t border-border-strong">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-4 py-10 md:grid-cols-[1.5fr_1fr_1fr_auto] md:px-6">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <Link href="/" aria-label={t('Pampojo home')} className="w-fit">
            <Image
              src="/brand/pampojo-wordmark.svg"
              alt=""
              width={148}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('A workout log that works without a signal')}
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
            <h2 className="text-sm font-extrabold">{column.title}</h2>
            {column.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="w-fit text-sm text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 md:col-span-1 md:flex-col md:items-end md:justify-start">
          <LanguageSwitcher />
          <p className="text-sm text-muted-foreground">
            {t('© {{year}} Pampojo', { year: process.env.NEXT_PUBLIC_BUILD_YEAR })}
          </p>
        </div>
      </div>
    </footer>
  );
}
