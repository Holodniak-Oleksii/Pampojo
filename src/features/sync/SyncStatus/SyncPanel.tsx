'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { OnlineOnly } from '@/features/offline/OnlineOnly';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { PampojoDb, SyncMeta } from '@/services/local-db/db';
import { syncNow } from '@/services/sync';
import { formatSyncTime, rejectionReason } from '../utils';

const BUSY_HOLD_MS = 1000;
// "щойно" turns into a time after a minute, so the open view re-reads the clock.
const CLOCK_TICK_MS = 15_000;

export interface SyncPanelProps {
  db: PampojoDb;
  online: boolean;
  pendingCount: number;
  meta: SyncMeta | undefined;
  /** The popover says "on this device"; the phone sheet says "on this phone". */
  desktop: boolean;
}

function StateDiamond({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'size-2 rotate-45 rounded-[2px]',
        online ? 'bg-success' : 'border-[1.5px] border-accent',
      )}
    />
  );
}

export function SyncPanel({ db, online, pendingCount, meta, desktop }: SyncPanelProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const lastError = meta?.lastError ?? null;

  const sync = async () => {
    if (syncing) return;
    setSyncing(true);
    const result = await syncNow(db);
    if (result === 'busy') await new Promise((resolve) => setTimeout(resolve, BUSY_HOLD_MS));
    setSyncing(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('Status', { context: 'sync' })}</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <StateDiamond online={online} />
            {online ? t('Online') : t('Offline')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('Waiting to sync')}</dt>
          <dd className="font-semibold tabular-nums">
            {pendingCount > 0
              ? t('{{count}} changes', { count: pendingCount })
              : t('Everything is synced')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted-foreground">{t('Last synced')}</dt>
          <dd className="font-semibold tabular-nums">
            {formatSyncTime(t, locale, meta?.lastSyncAt ?? null, now)}
          </dd>
        </div>
      </dl>
      {online ? null : (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {desktop
            ? t(
                'Sets and measurements are saved on this device. They sync as soon as the network is back.',
              )
            : t(
                'Sets and measurements are saved on this phone. They sync as soon as the network is back.',
              )}
        </p>
      )}
      {lastError ? (
        <div role="note" className="flex gap-3 rounded-lg border border-border p-3.5">
          <span
            aria-hidden="true"
            className="mt-1.5 size-[9px] shrink-0 rotate-45 rounded-[2px] border-[1.5px] border-destructive"
          />
          <div className="flex flex-col gap-1">
            <span className="font-bold">{t('One change was not saved')}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {rejectionReason(t, lastError.code)} {formatSyncTime(t, locale, lastError.at, now)}.
            </span>
          </div>
        </div>
      ) : null}
      <OnlineOnly label={t('Sync now')} kind="label">
        <Button size="md" className="w-full" disabled={syncing} onClick={() => void sync()}>
          {online ? null : <WifiOff aria-hidden="true" />}
          {t('Sync now')}
        </Button>
      </OnlineOnly>
    </div>
  );
}
