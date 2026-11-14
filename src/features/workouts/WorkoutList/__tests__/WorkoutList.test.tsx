import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWorkoutListItemMock, getWorkoutMock } from '@/test/mocks';
import { render } from '@/test/render';
import { WorkoutList } from '..';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();
type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;
function respond(handler: Handler) {
  fetchMock.mockImplementation(async (input, init) =>
    handler(new URL(String(input), 'http://localhost'), init),
  );
}
const calls = () =>
  fetchMock.mock.calls.map(([input, init]) => ({
    url: new URL(String(input), 'http://localhost'),
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('WorkoutList', () => {
  it('shows name, count and up to 3 muscles, and the empty tag for a workout without exercises', async () => {
    respond(() =>
      Response.json({
        items: [
          getWorkoutListItemMock(),
          getWorkoutListItemMock({
            id: '00000000-0000-4000-8000-00000000a002',
            name: 'Stretch',
            exerciseCount: 0,
            exerciseIds: [],
            primaryMuscles: [],
            thumbnailUrls: [],
          }),
        ],
      }),
    );
    const screen = await render(<WorkoutList />);
    const push = screen.getByRole('link', { name: /Push Day/ });
    await expect
      .element(push)
      .toHaveAttribute('href', '/library/workouts/00000000-0000-4000-8000-00000000a001');
    expect(push.element().textContent).toBe('Push Day5 exercisesChestShouldersTriceps');
    const stretch = screen.getByRole('link', { name: /Stretch/ });
    expect(stretch.element().textContent).toBe('Stretch0 exercisesAdd exercises');
  });

  it('leads to the editor from the empty state', async () => {
    respond(() => Response.json({ items: [] }));
    const screen = await render(<WorkoutList />);
    await expect.element(screen.getByRole('heading', { name: 'No workouts yet' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Create workout' }))
      .toHaveAttribute('href', '/library/workouts/new');
  });

  it('shows an error with retry', async () => {
    respond(() => Response.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 }));
    const screen = await render(<WorkoutList />);
    await expect.element(screen.getByText("Couldn't load workouts.")).toBeVisible();
    respond(() => Response.json({ items: [getWorkoutListItemMock()] }));
    await screen.getByRole('button', { name: 'Try again' }).click();
    await expect.element(screen.getByRole('link', { name: /Push Day/ })).toBeVisible();
  });

  it('duplicates into a new workout and opens it', async () => {
    respond((url, init) => {
      if (url.pathname === '/api/v1/workouts')
        return Response.json({ items: [getWorkoutListItemMock()] });
      if (init?.method === 'PUT') {
        const id = url.pathname.split('/').at(-1);
        return Response.json(getWorkoutMock({ id, name: 'Push Day (copy)' }));
      }
      return Response.json(getWorkoutMock());
    });
    const screen = await render(<WorkoutList />);
    await screen.getByRole('button', { name: 'Actions for Push Day' }).click();
    await screen.getByRole('menuitem', { name: 'Duplicate' }).click();
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    const put = calls().find((call) => call.method === 'PUT');
    expect(put?.body.name).toBe('Push Day (copy)');
    expect(put?.url.pathname).not.toBe('/api/v1/workouts/00000000-0000-4000-8000-00000000a001');
    expect(push).toHaveBeenCalledWith(put?.url.pathname.replace('/api/v1', '/library'));
  });

  it('asks before deleting and deletes', async () => {
    respond((_url, init) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json({ items: [getWorkoutListItemMock()] }),
    );
    const screen = await render(<WorkoutList />);
    await screen.getByRole('button', { name: 'Actions for Push Day' }).click();
    await screen.getByRole('menuitem', { name: 'Delete' }).click();
    await expect.element(screen.getByRole('heading', { name: 'Delete "Push Day"?' })).toBeVisible();
    await expect.element(screen.getByText('Past workouts stay in your history.')).toBeVisible();
    await screen.getByRole('button', { name: 'Delete' }).click();
    await vi.waitFor(() => expect(calls().some((call) => call.method === 'DELETE')).toBe(true));
  });

  it('disables the actions offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    respond(() => Response.json({ items: [getWorkoutListItemMock()] }));
    const screen = await render(<WorkoutList />);
    await expect
      .element(screen.getByRole('button', { name: 'Actions for Push Day' }))
      .toBeDisabled();
  });
});
