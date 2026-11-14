import type { Equipment, MuscleGroup } from '@/constants/exercise';

export interface CatalogFilters {
  q: string;
  muscles: MuscleGroup[];
  equipment: Equipment[];
  /** Own exercises only (the "Mine" chip). */
  mine: boolean;
  /** Only exercises the saved gym allows (the "Available in my gym" chip). */
  gym: boolean;
}
