export const PART_OF_DAY = {
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING: 'evening',
} as const;

export type PartOfDay = (typeof PART_OF_DAY)[keyof typeof PART_OF_DAY];

/** Local-clock part of day: 05–11 morning, 12–17 afternoon, otherwise evening. */
export function partOfDay(date: Date): PartOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return PART_OF_DAY.MORNING;
  if (hour >= 12 && hour < 18) return PART_OF_DAY.AFTERNOON;
  return PART_OF_DAY.EVENING;
}
