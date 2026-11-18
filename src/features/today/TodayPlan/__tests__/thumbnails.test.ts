import { describe, expect, it } from 'vitest';
import { thumbnailSlots, tilesThatFit } from '../thumbnails';

describe('Today thumbnails (spec 14 AC17)', () => {
  it('fits 5 tiles in the 310px mobile row and 11 in a 650px desktop row', () => {
    expect(tilesThatFit(310)).toBe(5);
    expect(tilesThatFit(650)).toBe(11);
    expect(tilesThatFit(0)).toBe(1);
  });

  it('covers the last image with "+N" when the row is full', () => {
    expect(thumbnailSlots(8, 8, 5)).toEqual({ shown: 4, more: 4, covers: true });
    expect(thumbnailSlots(12, 30, 11)).toEqual({ shown: 10, more: 20, covers: true });
  });

  it('adds a tile of its own when the photos run out first', () => {
    expect(thumbnailSlots(1, 6, 5)).toEqual({ shown: 1, more: 5, covers: false });
  });

  it('shows no "+N" when every exercise has a tile', () => {
    expect(thumbnailSlots(3, 3, 5)).toEqual({ shown: 3, more: 0, covers: false });
    expect(thumbnailSlots(5, 5, 5)).toEqual({ shown: 5, more: 0, covers: false });
  });
});
