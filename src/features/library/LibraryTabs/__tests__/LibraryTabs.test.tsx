import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePathname } from 'next/navigation';
import { render } from '@/test/render';
import { LibraryTabs } from '../LibraryTabs';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LibraryTabs', () => {
  it.each([
    ['/library/workouts', 'Workouts', 'Exercises'],
    ['/library/exercises', 'Exercises', 'Workouts'],
    ['/en/library/exercises', 'Exercises', 'Workouts'],
  ])('on %s marks %s current', async (pathname, current, other) => {
    vi.mocked(usePathname).mockReturnValue(pathname);
    const screen = await render(<LibraryTabs />);

    await expect
      .element(
        screen.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: current }),
      )
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(
        screen.getByRole('navigation', { name: 'Library' }).getByRole('link', { name: other }),
      )
      .not.toHaveAttribute('aria-current');
  });

  it('links to both library routes', async () => {
    vi.mocked(usePathname).mockReturnValue('/library/workouts');
    const screen = await render(<LibraryTabs />);

    await expect
      .element(screen.getByRole('link', { name: 'Workouts' }))
      .toHaveAttribute('href', '/library/workouts');
    await expect
      .element(screen.getByRole('link', { name: 'Exercises' }))
      .toHaveAttribute('href', '/library/exercises');
  });
});
