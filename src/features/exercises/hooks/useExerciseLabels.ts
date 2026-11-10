import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EQUIPMENT,
  LATERALITY,
  MECHANIC,
  MOVEMENT_PATTERN,
  MUSCLE_GROUP,
  TRACKING_TYPE,
  type Difficulty,
  type Equipment,
  type Laterality,
  type Mechanic,
  type MovementPattern,
  type MuscleGroup,
  type TrackingType,
} from '@/constants/exercise';

export interface ExerciseLabels {
  muscle: Record<MuscleGroup, string>;
  equipment: Record<Equipment, string>;
  pattern: Record<MovementPattern, string>;
  mechanic: Record<Mechanic, string>;
  laterality: Record<Laterality, string>;
  tracking: Record<TrackingType, string>;
  level: Record<Difficulty, string>;
}

export function useExerciseLabels(): ExerciseLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      muscle: {
        [MUSCLE_GROUP.CHEST]: t('Chest'),
        [MUSCLE_GROUP.SHOULDERS]: t('Shoulders'),
        [MUSCLE_GROUP.TRICEPS]: t('Triceps'),
        [MUSCLE_GROUP.BICEPS]: t('Biceps'),
        [MUSCLE_GROUP.FOREARMS]: t('Forearms'),
        [MUSCLE_GROUP.LATS]: t('Lats'),
        [MUSCLE_GROUP.MIDDLE_BACK]: t('Middle back'),
        [MUSCLE_GROUP.TRAPS]: t('Traps'),
        [MUSCLE_GROUP.LOWER_BACK]: t('Lower back'),
        [MUSCLE_GROUP.ABDOMINALS]: t('Abs'),
        [MUSCLE_GROUP.GLUTES]: t('Glutes'),
        [MUSCLE_GROUP.QUADRICEPS]: t('Quads'),
        [MUSCLE_GROUP.HAMSTRINGS]: t('Hamstrings'),
        [MUSCLE_GROUP.ADDUCTORS]: t('Adductors'),
        [MUSCLE_GROUP.ABDUCTORS]: t('Abductors'),
        [MUSCLE_GROUP.CALVES]: t('Calves'),
        [MUSCLE_GROUP.NECK]: t('Neck'),
      },
      equipment: {
        [EQUIPMENT.BARBELL]: t('Barbell'),
        [EQUIPMENT.EZ_BAR]: t('EZ bar'),
        [EQUIPMENT.DUMBBELL]: t('Dumbbell'),
        [EQUIPMENT.KETTLEBELL]: t('Kettlebell'),
        [EQUIPMENT.CABLE]: t('Cable'),
        [EQUIPMENT.MACHINE]: t('Machine'),
        [EQUIPMENT.BODYWEIGHT]: t('Bodyweight'),
        [EQUIPMENT.BAND]: t('Band'),
        [EQUIPMENT.OTHER]: t('Other'),
      },
      pattern: {
        [MOVEMENT_PATTERN.HORIZONTAL_PUSH]: t('Horizontal push'),
        [MOVEMENT_PATTERN.VERTICAL_PUSH]: t('Vertical push'),
        [MOVEMENT_PATTERN.HORIZONTAL_PULL]: t('Horizontal pull'),
        [MOVEMENT_PATTERN.VERTICAL_PULL]: t('Vertical pull'),
        [MOVEMENT_PATTERN.SQUAT]: t('Squat'),
        [MOVEMENT_PATTERN.HINGE]: t('Hinge'),
        [MOVEMENT_PATTERN.LUNGE]: t('Lunge'),
        [MOVEMENT_PATTERN.CARRY]: t('Carry'),
        [MOVEMENT_PATTERN.CORE]: t('Core'),
        [MOVEMENT_PATTERN.ISOLATION]: t('Isolation', { context: 'pattern' }),
      },
      mechanic: {
        [MECHANIC.COMPOUND]: t('Compound'),
        [MECHANIC.ISOLATION]: t('Isolation', { context: 'mechanic' }),
      },
      laterality: {
        [LATERALITY.BILATERAL]: t('Both sides'),
        [LATERALITY.UNILATERAL]: t('One side at a time'),
      },
      tracking: {
        [TRACKING_TYPE.WEIGHT_REPS]: t('Weight × reps'),
        [TRACKING_TYPE.REPS]: t('Reps'),
        [TRACKING_TYPE.TIME]: t('Time'),
        [TRACKING_TYPE.DISTANCE]: t('Distance'),
      },
      level: { 1: t('Beginner'), 2: t('Intermediate'), 3: t('Advanced') },
    }),
    [t],
  );
}
