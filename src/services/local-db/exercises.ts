import { MUSCLE_GROUPS, type MuscleGroup } from '@/constants/exercise';
import type { CatalogFilters } from '@/features/exercises/types';
import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/search';
import { isAvailableInGym } from '@/shared/gym';
import type { Exercise, ExerciseListItem } from '@/shared/schemas/exercise';
import type { SyncExerciseTranslation } from '@/shared/schemas/sync';
import type { LocalExercise, PampojoDb } from './db';

/** The translation in `lang`, else the other one (own exercises may have only one). */
export function translationOf(
  exercise: Pick<LocalExercise, 'translations'>,
  lang: string,
): SyncExerciseTranslation | undefined {
  return exercise.translations.find((item) => item.locale === lang) ?? exercise.translations[0];
}

export function localExerciseName(exercise: Pick<LocalExercise, 'translations'>, lang: string) {
  return translationOf(exercise, lang)?.name ?? '';
}

function sectionOf(exercise: LocalExercise, muscles: readonly MuscleGroup[]): MuscleGroup | null {
  return (
    exercise.primaryMuscles.find((muscle) => muscles.length === 0 || muscles.includes(muscle)) ??
    null
  );
}

function toListItem(
  exercise: LocalExercise,
  lang: string,
  section: MuscleGroup | null,
): ExerciseListItem {
  return {
    id: exercise.id,
    name: localExerciseName(exercise, lang),
    primaryMuscles: exercise.primaryMuscles,
    equipment: exercise.equipment,
    thumbnailUrl: exercise.frames[0]?.thumbUrl ?? null,
    imageUrl: exercise.frames[0]?.fullUrl ?? null,
    frames: exercise.frames,
    section,
    isOwn: exercise.isOwn === 1,
    gymEquipment: exercise.gymEquipment,
    trackingType: exercise.trackingType,
    laterality: exercise.laterality,
  };
}

/** 0 for a name prefix, 1 for a name or alias match elsewhere; any translation counts, as on the server. */
function rankOf(exercise: LocalExercise, q: string): number | null {
  let best: number | null = null;
  for (const item of exercise.translations) {
    if (item.searchName.startsWith(q)) return 0;
    if (item.searchName.includes(q)) best = 1;
    else if (item.searchAliases.includes(q)) best ??= 2;
  }
  return best;
}

const byPopularity = (a: LocalExercise, b: LocalExercise) =>
  (b.popularity ?? -1) - (a.popularity ?? -1);

/**
 * The catalog over the local exercises, with the filters and the order of `GET /exercises`.
 * Offline search covers only these rows.
 */
export async function searchLocalExercises(
  db: PampojoDb,
  filters: CatalogFilters,
  lang: Locale,
  gymEquipment: readonly string[] | null,
): Promise<ExerciseListItem[]> {
  const q = normalizeSearch(filters.q);
  const rows = (await db.exercises.toArray()).filter(
    (exercise) =>
      exercise.deletedAt === null &&
      (filters.muscles.length === 0 ||
        exercise.primaryMuscles.some((muscle) => filters.muscles.includes(muscle))) &&
      (filters.equipment.length === 0 ||
        exercise.equipment.some((item) => filters.equipment.includes(item))) &&
      (!filters.mine || exercise.isOwn === 1) &&
      (!filters.gym ||
        gymEquipment === null ||
        isAvailableInGym(exercise.gymEquipment, gymEquipment)) &&
      (q === '' || rankOf(exercise, q) !== null),
  );
  const name = (exercise: LocalExercise) => localExerciseName(exercise, lang);
  const tie = (a: LocalExercise, b: LocalExercise) =>
    byPopularity(a, b) || name(a).localeCompare(name(b), lang) || a.id.localeCompare(b.id);
  if (q !== '') {
    return rows
      .sort((a, b) => (rankOf(a, q) ?? 9) - (rankOf(b, q) ?? 9) || tie(a, b))
      .map((exercise) => toListItem(exercise, lang, null));
  }
  const position = (exercise: LocalExercise) => {
    const section = sectionOf(exercise, filters.muscles);
    return section === null ? MUSCLE_GROUPS.length : MUSCLE_GROUPS.indexOf(section);
  };
  return rows
    .sort((a, b) => position(a) - position(b) || tie(a, b))
    .map((exercise) => toListItem(exercise, lang, sectionOf(exercise, filters.muscles)));
}

export function countLocalExercises(db: PampojoDb): Promise<number> {
  return db.exercises.filter((exercise) => exercise.deletedAt === null).count();
}

export async function getLocalExercise(
  db: PampojoDb,
  id: string,
  lang: string,
): Promise<Exercise | null> {
  const row = await db.exercises.get(id);
  if (!row || row.deletedAt) return null;
  const text = translationOf(row, lang);
  return {
    id: row.id,
    name: text?.name ?? '',
    aliases: text?.aliases ?? [],
    description: text?.description ?? '',
    instructions: text?.instructions ?? [],
    commonMistakes: text?.commonMistakes ?? [],
    primaryMuscles: row.primaryMuscles,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment,
    movementPattern: row.movementPattern,
    mechanic: row.mechanic,
    laterality: row.laterality,
    trackingType: row.trackingType,
    difficulty: row.difficulty,
    frames: row.frames,
    isOwn: row.isOwn === 1,
    sourceExerciseId: row.sourceExerciseId,
    gymEquipment: row.gymEquipment,
  };
}

/**
 * The local row for an own exercise that the REST API returned. The response has one locale, so
 * the other stored translation is kept.
 */
export async function putLocalExerciseResponse(
  db: PampojoDb,
  exercise: Exercise,
  lang: Locale,
): Promise<void> {
  const existing = await db.exercises.get(exercise.id);
  const translation: SyncExerciseTranslation = {
    locale: lang,
    name: exercise.name,
    aliases: exercise.aliases,
    description: exercise.description,
    instructions: exercise.instructions,
    commonMistakes: exercise.commonMistakes,
    searchName: normalizeSearch(exercise.name),
    searchAliases: exercise.aliases.map(normalizeSearch).join('\n'),
  };
  // An own exercise keeps its text in one language (spec 07), so a write replaces it.
  const translations = exercise.isOwn
    ? [translation]
    : [...(existing?.translations.filter((item) => item.locale !== lang) ?? []), translation];
  await db.exercises.put({
    id: exercise.id,
    isOwn: exercise.isOwn ? 1 : 0,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.equipment,
    movementPattern: exercise.movementPattern,
    mechanic: exercise.mechanic,
    laterality: exercise.laterality,
    trackingType: exercise.trackingType,
    difficulty: exercise.difficulty,
    popularity: existing?.popularity ?? null,
    frames: exercise.frames,
    gymEquipment: exercise.gymEquipment,
    sourceExerciseId: exercise.sourceExerciseId,
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    translations,
  });
}

export async function deleteLocalExercise(db: PampojoDb, id: string): Promise<void> {
  await db.exercises.delete(id);
}
