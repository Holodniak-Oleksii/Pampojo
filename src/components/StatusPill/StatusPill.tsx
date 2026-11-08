'use client';

import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface StatusPillProps {
  status: 'online' | 'offline';
  pendingCount?: number;
  className?: string;
}

export function StatusPill({ status, pendingCount = 0, className }: StatusPillProps) {
  const { t } = useTranslation();
  return (
    <span
      role="status"
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-sm font-semibold shadow-soft',
        className,
      )}
    >
      {status === 'online' ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-success" />
      ) : (
        <WifiOff aria-hidden="true" className="size-4" />
      )}
      <span>{status === 'online' ? t('Online') : t('Offline')}</span>
      {pendingCount > 0 ? (
        <>
          <span aria-hidden="true">· {t('{{count}} pending', { count: pendingCount })}</span>
          <span className="sr-only">
            {t('{{count}} change waiting to sync', { count: pendingCount })}
          </span>
        </>
      ) : null}
    </span>
  );
}
