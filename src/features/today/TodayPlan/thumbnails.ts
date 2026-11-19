export const THUMB_TILE = 52;
export const THUMB_GAP = 6;

/** How many tiles fit in a row of `width` px. */
export function tilesThatFit(width: number): number {
  return Math.max(1, Math.floor((width + THUMB_GAP) / (THUMB_TILE + THUMB_GAP)));
}

/**
 * The images to show and the "+N" tile. With room left, "+N" is a tile of its own; with a full row,
 * it covers the last image. N counts every exercise without its own visible thumbnail.
 */
export function thumbnailSlots(
  photos: number,
  count: number,
  fit: number,
): { shown: number; more: number; covers: boolean } {
  const own = Math.min(photos, fit);
  if (count <= own) return { shown: own, more: 0, covers: false };
  const covers = own === fit;
  const shown = covers ? fit - 1 : own;
  return { shown, more: count - shown, covers };
}
