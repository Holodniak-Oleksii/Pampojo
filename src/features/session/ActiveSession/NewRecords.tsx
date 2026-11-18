'use client';

import { useTranslation } from 'react-i18next';
import { RecordIcon } from '@/components/BrandIcons';
import { formatRecordValue, recordName } from '@/features/progress';
import { useLocale } from '@/i18n/client';
import type { LocalSession } from '@/services/local-db';

/** Records this session beat, computed on this device at finish; hidden when there are none. */
export function NewRecords({ session }: { session: LocalSession }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const records = session.newRecords ?? [];
  if (records.length === 0) return null;
  const nameOf = (exerciseId: string) =>
    session.exercises.find((entry) => entry.exerciseId === exerciseId)?.exercise.name ?? '';

  return (
    <section aria-labelledby="new-records" className="flex flex-col gap-2">
      <h2 id="new-records" className="text-base font-bold">
        {t('New records')}
      </h2>
      <ul className="divide-y divide-border rounded-lg bg-card tabular-nums">
        {records.map((record) => (
          <li
            key={`${record.exerciseId}:${record.type}`}
            className="flex min-h-16 items-center gap-3 py-2.5 pr-3 pl-3.5"
          >
            <RecordIcon className="text-accent" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-bold">{nameOf(record.exerciseId)}</span>
              <span className="text-sm text-muted-foreground">{recordName(t, record.type)}</span>
            </span>
            <span className="text-[15px] font-semibold">
              {formatRecordValue(t, locale, record)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
