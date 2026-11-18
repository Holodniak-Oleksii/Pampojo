'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RecordIcon } from '@/components/BrandIcons';
import { RECORD_TYPE } from '@/constants/progress';
import { dayMonth } from '@/features/plan';
import { sessionHref } from '@/features/session/hooks/useStartSession';
import { formatNumber } from '@/i18n/format';
import { useLocale } from '@/i18n/client';
import type { ProgressRecord } from '@/shared/schemas/progress';
import { formatRecordValue, recordName } from '../utils';

export function RecordList({ records }: { records: readonly ProgressRecord[] }) {
  const { t } = useTranslation();
  const locale = useLocale();
  if (records.length === 0) return null;

  const dateLine = (record: ProgressRecord) => {
    const date = dayMonth(locale, record.date);
    if (record.type !== RECORD_TYPE.BEST_E1RM || record.weightKg === null || record.reps === null) {
      return date;
    }
    return t('{{date}}, {{weight}} × {{reps}}', {
      date,
      weight: t('{{value}} kg', {
        value: formatNumber(locale, record.weightKg, { maximumFractionDigits: 2 }),
      }),
      reps: record.reps,
    });
  };

  return (
    <section aria-labelledby="progress-records" className="flex flex-col gap-2">
      <h2 id="progress-records" className="mt-1.5 text-base font-bold">
        {t('Records')}
      </h2>
      <ul className="divide-y divide-border rounded-lg bg-card">
        {records.map((record) => (
          <li key={record.type}>
            <Link
              href={sessionHref(record.sessionId)}
              className="flex min-h-16 items-center gap-3 py-2.5 pr-2 pl-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RecordIcon className="text-accent" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-bold">{recordName(t, record.type)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {dateLine(record)}
                </span>
              </span>
              <span className="text-right text-[15px] font-semibold tabular-nums">
                {formatRecordValue(t, locale, record)}
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
