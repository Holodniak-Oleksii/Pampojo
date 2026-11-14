import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkoutListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
import { DeleteExerciseDialog } from '..';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const EXERCISE = '00000000-0000-4000-8000-0000000000c1';
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () =>
    Response.json({
      items: [
        getWorkoutListItemMock({ name: 'Push Day', exerciseIds: [EXERCISE] }),
        getWorkoutListItemMock({
          id: '00000000-0000-4000-8000-00000000a002',
          name: 'Legs',
          exerciseIds: [],
        }),
      ],
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DeleteExerciseDialog', () => {
  it('lists the workouts that use the exercise (spec 09 AC13)', async () => {
    const screen = await render(<DeleteExerciseDialog exerciseId={EXERCISE} disabled={false} />);
    await screen.getByRole('button', { name: 'Delete' }).click();
    await expect
      .element(screen.getByText('It will also be removed from these workouts:'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Push Day' }))
      .toHaveAttribute('href', '/library/workouts/00000000-0000-4000-8000-00000000a001');
    expect(screen.getByRole('link', { name: 'Legs' }).elements()).toHaveLength(0);
  });
});
