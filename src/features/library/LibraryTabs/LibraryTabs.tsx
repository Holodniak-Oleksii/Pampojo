'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { OnlineLinkButton } from '@/features/exercises/OnlineLinkButton';
import { cn } from '@/lib/utils';

export function LibraryTabs() {
  const { t } = useTranslation();
  // The last segment is the same with or without the hidden locale prefix.
  const current = usePathname().split('/').filter(Boolean).at(-1);
  const tabs = [
    { segment: 'workouts', href: '/library/workouts', label: t('Workouts') },
    { segment: 'exercises', href: '/library/exercises', label: t('Exercises') },
  ];

  return (
    <div className="flex items-start justify-between gap-3">
      <nav aria-label={t('Library')}>
        <ul className="inline-flex gap-1 rounded-[5px] bg-card p-[3px] ring-1 ring-border ring-inset">
          {tabs.map((tab) => {
            const active = tab.segment === current;
            return (
              <li key={tab.segment}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center rounded-[3px] px-5 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                    active ? 'bg-primary text-primary-foreground' : 'hover:bg-background',
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* On desktop the exercise catalog column has its own labelled button. */}
      {current === 'exercises' ? (
        <OnlineLinkButton
          href="/library/exercises/new"
          variant="accent"
          size="icon"
          ariaLabel={t('Create exercise')}
          className="lg:hidden"
        >
          <Plus aria-hidden="true" className="size-6" />
        </OnlineLinkButton>
      ) : null}
      {current === 'workouts' ? (
        <>
          <OnlineLinkButton
            href="/library/workouts/new"
            variant="accent"
            size="icon"
            ariaLabel={t('Create workout')}
            className="lg:hidden"
          >
            <Plus aria-hidden="true" className="size-6" />
          </OnlineLinkButton>
          <OnlineLinkButton href="/library/workouts/new" size="sm" className="max-lg:hidden">
            <Plus aria-hidden="true" />
            {t('Create workout')}
          </OnlineLinkButton>
        </>
      ) : null}
    </div>
  );
}
