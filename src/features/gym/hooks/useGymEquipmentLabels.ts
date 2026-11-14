import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GYM_EQUIPMENT,
  GYM_EQUIPMENT_GROUP,
  type GymEquipment,
  type GymEquipmentGroup,
} from '@/constants/gym';

export interface GymEquipmentLabels {
  group: Record<GymEquipmentGroup, string>;
  item: Record<GymEquipment, string>;
}

export function useGymEquipmentLabels(): GymEquipmentLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      group: {
        [GYM_EQUIPMENT_GROUP.FREE_WEIGHTS]: t('Free weights'),
        [GYM_EQUIPMENT_GROUP.BENCHES_RACKS]: t('Benches and racks'),
        [GYM_EQUIPMENT_GROUP.MACHINES]: t('Machines'),
        [GYM_EQUIPMENT_GROUP.CABLES]: t('Cables'),
        [GYM_EQUIPMENT_GROUP.OTHER]: t('Other'),
      },
      item: {
        [GYM_EQUIPMENT.BARBELL]: t('Barbell'),
        [GYM_EQUIPMENT.EZ_BAR]: t('EZ bar'),
        [GYM_EQUIPMENT.TRAP_BAR]: t('Trap bar'),
        [GYM_EQUIPMENT.DUMBBELLS]: t('Dumbbells'),
        [GYM_EQUIPMENT.KETTLEBELLS]: t('Kettlebells'),
        [GYM_EQUIPMENT.WEIGHT_PLATES]: t('Weight plates'),
        [GYM_EQUIPMENT.FLAT_BENCH]: t('Flat bench'),
        [GYM_EQUIPMENT.ADJUSTABLE_BENCH]: t('Adjustable bench'),
        [GYM_EQUIPMENT.DECLINE_BENCH]: t('Decline bench'),
        [GYM_EQUIPMENT.SQUAT_RACK]: t('Squat rack'),
        [GYM_EQUIPMENT.PREACHER_BENCH]: t('Preacher bench'),
        [GYM_EQUIPMENT.BACK_EXTENSION_BENCH]: t('Back extension bench'),
        [GYM_EQUIPMENT.GLUTE_HAM_BENCH]: t('Glute-ham bench'),
        [GYM_EQUIPMENT.PULL_UP_BAR]: t('Pull-up bar'),
        [GYM_EQUIPMENT.DIP_STATION]: t('Dip station'),
        [GYM_EQUIPMENT.CAPTAINS_CHAIR]: t("Captain's chair"),
        [GYM_EQUIPMENT.SMITH_MACHINE]: t('Smith machine'),
        [GYM_EQUIPMENT.CHEST_PRESS_MACHINE]: t('Chest press'),
        [GYM_EQUIPMENT.SHOULDER_PRESS_MACHINE]: t('Shoulder press'),
        [GYM_EQUIPMENT.PEC_DECK]: t('Pec deck'),
        [GYM_EQUIPMENT.ROW_MACHINE]: t('Row machine'),
        [GYM_EQUIPMENT.T_BAR_ROW]: t('T-bar row'),
        [GYM_EQUIPMENT.TRICEPS_MACHINE]: t('Triceps machine'),
        [GYM_EQUIPMENT.BICEPS_MACHINE]: t('Biceps machine'),
        [GYM_EQUIPMENT.AB_CRUNCH_MACHINE]: t('Ab crunch machine'),
        [GYM_EQUIPMENT.LEG_PRESS]: t('Leg press'),
        [GYM_EQUIPMENT.HACK_SQUAT]: t('Hack squat'),
        [GYM_EQUIPMENT.LEG_EXTENSION]: t('Leg extension'),
        [GYM_EQUIPMENT.LEG_CURL]: t('Leg curl'),
        [GYM_EQUIPMENT.HIP_ABDUCTION_ADDUCTION]: t('Hip abduction / adduction'),
        [GYM_EQUIPMENT.CALF_RAISE_MACHINE]: t('Calf raise machine'),
        [GYM_EQUIPMENT.REVERSE_HYPER]: t('Reverse hyper'),
        [GYM_EQUIPMENT.CABLE_STATION]: t('Cable station'),
        [GYM_EQUIPMENT.CABLE_CROSSOVER]: t('Cable crossover'),
        [GYM_EQUIPMENT.PULLDOWN_ROW_STATION]: t('Pulldown and row station'),
        [GYM_EQUIPMENT.RESISTANCE_BANDS]: t('Resistance bands'),
        [GYM_EQUIPMENT.AB_WHEEL]: t('Ab wheel'),
        [GYM_EQUIPMENT.STABILITY_BALL]: t('Stability ball'),
      },
    }),
    [t],
  );
}
