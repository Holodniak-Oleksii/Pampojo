import { describe, expect, it } from 'vitest';
import { mergeMock } from '../mocks';

interface Sample {
  name: string;
  meta: { sets: number; reps: number };
  tags: string[];
}

const base: Sample = { name: 'Push Day', meta: { sets: 3, reps: 10 }, tags: ['chest', 'triceps'] };

describe('mergeMock', () => {
  it('returns the base when there is no override', () => {
    expect(mergeMock(base)).toEqual(base);
  });

  it('deep-merges nested objects', () => {
    expect(mergeMock(base, { meta: { reps: 8 } })).toEqual({ ...base, meta: { sets: 3, reps: 8 } });
  });

  it('replaces arrays instead of merging them', () => {
    expect(mergeMock(base, { tags: ['back'] }).tags).toEqual(['back']);
  });
});
