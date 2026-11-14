import { GYM_EQUIPMENT_KEYS, type GymEquipment } from '@/constants/gym';

/** One requirement group as text; alternatives read "Dumbbells or Kettlebells". */
export function formatRequirementGroup(
  group: readonly GymEquipment[],
  labels: Record<GymEquipment, string>,
  or: string,
): string {
  return group.map((item) => labels[item]).join(` ${or} `);
}

/** Keeps a selection unique and in display order, so equal selections compare equal. */
export function canonical(items: Iterable<GymEquipment>): GymEquipment[] {
  const set = new Set(items);
  return GYM_EQUIPMENT_KEYS.filter((key) => set.has(key));
}

export function sameEquipment(a: readonly GymEquipment[], b: readonly GymEquipment[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
