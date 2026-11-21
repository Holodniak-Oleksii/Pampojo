'use client';

import { Check, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/components/ui/button';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { useOptionalLocalDb, type LocalSession, type LocalSetLog } from '@/services/local-db';
import type { PampojoDb } from '@/services/local-db/db';
import { useHasUnsynced } from '@/services/sync';
import { formatElapsed, summaryOf, type SummaryResult } from '../utils';
import { NewRecords } from './NewRecords';

function useResultText() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (count: number, result: SummaryResult | null) => {
    if (!result) return String(count);
    const number = (value: number) => formatNumber(locale, value, { maximumFractionDigits: 2 });
    switch (result.kind) {
      case 'weight':
        return t('{{sets}} × {{value}}', {
          sets: count,
          value: t('{{value}} kg', { value: number(result.value) }),
        });
      case 'duration':
        return t('{{sets}} × {{value}}', {
          sets: count,
          value: t('{{value}} s', { value: result.value }),
        });
      case 'distance':
        return t('{{sets}} × {{value}}', {
          sets: count,
          value:
            result.value >= 1000
              ? t('{{value}} km', { value: number(result.value / 1000) })
              : t('{{value}} m', { value: result.value }),
        });
      case 'reps':
        return t('{{sets}} × {{value}}', { sets: count, value: result.value });
    }
  };
}

/** Shows while the outbox still holds the session or one of its sets (spec 17). */
function UnsyncedLine({ db, ids }: { db: PampojoDb; ids: string[] }) {
  const { t } = useTranslation();
  if (!useHasUnsynced(db, ids)) return null;
  return (
    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      {t('Saved on this device. Will sync when online.')}
    </p>
  );
}

export function SessionSummary({
  session,
  setLogs,
}: {
  session: LocalSession;
  setLogs: LocalSetLog[];
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const db = useOptionalLocalDb();
  const resultText = useResultText();
  const summary = summaryOf(session, setLogs);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(session.finishedAt ?? session.startedAt));
  const stats = [
    { label: t('Duration'), value: formatElapsed(summary.durationSec) },
    {
      label: t('Volume'),
      value: t('{{value}} kg', {
        value: formatNumber(locale, summary.volumeKg, { maximumFractionDigits: 2 }),
      }),
    },
    { label: t('Sets'), value: String(summary.sets) },
    { label: t('Exercises'), value: String(summary.exercises) },
  ];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-6 px-4 pt-12 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:gap-7 lg:pt-[88px] lg:pb-12">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:gap-[22px]">
        <span
          aria-hidden="true"
          className="mt-1.5 ml-1.5 flex size-[34px] shrink-0 rotate-45 items-center justify-center rounded-[5px] bg-accent lg:mx-1.5 lg:mt-0 lg:size-10 lg:rounded-md"
        >
          <Check strokeWidth={3} className="size-5 -rotate-45 text-accent-foreground" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[30px] leading-tight font-extrabold lg:text-4xl">
            {t('Workout finished')}
          </h1>
          <span className="text-muted-foreground">
            {t('{{name}}, {{date}}', { name: session.workoutSnapshot.name, date })}
          </span>
          {db ? <UnsyncedLine db={db} ids={[session.id, ...setLogs.map((set) => set.id)]} /> : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-[18px] border-y border-border py-[18px] tabular-nums lg:grid-cols-4 lg:py-[22px]">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl font-extrabold lg:text-[28px]">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <NewRecords session={session} />

      <ul className="-mt-2 tabular-nums">
        {summary.rows.map((row) => (
          <li
            key={row.entryId}
            className="flex min-h-[52px] items-center gap-3 border-b border-border last:border-b-0"
          >
            <span className="flex-1 font-bold">{row.name}</span>
            <span className="font-semibold text-muted-foreground">
              {resultText(row.count, row.result)}
            </span>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-4 bottom-[max(1.625rem,env(safe-area-inset-bottom))] lg:static">
        <Link
          href="/today"
          className={cn(buttonVariants({ size: 'md' }), 'w-full lg:w-auto lg:px-10')}
        >
          {t('Done')}
        </Link>
      </div>
    </main>
  );
}
