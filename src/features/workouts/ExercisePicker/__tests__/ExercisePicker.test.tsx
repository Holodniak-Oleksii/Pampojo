import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getExerciseListItemMock } from '@/test/mocks';
import { openLocalDb } from '@/services/local-db';
import { localExercise } from '@/test/local-data';
import { resetLocalDbs } from '@/test/local-session';
import { render, TEST_USER_ID } from '@/test/render';
import { ExercisePicker } from '..';

const fetchMock = vi.fn<typeof fetch>();
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const item = (n: number, name: string) =>
  getExerciseListItemMock({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    name,
    section: 'chest',
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', ObserverStub);
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/me/gym') {
      return Response.json(
        { error: { code: 'GYM_PROFILE_NOT_FOUND', message: 'x' } },
        { status: 404 },
      );
    }
    return Response.json({
      items: [item(1, 'Bench Press'), item(2, 'Push-up'), item(3, 'Dumbbell Fly')],
      nextCursor: null,
    });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetLocalDbs();
});

describe('ExercisePicker', () => {
  it('links the image and name to the exercise and keeps the pick on the diamond', async () => {
    const screen = await render(
      <ExercisePicker open onOpenChange={vi.fn()} room={30} onAdd={vi.fn()} />,
    );
    await expect
      .element(screen.getByRole('link', { name: 'How to do Bench Press' }))
      .toHaveAttribute('href', '/library/exercises/00000000-0000-4000-8000-000000000001');
    await expect
      .element(screen.getByRole('button', { name: 'Bench Press', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('numbers picks in order, renumbers on unpick and adds them in that order (AC9)', async () => {
    const onAdd = vi.fn();
    const screen = await render(
      <ExercisePicker open onOpenChange={vi.fn()} room={30} onAdd={onAdd} />,
    );
    const bench = screen.getByRole('button', { name: /^Bench Press/ });
    const pushUp = screen.getByRole('button', { name: /^Push-up/ });
    const fly = screen.getByRole('button', { name: /^Dumbbell Fly/ });
    await fly.click();
    await bench.click();
    await pushUp.click();
    await expect.element(fly).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('button', { name: 'Add 3 exercises' })).toBeEnabled();

    await fly.click();
    await expect.element(fly).toHaveAttribute('aria-pressed', 'false');
    expect(bench.element().textContent?.endsWith('1')).toBe(true);
    await screen.getByRole('button', { name: 'Add 2 exercises' }).click();
    expect(onAdd.mock.calls[0]?.[0].map((entry: { name: string }) => entry.name)).toEqual([
      'Bench Press',
      'Push-up',
    ]);
  });

  it('stops at the room left in the workout', async () => {
    const screen = await render(
      <ExercisePicker open onOpenChange={vi.fn()} room={1} onAdd={vi.fn()} />,
    );
    await screen.getByRole('button', { name: /^Bench Press/ }).click();
    await expect.element(screen.getByRole('button', { name: /^Push-up/ })).toBeDisabled();
    await expect.element(screen.getByText('Up to 30 exercises in a workout.')).toBeVisible();
  });

  it('keeps the sheet in the visible viewport above the keyboard (spec 14 AC18)', async () => {
    const viewport = Object.assign(new EventTarget(), { height: 534, offsetTop: 0 });
    vi.stubGlobal('visualViewport', viewport);
    const screen = await render(
      <ExercisePicker open onOpenChange={vi.fn()} room={30} onAdd={vi.fn()} />,
    );
    const sheet = screen.getByRole('dialog', { name: 'Add exercises' });
    await expect.element(sheet).toHaveStyle({ height: '534px', top: '0px' });
    viewport.height = 420;
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event('resize'));
    await expect.element(sheet).toHaveStyle({ height: '420px', top: '40px' });
  });

  it('offline searches only the exercises on the device (AC11)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await openLocalDb(TEST_USER_ID).exercises.bulkPut([
      localExercise('Lat Pulldown', { primaryMuscles: ['lats'] }),
    ]);
    const screen = await render(
      <ExercisePicker open onOpenChange={vi.fn()} room={30} onAdd={vi.fn()} />,
      { localDb: true },
    );
    await expect.element(screen.getByRole('button', { name: /^Lat Pulldown/ })).toBeVisible();
    await expect
      .element(screen.getByText(/Offline, there is 1 exercise from your workouts and history/))
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: /^Bench Press/ }))
      .not.toBeInTheDocument();
    await screen.getByRole('searchbox', { name: 'Search exercises' }).fill('bench');
    await expect
      .element(screen.getByRole('heading', { name: 'No saved exercise matches' }))
      .toBeVisible();
  });
});
