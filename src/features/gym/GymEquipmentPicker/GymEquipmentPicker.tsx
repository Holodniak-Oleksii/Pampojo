'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GYM_EQUIPMENT_GROUPS, type GymEquipment, type GymEquipmentGroup } from '@/constants/gym';
import { chipClass } from '@/features/exercises/MuscleChips';
import { cn } from '@/lib/utils';
import { GROUP_ICON } from '../constants';
import { useGymEquipmentLabels } from '../hooks/useGymEquipmentLabels';

export interface GymEquipmentPickerProps {
  selected: readonly GymEquipment[];
  onToggle: (item: GymEquipment) => void;
  /** Shows "Select all" / "Clear all" on each group header. */
  onSetGroup?: (group: GymEquipmentGroup, on: boolean) => void;
  disabled?: boolean;
  /** `auto`: two columns from lg; `single`: always one column (forms). */
  columns?: 'auto' | 'single';
  className?: string;
}

export function GymEquipmentPicker({
  selected,
  onToggle,
  onSetGroup,
  disabled,
  columns = 'auto',
  className,
}: GymEquipmentPickerProps) {
  const { t } = useTranslation();
  const labels = useGymEquipmentLabels();
  const id = useId();

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        // Columns instead of a grid, so a short group does not leave a gap beside a tall one.
        columns === 'auto' && 'lg:block lg:columns-2 lg:gap-4',
        className,
      )}
    >
      {GYM_EQUIPMENT_GROUPS.map(({ group, items }) => {
        const Icon = GROUP_ICON[group];
        const allOn = items.every((item) => selected.includes(item));
        const headingId = `${id}-${group}`;
        return (
          <section
            key={group}
            aria-labelledby={headingId}
            className={cn(
              'flex min-w-0 flex-col gap-3 rounded-lg bg-card p-4',
              columns === 'auto' && 'lg:mb-4 lg:break-inside-avoid',
            )}
          >
            <div className="flex min-h-11 items-center justify-between gap-3">
              <h2 id={headingId} className="flex items-center gap-2 text-lg font-extrabold">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                {labels.group[group]}
              </h2>
              {onSetGroup ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSetGroup(group, !allOn)}
                  className="min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {allOn ? t('Clear all') : t('Select all')}
                </button>
              ) : null}
            </div>
            <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
              {items.map((item) => {
                const on = selected.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled}
                    onClick={() => onToggle(item)}
                    className={cn(
                      chipClass(on),
                      // Long Ukrainian names wrap inside the chip instead of widening the page.
                      'inline-flex max-w-full items-center gap-1.5 text-left whitespace-normal disabled:opacity-50',
                      !on && 'bg-background',
                    )}
                  >
                    {on ? <Check aria-hidden="true" className="size-4 shrink-0" /> : null}
                    {labels.item[item]}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
