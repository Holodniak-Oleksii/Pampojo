'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';

export function MobileMenu() {
  const { t } = useTranslation();
  const anchors = [
    { href: '#features', label: t('Features') },
    { href: '#how-it-works', label: t('How it works') },
    { href: '#faq', label: t('FAQ') },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="icon" aria-label={t('Open menu')} className="lg:hidden">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        closeLabel={t('Close')}
        className="flex flex-col gap-6 bg-background p-6"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-xl font-extrabold">{t('Menu')}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          {anchors.map((anchor) => (
            <SheetClose key={anchor.href} asChild>
              <a
                href={anchor.href}
                className="-mx-3 rounded-2xl px-3 py-3 text-lg font-semibold hover:bg-accent-soft"
              >
                {anchor.label}
              </a>
            </SheetClose>
          ))}
        </nav>
        <div className="flex flex-col gap-3">
          <Button asChild variant="secondary">
            <Link href="/login">{t('Log in')}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{t('Get started')}</Link>
          </Button>
        </div>
        <LanguageSwitcher />
      </SheetContent>
    </Sheet>
  );
}
