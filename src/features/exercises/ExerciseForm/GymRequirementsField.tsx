'use client';

import { X } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { GymEquipment } from '@/constants/gym';
import { GymEquipmentPicker } from '@/features/gym/GymEquipmentPicker';
import { useGymEquipmentLabels } from '@/features/gym/hooks/useGymEquipmentLabels';
import { formatRequirements } from '@/features/gym/utils';
import { chipClass } from '../MuscleChips';

interface GymRequirementsFieldProps {
  value: GymEquipment[][];
  onChange: (value: GymEquipment[][]) => void;
  disabled?: boolean;
}

/**
 * Each ticked item is its own required group. Alternatives groups come only from a duplicated
 * system exercise; they show as one chip that can be removed but not edited.
 */
export function GymRequirementsField({ value, onChange, disabled }: GymRequirementsFieldProps) {
  const { t } = useTranslation();
  const labels = useGymEquipmentLabels();
  const hintId = useId();
  const singles = value.flatMap((group) => (group.length === 1 && group[0] ? [group[0]] : []));
  const alternatives = value.filter((group) => group.length > 1);
  const words = { or: t('or'), nothing: t('Nothing special') };

  function toggle(item: GymEquipment) {
    onChange(
      singles.includes(item)
        ? value.filter((group) => !(group.length === 1 && group[0] === item))
        : [...value, [item]],
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={hintId}>
      <legend className="mb-1 font-semibold">{t('Gym equipment needed')}</legend>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t('Leave empty if it needs nothing special.')}
      </p>
      {alternatives.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {alternatives.map((group) => {
            const label = formatRequirements([group], labels.item, words);
            return (
              <li key={group.join('|')} className="max-w-full">
                <span
                  className={`${chipClass(true)} inline-flex max-w-full items-center gap-1 pr-1 whitespace-normal`}
                >
                  {label}
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t('Remove {{label}}', { label })}
                    onClick={() => onChange(value.filter((other) => other !== group))}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full outline-none hover:bg-primary-foreground/15 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <GymEquipmentPicker
        columns="single"
        selected={singles}
        onToggle={toggle}
        disabled={disabled}
      />
    </fieldset>
  );
}
