// No value imports: the seed scripts run this file with plain Node, which does not resolve `@/`.
import type { ValueOf } from '@/types/utils';

export const GYM_EQUIPMENT_GROUP = {
  FREE_WEIGHTS: 'free_weights',
  BENCHES_RACKS: 'benches_racks',
  MACHINES: 'machines',
  CABLES: 'cables',
  OTHER: 'other',
} as const;

export type GymEquipmentGroup = ValueOf<typeof GYM_EQUIPMENT_GROUP>;

export const GYM_EQUIPMENT = {
  BARBELL: 'barbell',
  EZ_BAR: 'ez_bar',
  TRAP_BAR: 'trap_bar',
  DUMBBELLS: 'dumbbells',
  KETTLEBELLS: 'kettlebells',
  WEIGHT_PLATES: 'weight_plates',
  FLAT_BENCH: 'flat_bench',
  ADJUSTABLE_BENCH: 'adjustable_bench',
  DECLINE_BENCH: 'decline_bench',
  SQUAT_RACK: 'squat_rack',
  PREACHER_BENCH: 'preacher_bench',
  BACK_EXTENSION_BENCH: 'back_extension_bench',
  GLUTE_HAM_BENCH: 'glute_ham_bench',
  PULL_UP_BAR: 'pull_up_bar',
  DIP_STATION: 'dip_station',
  CAPTAINS_CHAIR: 'captains_chair',
  SMITH_MACHINE: 'smith_machine',
  CHEST_PRESS_MACHINE: 'chest_press_machine',
  SHOULDER_PRESS_MACHINE: 'shoulder_press_machine',
  PEC_DECK: 'pec_deck',
  ROW_MACHINE: 'row_machine',
  T_BAR_ROW: 't_bar_row',
  TRICEPS_MACHINE: 'triceps_machine',
  BICEPS_MACHINE: 'biceps_machine',
  AB_CRUNCH_MACHINE: 'ab_crunch_machine',
  LEG_PRESS: 'leg_press',
  HACK_SQUAT: 'hack_squat',
  LEG_EXTENSION: 'leg_extension',
  LEG_CURL: 'leg_curl',
  HIP_ABDUCTION_ADDUCTION: 'hip_abduction_adduction',
  CALF_RAISE_MACHINE: 'calf_raise_machine',
  REVERSE_HYPER: 'reverse_hyper',
  CABLE_STATION: 'cable_station',
  CABLE_CROSSOVER: 'cable_crossover',
  PULLDOWN_ROW_STATION: 'pulldown_row_station',
  RESISTANCE_BANDS: 'resistance_bands',
  AB_WHEEL: 'ab_wheel',
  STABILITY_BALL: 'stability_ball',
} as const;

export type GymEquipment = ValueOf<typeof GYM_EQUIPMENT>;

const E = GYM_EQUIPMENT;

/** Display order of groups and items. */
export const GYM_EQUIPMENT_GROUPS: readonly {
  group: GymEquipmentGroup;
  items: readonly GymEquipment[];
}[] = [
  {
    group: GYM_EQUIPMENT_GROUP.FREE_WEIGHTS,
    items: [E.BARBELL, E.EZ_BAR, E.TRAP_BAR, E.DUMBBELLS, E.KETTLEBELLS, E.WEIGHT_PLATES],
  },
  {
    group: GYM_EQUIPMENT_GROUP.BENCHES_RACKS,
    items: [
      E.FLAT_BENCH,
      E.ADJUSTABLE_BENCH,
      E.DECLINE_BENCH,
      E.SQUAT_RACK,
      E.PREACHER_BENCH,
      E.BACK_EXTENSION_BENCH,
      E.GLUTE_HAM_BENCH,
      E.PULL_UP_BAR,
      E.DIP_STATION,
      E.CAPTAINS_CHAIR,
    ],
  },
  {
    group: GYM_EQUIPMENT_GROUP.MACHINES,
    items: [
      E.SMITH_MACHINE,
      E.CHEST_PRESS_MACHINE,
      E.SHOULDER_PRESS_MACHINE,
      E.PEC_DECK,
      E.ROW_MACHINE,
      E.T_BAR_ROW,
      E.TRICEPS_MACHINE,
      E.BICEPS_MACHINE,
      E.AB_CRUNCH_MACHINE,
      E.LEG_PRESS,
      E.HACK_SQUAT,
      E.LEG_EXTENSION,
      E.LEG_CURL,
      E.HIP_ABDUCTION_ADDUCTION,
      E.CALF_RAISE_MACHINE,
      E.REVERSE_HYPER,
    ],
  },
  {
    group: GYM_EQUIPMENT_GROUP.CABLES,
    items: [E.CABLE_STATION, E.CABLE_CROSSOVER, E.PULLDOWN_ROW_STATION],
  },
  {
    group: GYM_EQUIPMENT_GROUP.OTHER,
    items: [E.RESISTANCE_BANDS, E.AB_WHEEL, E.STABILITY_BALL],
  },
];

export const GYM_EQUIPMENT_KEYS: readonly GymEquipment[] = GYM_EQUIPMENT_GROUPS.flatMap(
  (entry) => entry.items,
);

export const GYM_AUTOSAVE_DEBOUNCE_MS = 400;
