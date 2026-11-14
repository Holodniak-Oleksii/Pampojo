import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getExerciseListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExercisePicker', () => {
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
});
