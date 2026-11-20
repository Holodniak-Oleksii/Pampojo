import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openLocalDb } from '@/services/local-db';
import { localExercise } from '@/test/local-data';
import { resetLocalDbs } from '@/test/local-session';
import { getExerciseMock } from '@/test/mocks';
import { render, TEST_USER_ID } from '@/test/render';
import { ExerciseDetailsScreen } from '../ExerciseDetailsScreen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ items: [] }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetLocalDbs();
});

describe('ExerciseDetailsScreen (spec 17 AC6)', () => {
  it('reads the device copy offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const row = localExercise('Bench Press', { uk: 'Жим лежачи' });
    await openLocalDb(TEST_USER_ID).exercises.put(row);
    const screen = await render(<ExerciseDetailsScreen id={row.id} />, { localDb: true });
    await expect
      .element(screen.getByRole('heading', { name: 'Bench Press', level: 1 }))
      .toBeVisible();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes(row.id))).toBe(false);
  });

  it('loads an exercise the device lacks from the server online', async () => {
    const exercise = getExerciseMock({ name: 'Cable Fly' });
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith(`/api/v1/exercises/${exercise.id}`)
        ? Response.json(exercise)
        : Response.json({ items: [] }),
    );
    const screen = await render(<ExerciseDetailsScreen id={exercise.id} />, { localDb: true });
    await expect
      .element(screen.getByRole('heading', { name: 'Cable Fly', level: 1 }))
      .toBeVisible();
  });

  it('says it needs internet for an exercise the device lacks offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<ExerciseDetailsScreen id={crypto.randomUUID()} />, {
      localDb: true,
    });
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });

  it('shows not found online for an unknown exercise', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ error: { code: 'EXERCISE_NOT_FOUND' } }, { status: 404 }),
    );
    const screen = await render(<ExerciseDetailsScreen id={crypto.randomUUID()} />, {
      localDb: true,
    });
    await expect.element(screen.getByRole('heading', { name: 'Exercise not found' })).toBeVisible();
  });
});
