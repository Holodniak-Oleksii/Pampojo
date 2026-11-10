'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/StatusPill';
import { useIsOnline } from '@/hooks/useIsOnline';
import type { Section } from '../constants';
import { useSectionLabels } from '../useSectionLabels';

export interface TopBarProps {
  section: Section | null;
}

export function TopBar({ section }: TopBarProps) {
  const { t } = useTranslation();
  const labels = useSectionLabels();
  const online = useIsOnline();

  return (
    <header className="sticky top-0 z-20 bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 w-full max-w-[960px] items-center gap-3 px-4 lg:px-6">
        <Link
          href="/today"
          aria-label={t('Pampojo, Today')}
          className="-ml-1.5 flex size-11 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <Image src="/brand/pampojo-icon.svg" alt="" width={32} height={32} className="size-8" />
        </Link>
        <p className="min-w-0 truncate text-base font-semibold">
          {section ? labels[section] : null}
        </p>
        <StatusPill status={online ? 'online' : 'offline'} className="ml-auto shrink-0" />
      </div>
    </header>
  );
}
