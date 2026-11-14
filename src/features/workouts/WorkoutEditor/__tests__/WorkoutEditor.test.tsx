import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { getWorkoutExerciseMock, getWorkoutMock } from '@/test/mocks';
import { render } from '@/test/render';
import { WorkoutEditor } from '..';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ID = '00000000-0000-4000-8000-00000000a001';
const fetchMock = vi.fn<typeof fetch>();
const puts = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([input, init]) => ({ url: String(input), body: JSON.parse(String(init?.body)) }));

function serve(workout = getWorkoutMock()) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/me/gym') {
      return Response.json(
        { error: { code: 'GYM_PROFILE_NOT_FOUND', message: 'x' } },
        { status: 404 },
      );
    }
    if (init?.method === 'PUT') return Response.json(workout);
    return Response.json(workout);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WorkoutEditor', () => {
  it('shows the workout with its rows and saves it, then goes to the list', async () => {
    serve(
      getWorkoutMock({
        exercises: [getWorkoutExerciseMock({ notes: 'Pause at the bottom' })],
      }),
    );
    const screen = await render(<WorkoutEditor mode="edit" id={ID} />);
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Push Day');
    const row = screen.getByRole('button', { name: /^Bench Press/ });
    await expect.element(row).toBeVisible();
    expect(row.element().textContent).toContain('3 × 8–12, 80 kg');
    expect(row.element().textContent).toContain('Pause at the bottom');

    await screen.getByRole('textbox', { name: 'Name' }).fill('Push Day A');
    await screen.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/library/workouts'));
    expect(puts()[0]?.url).toContain(`/api/v1/workouts/${ID}`);
    expect(puts()[0]?.body).toMatchObject({
      name: 'Push Day A',
      exercises: [{ notes: 'Pause at the bottom' }],
    });
  });

  it('reorders with the keyboard on the drag handle and announces it (AC2)', async () => {
    serve(
      getWorkoutMock({
        exercises: [
          getWorkoutExerciseMock(),
          getWorkoutExerciseMock({
            id: '00000000-0000-4000-8000-0000000000e2',
            exerciseId: '00000000-0000-4000-8000-0000000000b2',
            exercise: {
              id: '00000000-0000-4000-8000-0000000000b2',
              name: 'Push-up',
              trackingType: 'reps',
            },
            targetWeightKg: null,
          }),
        ],
      }),
    );
    const screen = await render(<WorkoutEditor mode="edit" id={ID} />);
    const handle = screen.getByRole('button', { name: 'Drag Bench Press' });
    await expect.element(handle).toBeVisible();
    (handle.element() as HTMLElement).focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard(' ');
    await vi.waitFor(() => {
      const names = screen
        .getByRole('button', { name: /^Drag / })
        .elements()
        .map((node) => node.getAttribute('aria-label'));
      expect(names).toEqual(['Drag Push-up', 'Drag Bench Press']);
    });
    await expect
      .element(screen.getByText('"Bench Press" was dropped at position 2.'))
      .toBeInTheDocument();
  });

  it('keeps Save disabled with a hint until there is a name and an exercise (AC10)', async () => {
    serve();
    const screen = await render(<WorkoutEditor mode="new" />);
    const save = screen.getByRole('button', { name: 'Save' });
    await expect.element(save).toBeDisabled();
    await expect
      .element(screen.getByText('Add a name and at least one exercise to save.'))
      .toBeVisible();
    await screen.getByRole('textbox', { name: 'Name' }).fill('Legs');
    await expect.element(save).toBeDisabled();
  });

  it('asks before leaving with changes, and leaves at once without them (AC7)', async () => {
    serve();
    const screen = await render(<WorkoutEditor mode="edit" id={ID} />);
    const cancel = screen.getByRole('link', { name: 'Cancel' });
    await expect.element(cancel).toHaveAttribute('href', '/library/workouts');

    await screen.getByRole('textbox', { name: 'Name' }).fill('Changed');
    await cancel.click();
    await expect.element(screen.getByRole('heading', { name: 'Discard changes?' })).toBeVisible();
    await screen.getByRole('button', { name: 'Keep editing' }).click();
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Changed');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    await screen.getByRole('link', { name: 'Workouts' }).click();
    await screen.getByRole('button', { name: 'Discard' }).click();
    expect(push).toHaveBeenCalledWith('/library/workouts');
  });

  it('is read-only offline (AC12)', async () => {
    serve();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<WorkoutEditor mode="edit" id={ID} />);
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
    expect(screen.getByRole('button', { name: /^Drag / }).elements()).toHaveLength(0);
    await expect.element(screen.getByRole('button', { name: 'Add exercises' })).toBeDisabled();
  });

  it('shows not found for an unknown id', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: { code: 'WORKOUT_NOT_FOUND', message: 'x' } }, { status: 404 }),
    );
    const screen = await render(<WorkoutEditor mode="edit" id={ID} />);
    await expect.element(screen.getByRole('heading', { name: 'Workout not found' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Back to workouts' }))
      .toHaveAttribute('href', '/library/workouts');
  });

  it('shows not found for an invalid id without a request', async () => {
    const screen = await render(<WorkoutEditor mode="edit" id="not-a-uuid" />);
    await expect.element(screen.getByRole('heading', { name: 'Workout not found' })).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
