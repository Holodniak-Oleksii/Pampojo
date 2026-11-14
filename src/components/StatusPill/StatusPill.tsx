'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Diamond } from '../Diamond';

export interface StatusPillProps {
  status: 'online' | 'offline';
  pendingCount?: number;
  className?: string;
}

export function StatusPill({ status, pendingCount = 0, className }: StatusPillProps) {
  const { t } = useTranslation();
  const online = status === 'online';
  return (
    <span
      role="status"
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-semibold',
        online ? 'bg-card text-foreground' : 'bg-foreground text-card',
        className,
      )}
    >
      {online ? <Diamond tone="success" /> : <Diamond tone="accent" variant="outline" />}
      <span>{online ? t('Online') : t('Offline')}</span>
      {pendingCount > 0 ? (
        <>
          <span
            aria-hidden="true"
            data-testid="pending-badge"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] bg-accent px-1.5 text-xs font-extrabold text-foreground"
          >
            {pendingCount}
          </span>
          <span className="sr-only">
            {t('{{count}} change waiting to sync', { count: pendingCount })}
          </span>
        </>
      ) : null}
    </span>
  );
}
