'use client';

import { Play } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SECTION, type NavItem, type Section } from '../constants';
import { useSectionLabels } from '../useSectionLabels';

const RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

const BAR_ITEMS = NAV_ITEMS.filter((item) => item.section !== SECTION.TODAY);
const BEFORE_START = BAR_ITEMS.slice(0, 2);
const AFTER_START = BAR_ITEMS.slice(2);

export interface BottomNavProps {
  section: Section | null;
  onStart: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function BottomNav({ section, onStart }: BottomNavProps) {
  const { t } = useTranslation();
  const labels = useSectionLabels();

  const renderLink = (item: NavItem) => {
    const active = item.section === section;
    const Icon = item.icon;
    return (
      <li key={item.section} className="flex justify-center">
        <Link
          href={item.href}
          aria-label={labels[item.section]}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex size-12 items-center justify-center rounded-2xl transition-colors motion-reduce:transition-none',
            active ? 'text-accent' : 'text-primary-foreground/70 hover:text-primary-foreground',
            RING,
          )}
        >
          <Icon aria-hidden="true" className="size-6" />
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t('Main navigation')}
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-primary pb-[max(0.5rem,env(safe-area-inset-bottom))] text-primary-foreground lg:hidden"
    >
      <ul className="mx-auto grid h-[76px] max-w-[600px] grid-cols-5 items-center px-2">
        {BEFORE_START.map(renderLink)}
        <li className="flex justify-center">
          <button
            type="button"
            aria-label={t('Start workout')}
            onClick={onStart}
            className={cn(
              'flex size-14 items-center justify-center rounded-2xl bg-accent text-foreground',
              RING,
            )}
          >
            <Play aria-hidden="true" className="size-6 fill-current" />
          </button>
        </li>
        {AFTER_START.map(renderLink)}
      </ul>
    </nav>
  );
}
