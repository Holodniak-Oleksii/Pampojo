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
            'flex size-12 items-center justify-center rounded-md transition-colors motion-reduce:transition-none',
            active ? 'text-accent' : 'text-primary-foreground',
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
      className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] text-primary-foreground lg:hidden"
    >
      {/* Chamfered panel in three pieces, so the corners keep their shape at any width. */}
      <div aria-hidden="true" className="absolute inset-0 flex flex-col text-primary">
        <div className="flex h-6">
          <PanelCorner />
          <div className="flex-1 bg-primary" />
          <PanelCorner className="-scale-x-100" />
        </div>
        <div className="flex-1 bg-primary" />
      </div>
      <ul className="relative mx-auto grid h-[76px] max-w-[600px] grid-cols-5 items-center px-2">
        {BEFORE_START.map(renderLink)}
        <li className="flex justify-center">
          <button
            type="button"
            aria-label={t('Start workout')}
            onClick={onStart}
            className={cn(
              '-mt-11 flex size-[60px] rotate-45 items-center justify-center rounded-lg border-[5px] border-background bg-accent text-foreground transition-transform duration-120 active:scale-[0.92]',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <Play aria-hidden="true" className="size-[26px] -rotate-45 fill-current" />
          </button>
        </li>
        {AFTER_START.map(renderLink)}
      </ul>
    </nav>
  );
}

function PanelCorner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6 shrink-0', className)} fill="currentColor">
      <path d="M0 24 Q0 20 2.8 17.2 L17.2 2.8 Q20 0 24 0 L24 24 Z" />
    </svg>
  );
}
