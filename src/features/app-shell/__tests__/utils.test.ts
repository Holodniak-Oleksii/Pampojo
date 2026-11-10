import { describe, expect, it } from 'vitest';
import { sectionFromPathname } from '../utils';

describe('sectionFromPathname', () => {
  it.each([
    ['/today', 'today'],
    ['/calendar', 'calendar'],
    ['/library', 'library'],
    ['/library/exercises', 'library'],
    ['/progress', 'progress'],
    ['/profile', 'profile'],
    ['/profile/gym', 'profile'],
    ['/en/today', 'today'],
    ['/uk/library/workouts', 'library'],
  ])('maps %s to %s', (pathname, section) => {
    expect(sectionFromPathname(pathname)).toBe(section);
  });

  it.each(['/', '/en', '/settings', '/todayx'])('returns null for %s', (pathname) => {
    expect(sectionFromPathname(pathname)).toBeNull();
  });
});
