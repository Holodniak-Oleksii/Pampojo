'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Diamond } from '@/components/Diamond';
import { PlayDiamond } from '@/components/PlayDiamond';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, type Section } from '../constants';
import { useSectionLabels } from '../useSectionLabels';

const RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export interface SidebarNavProps {
  section: Section | null;
  onStart: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function SidebarNav({ section, onStart }: SidebarNavProps) {
  const { t } = useTranslation();
  const labels = useSectionLabels();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-border bg-background px-4 py-6 lg:flex">
      <Link
        href="/today"
        aria-label={t('Pampojo, Today')}
        className={cn('self-start rounded-md px-2', RING)}
      >
        <Image
          src="/brand/pampojo-wordmark.svg"
          alt=""
          width={148}
          height={32}
          priority
          className="h-8 w-auto"
        />
      </Link>
      <Button size="lg" className="w-full" onClick={onStart}>
        <PlayDiamond />
        {t('Start workout')}
      </Button>
      <nav aria-label={t('Main navigation')}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.section === section;
            const Icon = item.icon;
            return (
              <li key={item.section}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-md px-3 text-base transition-colors motion-reduce:transition-none',
                    active ? 'bg-card font-bold' : 'text-foreground/80 hover:bg-card',
                    RING,
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" />
                  {labels[item.section]}
                  {active ? <Diamond tone="accent" className="ml-auto" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
