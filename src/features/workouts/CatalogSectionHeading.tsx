'use client';

import { Diamond } from '@/components/Diamond';
import { MUSCLE_FAMILY_OF, type MuscleGroup } from '@/constants/exercise';
import { useExerciseLabels } from '@/features/exercises/hooks/useExerciseLabels';

export function CatalogSectionHeading({ section }: { section: MuscleGroup }) {
  const labels = useExerciseLabels();
  return (
    <h3 className="mt-1 flex items-center gap-2.5 text-[17px] font-extrabold">
      <Diamond tone="muscle" family={MUSCLE_FAMILY_OF[section]} size="md" />
      {labels.muscle[section]}
    </h3>
  );
}
