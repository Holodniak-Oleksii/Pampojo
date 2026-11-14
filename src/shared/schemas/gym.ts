import { z } from 'zod';
import { GYM_EQUIPMENT, GYM_EQUIPMENT_KEYS } from '@/constants/gym';
import { enumOf } from './utils';

export const gymEquipmentSchema = enumOf(GYM_EQUIPMENT);

/** Unique, in GYM_EQUIPMENT_KEYS order, so equal selections are stored and compared alike. */
export const gymEquipmentListSchema = z
  .array(gymEquipmentSchema)
  .max(GYM_EQUIPMENT_KEYS.length * 2)
  .transform((items) => GYM_EQUIPMENT_KEYS.filter((key) => items.includes(key)));

export const putGymInputSchema = z.object({ equipment: gymEquipmentListSchema }).strict();

export const gymSchema = z.object({
  equipment: z.array(gymEquipmentSchema),
  updatedAt: z.string(),
});

/** Exercise requirements: every group must be met, any item inside a group meets it. */
export const gymRequirementsSchema = z
  .array(
    z
      .array(gymEquipmentSchema)
      .min(1)
      .max(GYM_EQUIPMENT_KEYS.length)
      .transform((group) => [...new Set(group)]),
  )
  .max(GYM_EQUIPMENT_KEYS.length);

export type Gym = z.infer<typeof gymSchema>;
export type PutGymInput = z.input<typeof putGymInputSchema>;
export type ParsedPutGymInput = z.output<typeof putGymInputSchema>;
export type GymRequirements = z.output<typeof gymRequirementsSchema>;
