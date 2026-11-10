import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getExerciseMock } from '@/test/mocks';
import { render } from '@/test/render';
import { CATALOG_QUERY_STORAGE_KEY } from '../../constants';
import { ExerciseDetails } from '../ExerciseDetails';

function mockReducedMotion(reduce: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ExerciseDetails', () => {
  it('shows the name, description, steps, mistakes and every metadata row', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);

    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'Bench Press' }))
      .toBeVisible();
    await expect.element(screen.getByText(/Press a barbell from your chest/)).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'How to do it' })).toBeVisible();
    expect(screen.getByRole('list').first().getByRole('listitem').elements()).toHaveLength(3);
    await expect.element(screen.getByRole('heading', { name: 'Common mistakes' })).toBeVisible();
    await expect.element(screen.getByText('Bouncing the bar off the chest.')).toBeVisible();

    for (const [term, value] of [
      ['Primary', 'Chest'],
      ['Secondary', 'Shoulders, Triceps'],
      ['Equipment', 'Barbell'],
      ['Movement', 'Horizontal push'],
      ['Type', 'Compound'],
      ['Sides', 'Both sides'],
      ['Tracking', 'Weight × reps'],
      ['Level', 'Intermediate'],
    ]) {
      await expect
        .element(screen.getByRole('term').filter({ hasText: term }).first())
        .toBeVisible();
      await expect
        .element(screen.getByRole('definition').filter({ hasText: value }).first())
        .toBeVisible();
    }
  });

  it('hides rows whose value is missing', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseDetails
        exercise={getExerciseMock({
          secondaryMuscles: [],
          movementPattern: null,
          mechanic: null,
          laterality: null,
          difficulty: null,
        })}
      />,
    );

    await expect.element(screen.getByRole('term').filter({ hasText: 'Primary' })).toBeVisible();
    for (const term of ['Secondary', 'Movement', 'Type', 'Sides', 'Level']) {
      expect(screen.getByRole('term').filter({ hasText: term }).elements()).toHaveLength(0);
    }
  });

  it('alternates the start and end frames every second', async () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);

    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, Start position' }))
      .toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1000);
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, End position' }))
      .toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1000);
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, Start position' }))
      .toBeInTheDocument();
  });

  it('keeps the start frame with reduced motion and switches it on press', async () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);
    const button = screen.getByRole('button', { name: 'Switch position' });

    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
    await vi.advanceTimersByTimeAsync(3000);
    await expect.element(button).toHaveAttribute('aria-pressed', 'false');

    vi.useRealTimers();
    await button.click();
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a placeholder with the name when there are no frames', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock({ frames: [] })} />);
    await expect.element(screen.getByRole('img', { name: 'Bench Press' })).toBeVisible();
  });

  it('shows a placeholder with the name when an image fails to load', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseDetails
        exercise={getExerciseMock({
          frames: [{ thumbUrl: '/missing-0-thumb.webp', fullUrl: '/missing-0-full.webp' }],
        })}
      />,
    );
    // The failed <img> is swapped for the name tile, which carries the same accessible name.
    await vi.waitFor(() =>
      expect(
        screen.getByRole('img', { name: 'Bench Press, Start position' }).element().tagName,
      ).toBe('SPAN'),
    );
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, Start position' }))
      .toHaveTextContent('Bench Press');
  });

  it('links back to the last catalog search', async () => {
    mockReducedMotion(false);
    sessionStorage.setItem(CATALOG_QUERY_STORAGE_KEY, '?muscle=chest');
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);

    await expect
      .element(screen.getByRole('link', { name: 'Exercises' }))
      .toHaveAttribute('href', '/library/exercises?muscle=chest');
  });
});
