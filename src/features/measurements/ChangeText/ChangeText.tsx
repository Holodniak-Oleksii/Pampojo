'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MeasurementType } from '@/constants/measurement';
import type { UnitSystem } from '@/constants/profile';
import { useLocale } from '@/i18n/client';
import { formatChange } from '../utils';

/** A signed change in a neutral colour: a good direction depends on the user's goal. */
export function ChangeText({
  type,
  change,
  units,
}: {
  type: MeasurementType;
  change: number;
  units: UnitSystem;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : null;
  return (
    <span className="flex items-center gap-0.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      {formatChange(t, locale, type, change, units)}
    </span>
  );
}
