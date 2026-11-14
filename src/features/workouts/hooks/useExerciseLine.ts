import { useTranslation } from 'react-i18next';
import { useExerciseLabels } from '@/features/exercises/hooks/useExerciseLabels';
import type { ExerciseListItem } from '@/shared/schemas/exercise';

/** "Груди. Штанга": the main muscle and equipment of a catalog row. */
export function useExerciseLine() {
  const { t } = useTranslation();
  const labels = useExerciseLabels();
  return (item: ExerciseListItem) => {
    const muscle = item.primaryMuscles[0];
    const equipment = item.equipment[0];
    if (!muscle) return equipment ? labels.equipment[equipment] : '';
    if (!equipment) return labels.muscle[muscle];
    return t('{{muscle}}. {{equipment}}', {
      muscle: labels.muscle[muscle],
      equipment: labels.equipment[equipment],
    });
  };
}
