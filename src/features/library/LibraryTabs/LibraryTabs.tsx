'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
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
    <nav aria-label={t('Library')}>
      <ul className="inline-flex gap-1 rounded-full bg-card p-1 shadow-soft">
        {tabs.map((tab) => {
          const active = tab.segment === current;
          return (
            <li key={tab.segment}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-full px-5 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent-soft',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
