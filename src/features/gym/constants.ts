import { Bed, Cable, Cog, Dumbbell, Shapes, type LucideIcon } from 'lucide-react';
import { GYM_EQUIPMENT_GROUP, type GymEquipmentGroup } from '@/constants/gym';

export const GROUP_ICON: Record<GymEquipmentGroup, LucideIcon> = {
  [GYM_EQUIPMENT_GROUP.FREE_WEIGHTS]: Dumbbell,
  [GYM_EQUIPMENT_GROUP.BENCHES_RACKS]: Bed,
  [GYM_EQUIPMENT_GROUP.MACHINES]: Cog,
  [GYM_EQUIPMENT_GROUP.CABLES]: Cable,
  [GYM_EQUIPMENT_GROUP.OTHER]: Shapes,
};

export const GYM_PATH = '/profile/gym';
