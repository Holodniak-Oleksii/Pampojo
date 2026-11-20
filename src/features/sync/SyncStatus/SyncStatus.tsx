'use client';

import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '@/components/StatusPill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useIsOnline } from '@/hooks/useIsOnline';
import { cn } from '@/lib/utils';
import { useRequiredLocalDb } from '@/services/local-db';
import { useOutboxCount, useSyncMeta } from '@/services/sync';
import { SyncPanel } from './SyncPanel';

/** The top bar pill. It opens the sync view: a bottom sheet on phones, a popover on desktop. */
export function SyncStatus({ className }: { className?: string }) {
  const { t } = useTranslation();
  const db = useRequiredLocalDb();
  const online = useIsOnline();
  const desktop = useIsDesktop();
  const pendingCount = useOutboxCount(db);
  const meta = useSyncMeta(db);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const state = online ? t('Online') : t('Offline');
  const label = [
    state,
    pendingCount > 0 ? t('{{count}} change waiting to sync', { count: pendingCount }) : null,
    t('Open sync'),
  ]
    .filter(Boolean)
    .join('. ');

  const trigger = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <StatusPill status={online ? 'online' : 'offline'} pendingCount={pendingCount} />
    </button>
  );
  const panel = (
    <SyncPanel db={db} online={online} pendingCount={pendingCount} meta={meta} desktop={desktop} />
  );

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          aria-labelledby={titleId}
          className="flex w-[360px] flex-col gap-4 p-5"
          // The first control can be the blocked "Sync now", whose tooltip would cover the text.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <h2
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-extrabold outline-none"
          >
            {t('Sync')}
          </h2>
          {panel}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        closeLabel={t('Close')}
        aria-describedby={undefined}
        className="max-h-dvh overflow-y-auto rounded-t-xl pb-[max(2rem,env(safe-area-inset-bottom))] motion-reduce:animate-none"
      >
        <SheetHeader className="px-4 pt-6">
          <SheetTitle className="text-xl font-extrabold">{t('Sync')}</SheetTitle>
        </SheetHeader>
        <div className="px-4">{panel}</div>
      </SheetContent>
    </Sheet>
  );
}
