import type { Equipment, MuscleGroup } from '@/constants/exercise';

export interface CatalogFilters {
  q: string;
  muscles: MuscleGroup[];
  equipment: Equipment[];
}
