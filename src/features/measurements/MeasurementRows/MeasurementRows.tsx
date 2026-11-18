'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { MEASUREMENT_TYPE, type MeasurementType } from '@/constants/measurement';
import type { UnitSystem } from '@/constants/profile';
import { useLocale } from '@/i18n/client';
import type { Measurement } from '@/shared/schemas/measurement';
import { ChangeText } from '../ChangeText';
import { changeOf, formatMeasurement, measurementHref, typeName } from '../utils';

const ROW_TYPES = [MEASUREMENT_TYPE.WEIGHT, MEASUREMENT_TYPE.BODY_FAT_PCT] as const;

export function MeasurementRows({
  grouped,
  units,
}: {
  grouped: ReadonlyMap<MeasurementType, readonly Measurement[]>;
  units: UnitSystem;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <ul className="divide-y divide-border rounded-lg bg-card pl-4">
      {ROW_TYPES.map((type) => {
        const list = grouped.get(type) ?? [];
        const latest = list[0];
        const change = changeOf(list);
        return (
          <li key={type}>
            <Link
              href={measurementHref(type)}
              className="flex min-h-14 items-center gap-3 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="flex-1 text-[15px] font-bold">{typeName(t, type)}</span>
              {change === null ? null : <ChangeText type={type} change={change} units={units} />}
              <span className="text-[15px] font-semibold tabular-nums">
                {latest ? formatMeasurement(t, locale, type, latest.value, units) : '—'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
