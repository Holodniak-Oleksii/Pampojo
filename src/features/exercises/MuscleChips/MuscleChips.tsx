'use client';

import { useTranslation } from 'react-i18next';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/constants/exercise';
import { cn } from '@/lib/utils';
import { useExerciseLabels } from '../hooks/useExerciseLabels';

export interface MuscleChipsProps {
  selected: readonly MuscleGroup[];
  onToggle: (muscle: MuscleGroup) => void;
  className?: string;
}

/** One row that scrolls sideways on mobile; chips wrap from `lg` up. */
export function MuscleChips({ selected, onToggle, className }: MuscleChipsProps) {
  const { t } = useTranslation();
  const labels = useExerciseLabels();

  return (
    <div
      role="group"
      aria-label={t('Muscles')}
      // The negative margin lets the row scroll edge to edge inside the 16px page gutter.
      className={cn(
        '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0',
        className,
      )}
    >
      {MUSCLE_GROUPS.map((muscle) => {
        const active = selected.includes(muscle);
        return (
          <button
            key={muscle}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(muscle)}
            className={cn(
              'min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-foreground shadow-soft hover:bg-accent-soft',
            )}
          >
            {labels.muscle[muscle]}
          </button>
        );
      })}
    </div>
  );
}
