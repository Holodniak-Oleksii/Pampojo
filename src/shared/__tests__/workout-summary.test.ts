import { describe, expect, it } from 'vitest';
import { summarizeWorkout } from '../workout-summary';

const item = (
  exerciseId: string,
  primaryMuscles: string[],
  thumbnailUrl: string | null = null,
) => ({
  exerciseId,
  primaryMuscles,
  thumbnailUrl,
});

describe('summarizeWorkout', () => {
  it('counts every entry but lists each exercise once', () => {
    const summary = summarizeWorkout([item('a', ['chest'], 't1'), item('a', ['chest'], 't1')]);
    expect(summary.exerciseCount).toBe(2);
    expect(summary.exerciseIds).toEqual(['a']);
    expect(summary.thumbnailUrls).toEqual(['t1']);
  });

  it('keeps at most 12 thumbnails and skips missing ones', () => {
    const items = Array.from({ length: 14 }, (_, index) =>
      item(`e${index}`, [], index === 0 ? null : `t${index}`),
    );
    const summary = summarizeWorkout(items);
    expect(summary.thumbnailUrls).toHaveLength(12);
    expect(summary.thumbnailUrls[0]).toBe('t1');
  });

  it('returns the 3 most frequent muscles, ties in first-seen order', () => {
    const summary = summarizeWorkout([
      item('a', ['triceps']),
      item('b', ['chest', 'shoulders']),
      item('c', ['chest', 'unknown']),
      item('d', ['biceps']),
    ]);
    expect(summary.primaryMuscles).toEqual(['chest', 'triceps', 'shoulders']);
  });
});
