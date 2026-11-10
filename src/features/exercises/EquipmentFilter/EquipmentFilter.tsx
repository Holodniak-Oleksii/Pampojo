'use client';

import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EQUIPMENT_LIST, type Equipment } from '@/constants/exercise';
import { useExerciseLabels } from '../hooks/useExerciseLabels';

export interface EquipmentFilterProps {
  selected: readonly Equipment[];
  onChange: (equipment: Equipment[]) => void;
  /** `menu`: a button with a checkbox menu (mobile); `list`: a fieldset of checkboxes (desktop). */
  variant: 'menu' | 'list';
}

function toggle(selected: readonly Equipment[], item: Equipment, checked: boolean): Equipment[] {
  const next = new Set(selected);
  if (checked) next.add(item);
  else next.delete(item);
  return EQUIPMENT_LIST.filter((value) => next.has(value));
}

export function EquipmentFilter({ selected, onChange, variant }: EquipmentFilterProps) {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  const id = useId();

  if (variant === 'list') {
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-2 font-semibold">{t('Equipment')}</legend>
        {EQUIPMENT_LIST.map((item) => (
          // The label sits next to the checkbox: wrapping the Radix button in its own label
          // would deliver every click twice and leave the state unchanged.
          <div
            key={item}
            className="flex min-h-11 items-center gap-3 rounded-2xl px-2 hover:bg-card"
          >
            <Checkbox
              id={`${id}-${item}`}
              checked={selected.includes(item)}
              onCheckedChange={(checked) => onChange(toggle(selected, item, checked === true))}
            />
            <label
              htmlFor={`${id}-${item}`}
              className="flex min-h-11 flex-1 cursor-pointer items-center"
            >
              {labels.equipment[item]}
            </label>
          </div>
        ))}
      </fieldset>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="self-start">
          {selected.length > 0
            ? t('Equipment ({{count}})', { count: selected.length })
            : t('Equipment')}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {EQUIPMENT_LIST.map((item) => (
          <DropdownMenuCheckboxItem
            key={item}
            checked={selected.includes(item)}
            onCheckedChange={(checked) => onChange(toggle(selected, item, checked))}
            // Keep the menu open so several items can be picked in one go.
            onSelect={(event) => event.preventDefault()}
            className="min-h-11"
          >
            {labels.equipment[item]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
