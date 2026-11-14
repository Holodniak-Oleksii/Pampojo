import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';

/** "Barbell · Flat bench" with alternatives as "Dumbbells or Kettlebells"; `nothing` for `[]`. */
export function formatRequirements(
  requirements: readonly (readonly GymEquipment[])[],
  labels: Record<GymEquipment, string>,
  words: { or: string; nothing: string },
): string {
  if (requirements.length === 0) return words.nothing;
  return requirements
    .map((group) => group.map((item) => labels[item]).join(` ${words.or} `))
    .join(' · ');
}

/** Keeps a selection unique and in display order, so equal selections compare equal. */
export function canonical(items: Iterable<GymEquipment>): GymEquipment[] {
  const set = new Set(items);
  return GYM_EQUIPMENT_KEYS.filter((key) => set.has(key));
}

export function sameEquipment(a: readonly GymEquipment[], b: readonly GymEquipment[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
