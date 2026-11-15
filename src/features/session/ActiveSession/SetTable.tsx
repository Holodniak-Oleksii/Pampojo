'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SetRow, type SetRowField } from '@/components/SetRow';
import { Button } from '@/components/ui/button';
import { MAIN_METRIC, SESSION_SETS_MAX, type SetValueField } from '@/constants/session';
import { useLocale } from '@/i18n/client';
import type { LocalSetLog } from '@/services/local-db';
import { draftKey } from '@/services/local-db';
import type { LastPerformance, SessionExercise, SetValues } from '@/shared/schemas/session';
import { canLog, distanceInKm, firstOpenRow, logsOf, prefillRow } from '../utils';
import { fieldsOf, formatField, parseField } from './fields';

export interface SetTableProps {
  entry: SessionExercise;
  setLogs: readonly LocalSetLog[];
  drafts: Record<string, SetValues>;
  last: LastPerformance | null | undefined;
  onChange: (
    setIndex: number,
    log: LocalSetLog | undefined,
    values: SetValues,
    field: SetValueField,
  ) => void;
  onToggle: (setIndex: number, log: LocalSetLog | undefined, values: SetValues) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
}

function useLabels() {
  const { t } = useTranslation();
  return {
    header: {
      weightKg: t('Weight, kg'),
      reps: t('Reps'),
      durationSec: t('Duration, s'),
      distanceKm: t('Distance, km'),
      distanceM: t('Distance, m'),
    },
    aria: (field: SetValueField, n: number) => {
      switch (field) {
        case 'weightKg':
          return t('Set {{n}}, weight', { n });
        case 'reps':
          return t('Set {{n}}, reps', { n });
        case 'durationSec':
          return t('Set {{n}}, duration', { n });
        case 'distanceM':
          return t('Set {{n}}, distance', { n });
      }
    },
    check: (n: number, logged: boolean, ready: boolean, main: SetValueField) => {
      if (logged) return t('Set {{n}} done, uncheck', { n });
      if (ready) return t('Check set {{n}}', { n });
      if (main === 'durationSec') return t('Check set {{n}}: enter the duration first', { n });
      if (main === 'distanceM') return t('Check set {{n}}: enter the distance first', { n });
      return t('Check set {{n}}: enter the reps first', { n });
    },
  };
}

export function SetTable({
  entry,
  setLogs,
  drafts,
  last,
  onChange,
  onToggle,
  onAddSet,
  onRemoveSet,
}: SetTableProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const labels = useLabels();
  const trackingType = entry.exercise.trackingType;
  const fields = fieldsOf(trackingType);
  const main = MAIN_METRIC[trackingType];
  const km = distanceInKm(entry);
  const logged = logsOf(entry.id, setLogs);
  const current = firstOpenRow(entry, setLogs);

  const rows = Array.from({ length: entry.plannedSets }, (_, setIndex) => {
    const log = logged.get(setIndex);
    const values: SetValues = log
      ? {
          weightKg: log.weightKg,
          reps: log.reps,
          durationSec: log.durationSec,
          distanceM: log.distanceM,
        }
      : (drafts[draftKey(entry.id, setIndex)] ?? prefillRow(entry, setIndex, last));
    return { setIndex, log, values, ready: canLog(trackingType, values) };
  });
  const blocked = rows.some((row) => !row.log && !row.ready);
  const lastLogged = rows.at(-1)?.log !== undefined;

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr className="text-center text-[13px] text-muted-foreground">
            <th scope="col" className="w-10 pb-1.5 font-semibold">
              {t('Set')}
            </th>
            {fields.map((field) => (
              <th key={field} scope="col" className="px-1 pb-1.5 font-semibold">
                {field === 'distanceM'
                  ? km
                    ? labels.header.distanceKm
                    : labels.header.distanceM
                  : labels.header[field]}
              </th>
            ))}
            <th scope="col" className="w-[60px] pb-1.5">
              <span className="sr-only">{t('Done')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ setIndex, log, values, ready }) => {
            const rowFields: SetRowField[] = fields.map((field) => ({
              key: field,
              ariaLabel: labels.aria(field, setIndex + 1),
              value: values[field],
              decimal: field === 'weightKg' || (field === 'distanceM' && km),
              required: !log && field === main,
              format: (value) => formatField(field, value, km, locale),
              parse: (text) => parseField(field, text, km),
            }));
            return (
              <SetRow
                key={setIndex}
                number={setIndex + 1}
                fields={rowFields}
                logged={log !== undefined}
                current={setIndex === current}
                canLog={ready}
                checkLabel={labels.check(setIndex + 1, log !== undefined, ready, main)}
                onChange={(key, value) => {
                  const field = key as SetValueField;
                  onChange(setIndex, log, { ...values, [field]: value }, field);
                }}
                onToggle={() => onToggle(setIndex, log, values)}
              />
            );
          })}
        </tbody>
      </table>
      {blocked && trackingType === 'weight_reps' ? (
        <p className="-mt-1 text-sm text-muted-foreground">
          {t('Weight is optional. To check a set, enter the reps.')}
        </p>
      ) : null}
      <div className="flex gap-2">
        {/* Tighter padding than md so both uk labels fit the 358px row of a 390px phone. */}
        <Button
          variant="secondary"
          className="min-w-0 flex-1 gap-1.5 px-3 lg:flex-none lg:px-5"
          disabled={entry.plannedSets >= SESSION_SETS_MAX}
          onClick={onAddSet}
        >
          <Plus aria-hidden="true" />
          {t('Add set')}
        </Button>
        <Button
          variant="ghost"
          className="shrink-0 gap-1.5 px-3 text-muted-foreground"
          disabled={lastLogged || entry.plannedSets <= 1}
          onClick={onRemoveSet}
        >
          <Minus aria-hidden="true" />
          {t('Remove set')}
        </Button>
      </div>
    </div>
  );
}
