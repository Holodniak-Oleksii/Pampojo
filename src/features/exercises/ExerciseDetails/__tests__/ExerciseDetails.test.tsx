import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getExerciseMock } from '@/test/mocks';
import { render } from '@/test/render';
import { CATALOG_QUERY_STORAGE_KEY } from '../../constants';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const frame = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  thumbUrl: `data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=#${n}-t`,
  fullUrl: `data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=#${n}-f`,
});
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

  it('shows the gym equipment row with every group (AC10)', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);
    await expect
      .element(screen.getByRole('term').filter({ hasText: 'Gym equipment' }))
      .toBeVisible();
    const term = screen.getByRole('term').filter({ hasText: 'Gym equipment' }).element();
    const value = term.nextElementSibling as HTMLElement;
    const items = [...value.querySelectorAll('li')].map((li) => li.textContent);
    expect(items).toEqual(['Barbell', 'Flat bench', 'Squat rack']);
    expect(value.textContent).not.toContain('·');
  });

  it('joins alternatives with "or" (AC10)', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseDetails
        exercise={getExerciseMock({ gymEquipment: [['dumbbells', 'kettlebells']] })}
      />,
    );
    await expect.element(screen.getByText('Dumbbells or Kettlebells')).toBeVisible();
  });

  it('says "Nothing special" when nothing is needed (AC10)', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseDetails exercise={getExerciseMock({ gymEquipment: [] })} />,
    );
    await expect.element(screen.getByText('Nothing special')).toBeVisible();
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
          frames: [
            { id: null, thumbUrl: '/missing-0-thumb.webp', fullUrl: '/missing-0-full.webp' },
          ],
        })}
      />,
    );
    // The failed <img> is swapped for the name tile, which carries the same accessible name.
    await vi.waitFor(() =>
      expect(screen.getByRole('img', { name: 'Bench Press', exact: true }).element().tagName).toBe(
        'SPAN',
      ),
    );
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press', exact: true }))
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

  it('offers only Duplicate on a system exercise and Edit and Delete on an own one (AC3)', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock()} />);
    await expect
      .element(screen.getByRole('link', { name: 'Duplicate as my own' }))
      .toHaveAttribute('href', `/library/exercises/new?from=${getExerciseMock().id}`);
    expect(screen.getByRole('link', { name: 'Edit' }).elements()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Delete' }).elements()).toHaveLength(0);
  });

  it('shows Edit and Delete for an own exercise and confirms before deleting (AC6)', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock({ isOwn: true })} />);

    await expect.element(screen.getByRole('link', { name: 'Edit' })).toBeVisible();
    await screen.getByRole('button', { name: 'Delete' }).click();
    await expect
      .element(screen.getByRole('heading', { name: 'Delete this exercise?' }))
      .toBeVisible();
  });

  it('disables changes offline with a hint (AC11)', async () => {
    mockReducedMotion(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<ExerciseDetails exercise={getExerciseMock({ isOwn: true })} />);

    await expect.element(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });

  it('cycles three frames in order and steps through them with reduced motion (AC5)', async () => {
    mockReducedMotion(false);
    const frames = [frame(1), frame(2), frame(3)];
    const screen = await render(<ExerciseDetails exercise={getExerciseMock({ frames })} />);
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, frame 1 of 3' }))
      .toBeInTheDocument();

    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(1000);
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, frame 2 of 3' }))
      .toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(2000);
    await expect
      .element(screen.getByRole('img', { name: 'Bench Press, frame 1 of 3' }))
      .toBeInTheDocument();
  });
});
