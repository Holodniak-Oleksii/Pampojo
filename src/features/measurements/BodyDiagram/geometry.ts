import { SEX, type Sex } from '@/constants/profile';
import { MEASUREMENT_TYPE, type GirthType } from '@/constants/measurement';

/** A ring in the 200×520 figure viewBox: its height `y` and the body edges `x1`–`x2`. */
export interface RingSpan {
  y: number;
  x1: number;
  x2: number;
}

export const DIAGRAM = {
  width: 358,
  height: 400,
  figureLeft: 102,
  figureWidth: 154,
  scaleX: 0.77,
  scaleY: 0.7692,
  leftEdge: 98,
  rightEdge: 260,
  knee: 8,
  chipGap: 42,
  chipHalf: 19,
} as const;

// "Right" is the user's right side, which the viewer sees on the left.
export const RINGS: Record<Sex, Record<GirthType, RingSpan>> = {
  [SEX.MALE]: {
    neck: { y: 76, x1: 82, x2: 118 },
    shoulders: { y: 160, x1: 22, x2: 178 },
    chest: { y: 182, x1: 56, x2: 144 },
    biceps_right: { y: 214, x1: 14, x2: 44 },
    biceps_left: { y: 214, x1: 156, x2: 186 },
    waist: { y: 250, x1: 52, x2: 148 },
    forearm_right: { y: 256, x1: 18, x2: 34 },
    forearm_left: { y: 256, x1: 166, x2: 183 },
    hips: { y: 286, x1: 48, x2: 152 },
    thigh_right: { y: 330, x1: 49, x2: 93 },
    thigh_left: { y: 330, x1: 107, x2: 152 },
    calf_right: { y: 398, x1: 52, x2: 85 },
    calf_left: { y: 398, x1: 115, x2: 148 },
  },
  [SEX.FEMALE]: {
    neck: { y: 74, x1: 85, x2: 115 },
    shoulders: { y: 152, x1: 35, x2: 164.5 },
    chest: { y: 174, x1: 62, x2: 137 },
    biceps_right: { y: 182, x1: 32, x2: 54 },
    biceps_left: { y: 182, x1: 146, x2: 168 },
    waist: { y: 196, x1: 65, x2: 135 },
    forearm_right: { y: 250, x1: 24, x2: 37.5 },
    forearm_left: { y: 250, x1: 162.5, x2: 175.6 },
    hips: { y: 270, x1: 46, x2: 154 },
    thigh_right: { y: 320, x1: 51, x2: 94 },
    thigh_left: { y: 320, x1: 105, x2: 149 },
    calf_right: { y: 394, x1: 57, x2: 88 },
    calf_left: { y: 394, x1: 112, x2: 143 },
  },
};

export const LEFT_COLUMN: readonly GirthType[] = [
  MEASUREMENT_TYPE.NECK,
  MEASUREMENT_TYPE.CHEST,
  MEASUREMENT_TYPE.BICEPS_RIGHT,
  MEASUREMENT_TYPE.FOREARM_RIGHT,
  MEASUREMENT_TYPE.HIPS,
  MEASUREMENT_TYPE.THIGH_RIGHT,
  MEASUREMENT_TYPE.CALF_RIGHT,
];

export const RIGHT_COLUMN: readonly GirthType[] = [
  MEASUREMENT_TYPE.SHOULDERS,
  MEASUREMENT_TYPE.BICEPS_LEFT,
  MEASUREMENT_TYPE.WAIST,
  MEASUREMENT_TYPE.FOREARM_LEFT,
  MEASUREMENT_TYPE.THIGH_LEFT,
  MEASUREMENT_TYPE.CALF_LEFT,
];

/**
 * Chip centres for ordered targets: each at least `gap` below the previous and inside `lo`–`hi`.
 * When the column overflows at the bottom, the chips move up from the end.
 */
export function relax(
  targets: readonly number[],
  gap: number = DIAGRAM.chipGap,
  lo: number = DIAGRAM.chipHalf,
  hi: number = DIAGRAM.height - DIAGRAM.chipHalf,
): number[] {
  const centres: number[] = [];
  let previous = -Infinity;
  for (const target of targets) {
    const centre = Math.max(target, previous + gap, lo);
    centres.push(centre);
    previous = centre;
  }
  for (let i = centres.length - 1; i >= 0; i -= 1) {
    const limit = i === centres.length - 1 ? hi : (centres[i + 1] ?? hi) - gap;
    centres[i] = Math.min(centres[i] ?? limit, limit);
  }
  return centres;
}

export interface Ring {
  type: GirthType;
  side: 'left' | 'right';
  /** Ring geometry in block pixels. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** The ring end where the leader ends. */
  endX: number;
  /** The chip centre. */
  chipY: number;
}

function ringsOf(sex: Sex, column: readonly GirthType[], side: Ring['side']): Ring[] {
  const spans = column.map((type) => ({ type, span: RINGS[sex][type] }));
  const chips = relax(spans.map(({ span }) => span.y * DIAGRAM.scaleY));
  return spans.map(({ type, span }, index) => {
    const left = DIAGRAM.figureLeft + span.x1 * DIAGRAM.scaleX;
    const right = DIAGRAM.figureLeft + span.x2 * DIAGRAM.scaleX;
    const rx = (right - left) / 2;
    return {
      type,
      side,
      cx: left + rx,
      cy: span.y * DIAGRAM.scaleY,
      rx,
      ry: Math.min(5.5, Math.max(2.2, rx * 0.13)),
      endX: side === 'left' ? left : right,
      chipY: chips[index] ?? 0,
    };
  });
}

export function diagramRings(sex: Sex): Ring[] {
  return [...ringsOf(sex, LEFT_COLUMN, 'left'), ...ringsOf(sex, RIGHT_COLUMN, 'right')];
}
