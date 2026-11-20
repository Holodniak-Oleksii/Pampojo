import type { LocalExercise } from '@/services/local-db';

/** A local catalog row with an English and a Ukrainian translation. */
export function localExercise(
  name: string,
  override: Partial<LocalExercise> & { uk?: string; aliases?: string[] } = {},
): LocalExercise {
  const { uk, aliases = [], ...rest } = override;
  const text = (locale: 'en' | 'uk', value: string) => ({
    locale,
    name: value,
    aliases,
    description: '',
    instructions: [],
    commonMistakes: [],
    searchName: value.toLowerCase(),
    searchAliases: aliases.map((item) => item.toLowerCase()).join('\n'),
  });
  return {
    id: crypto.randomUUID(),
    isOwn: 0,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    equipment: ['barbell'],
    movementPattern: null,
    mechanic: null,
    laterality: null,
    trackingType: 'weight_reps',
    difficulty: null,
    popularity: 50,
    frames: [],
    gymEquipment: [],
    sourceExerciseId: null,
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    translations: [text('en', name), text('uk', uk ?? name)],
    ...rest,
  };
}
