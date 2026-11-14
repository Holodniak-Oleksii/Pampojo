import type { TFunction } from 'i18next';
import { LATERALITY, type TrackingType } from '@/constants/exercise';
import {
  TARGET_DEFAULTS,
  TARGET_FIELD_KEYS,
  TARGET_FIELDS,
  type TargetField,
  type WorkoutTargets,
} from '@/constants/workout';
import type { Locale } from '@/i18n/config';
import { formatNumber } from '@/i18n/format';
import type { ExerciseListItem } from '@/shared/schemas/exercise';
import type {
  PutWorkoutInput,
  Workout,
  WorkoutExercise,
  WorkoutExerciseSummary,
} from '@/shared/schemas/workout';
import type { Draft, DraftItem } from './types';

const EMPTY_TARGETS: WorkoutTargets = {
  targetSets: null,
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeightKg: null,
  targetDurationSec: null,
  targetDistanceM: null,
};

export function defaultTargets(trackingType: TrackingType): WorkoutTargets {
  return { ...EMPTY_TARGETS, ...TARGET_DEFAULTS[trackingType] };
}

export function allows(trackingType: TrackingType, field: TargetField): boolean {
  const fields: readonly TargetField[] = TARGET_FIELDS[trackingType];
  return fields.includes(field);
}

export function summaryOf(item: ExerciseListItem): WorkoutExerciseSummary {
  return {
    id: item.id,
    name: item.name,
    trackingType: item.trackingType,
    laterality: item.laterality,
    primaryMuscles: item.primaryMuscles,
    thumbnailUrl: item.thumbnailUrl,
    isOwn: item.isOwn,
  };
}

export function newDraftItem(exercise: WorkoutExerciseSummary): DraftItem {
  return {
    key: crypto.randomUUID(),
    exercise,
    targets: defaultTargets(exercise.trackingType),
    notes: '',
  };
}

function toDraftItem(item: WorkoutExercise): DraftItem {
  return {
    key: item.id,
    exercise: item.exercise,
    targets: {
      targetSets: item.targetSets,
      targetRepsMin: item.targetRepsMin,
      targetRepsMax: item.targetRepsMax,
      targetWeightKg: item.targetWeightKg,
      targetDurationSec: item.targetDurationSec,
      targetDistanceM: item.targetDistanceM,
    },
    notes: item.notes ?? '',
  };
}

export function draftFromWorkout(workout: Workout): Draft {
  return {
    id: workout.id,
    name: workout.name,
    description: workout.description ?? '',
    items: workout.exercises.map(toDraftItem),
  };
}

export function emptyDraft(id: string): Draft {
  return { id, name: '', description: '', items: [] };
}

export function canSave(draft: Draft): boolean {
  return draft.name.trim() !== '' && draft.items.length > 0;
}

/** Only the targets the tracking type allows are sent; the rest go as null. */
export function toPutInput(draft: Draft): PutWorkoutInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    exercises: draft.items.map((item) => {
      const targets = { ...EMPTY_TARGETS };
      for (const field of TARGET_FIELDS[item.exercise.trackingType]) {
        for (const key of TARGET_FIELD_KEYS[field]) targets[key] = item.targets[key];
      }
      // One reps value means an exact number; the server needs both or neither.
      targets.targetRepsMin ??= targets.targetRepsMax;
      targets.targetRepsMax ??= targets.targetRepsMin;
      return {
        id: item.key,
        exerciseId: item.exercise.id,
        ...targets,
        notes: item.notes.trim() || null,
      };
    }),
  };
}

/** A copy with a new id and new row ids, named "<name> (copy)" within the name limit. */
export function duplicateInput(workout: Workout, t: TFunction, nameMax: number): PutWorkoutInput {
  const suffix = t('{{name}} (copy)', { name: '' });
  const name = t('{{name}} (copy)', { name: workout.name.slice(0, nameMax - suffix.length) });
  const draft = draftFromWorkout(workout);
  return toPutInput({
    ...draft,
    name,
    items: draft.items.map((item) => ({ ...item, key: crypto.randomUUID() })),
  });
}

/** "3 × 8–12, 80 кг", "2 × 30 с на кожну сторону", "3 підходи"; empty when there is no target. */
export function targetSummary(item: DraftItem, t: TFunction, locale: Locale): string {
  const { trackingType, laterality } = item.exercise;
  const targets = item.targets;
  const num = (value: number) => formatNumber(locale, value, { maximumFractionDigits: 2 });
  const sets = allows(trackingType, 'sets') ? targets.targetSets : null;

  let work: string | null = null;
  if (allows(trackingType, 'reps') && targets.targetRepsMin !== null) {
    work =
      targets.targetRepsMax === null || targets.targetRepsMax === targets.targetRepsMin
        ? num(targets.targetRepsMin)
        : `${num(targets.targetRepsMin)}–${num(targets.targetRepsMax)}`;
    if (sets === null) work = t('{{reps}} reps', { reps: work });
  } else if (allows(trackingType, 'duration') && targets.targetDurationSec !== null) {
    work = t('{{value}} s', { value: num(targets.targetDurationSec) });
  } else if (allows(trackingType, 'distance') && targets.targetDistanceM !== null) {
    work =
      targets.targetDistanceM >= 1000
        ? t('{{value}} km', { value: num(targets.targetDistanceM / 1000) })
        : t('{{value}} m', { value: num(targets.targetDistanceM) });
  }

  let main: string | null = null;
  if (sets !== null && work !== null)
    main = t('{{sets}} × {{reps}}', { sets: num(sets), reps: work });
  else if (work !== null) main = work;
  else if (sets !== null) main = t('{{count}} sets', { count: sets });

  const perSide =
    laterality === LATERALITY.UNILATERAL &&
    (targets.targetRepsMin !== null || targets.targetDurationSec !== null) &&
    (allows(trackingType, 'reps') || allows(trackingType, 'duration'));
  if (main !== null && perSide) main = `${main} ${t('per side')}`;

  const weight =
    allows(trackingType, 'weight') && targets.targetWeightKg !== null
      ? t('{{value}} kg', { value: num(targets.targetWeightKg) })
      : null;

  return [main, weight].filter((part): part is string => part !== null).join(', ');
}
