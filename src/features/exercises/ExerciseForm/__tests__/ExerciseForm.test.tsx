import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createExercise, updateExercise } from '@/api/exercises';
import { ApiError } from '@/api/http';
import { getExerciseMock } from '@/test/mocks';
import { render } from '@/test/render';
import { ExerciseForm } from '../ExerciseForm';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/api/exercises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/exercises')>()),
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  uploadFrame: vi.fn(),
  deleteFrame: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const gymField = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByRole('group', { name: 'Gym equipment needed' });

async function fillRequired(screen: Awaited<ReturnType<typeof render>>, name = 'Cable Hug') {
  await screen.getByLabelText('Name').fill(name);
  await screen
    .getByRole('group', { name: 'Primary muscles' })
    .getByRole('button', { name: 'Chest' })
    .click();
  await screen.getByRole('checkbox', { name: 'Cable' }).click();
}

describe('ExerciseForm', () => {
  it('shows required field errors on an empty submit (AC13)', async () => {
    const screen = await render(<ExerciseForm mode="create" />);

    await screen.getByRole('button', { name: 'Save' }).click();

    await expect.element(screen.getByText('Enter a name.')).toBeVisible();
    await expect.element(screen.getByText('Pick at least one primary muscle.')).toBeVisible();
    await expect.element(screen.getByText('Pick at least one piece of equipment.')).toBeVisible();
    expect(createExercise).not.toHaveBeenCalled();
  });

  it('creates the exercise and opens its page', async () => {
    vi.mocked(createExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const screen = await render(<ExerciseForm mode="create" />);

    await fillRequired(screen);
    await screen.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    const [id, input] = vi.mocked(createExercise).mock.calls[0] ?? [];
    expect(input).toMatchObject({
      name: 'Cable Hug',
      primaryMuscles: ['chest'],
      equipment: ['cable'],
    });
    expect(push).toHaveBeenCalledWith(`/library/exercises/${id}`);
  });

  it('shows a taken name under the field and the limit above Save (AC8, AC9)', async () => {
    vi.mocked(createExercise).mockRejectedValueOnce(new ApiError('EXERCISE_NAME_TAKEN', 409));
    const screen = await render(<ExerciseForm mode="create" />);
    await fillRequired(screen);
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect
      .element(screen.getByText('You already have an exercise with this name.'))
      .toBeVisible();

    vi.mocked(createExercise).mockRejectedValueOnce(new ApiError('EXERCISE_LIMIT_REACHED', 422));
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect
      .element(screen.getByText("You've reached 300 exercises of your own."))
      .toBeVisible();
  });

  it('asks before discarding changes and guards reload (AC13)', async () => {
    const listener = vi.spyOn(window, 'addEventListener');
    const screen = await render(<ExerciseForm mode="create" />);

    await screen.getByLabelText('Name').fill('Unsaved');
    expect(listener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    await screen.getByRole('button', { name: 'Cancel' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Discard changes?' })).toBeVisible();
    expect(push).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: 'Discard' }).click();
    expect(push).toHaveBeenCalledWith('/library/exercises');
  });

  it('prefills a duplicate and keeps the source photos as slots (AC7)', async () => {
    const source = getExerciseMock();
    const screen = await render(<ExerciseForm mode="create" source={source} />);

    await expect.element(screen.getByLabelText('Name')).toHaveValue('Bench Press');
    await expect
      .element(
        screen
          .getByRole('group', { name: 'Primary muscles' })
          .getByRole('button', { name: 'Chest' }),
      )
      .toHaveAttribute('aria-pressed', 'true');
    expect(
      screen
        .getByRole('group', { name: 'Photos' })
        .getByRole('button', { name: /^Drag to reorder/ })
        .elements(),
    ).toHaveLength(2);
  });

  it('disables Save offline with a hint (AC11)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<ExerciseForm mode="create" />);

    await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });

  it('sends common mistakes as one item per line', async () => {
    vi.mocked(createExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const screen = await render(<ExerciseForm mode="create" />);
    await fillRequired(screen);

    await screen.getByLabelText('Common mistakes').fill('Shrugging\n\n  Locking the elbows ');
    await screen.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(createExercise).toHaveBeenCalled());
    expect(vi.mocked(createExercise).mock.calls[0]?.[1]).toMatchObject({
      commonMistakes: ['Shrugging', 'Locking the elbows'],
    });
  });

  it('adds a new frame between the start and the end position', async () => {
    const screen = await render(<ExerciseForm mode="create" />);

    await screen.getByRole('button', { name: 'Add frame' }).click();

    const labels = screen
      .getByRole('group', { name: 'Photos' })
      .getByRole('button', { name: /^Add photo/ });
    expect(
      labels.elements().map((element) => element.textContent?.replace('Add photo, ', '')),
    ).toEqual(['Start position', 'Frame 2', 'End position']);
  });

  it('reorders steps from the drag handle with the keyboard', async () => {
    vi.mocked(createExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const screen = await render(<ExerciseForm mode="create" />);
    await fillRequired(screen);
    await screen.getByRole('button', { name: 'Add step' }).click();
    await screen.getByRole('button', { name: 'Add step' }).click();
    await screen.getByRole('textbox', { name: 'Steps 1', exact: true }).fill('First');
    await screen.getByRole('textbox', { name: 'Steps 2', exact: true }).fill('Second');

    screen.getByRole('button', { name: 'Drag to reorder, Steps 1' }).element().focus();
    await userEvent.keyboard('{ArrowDown}');
    await screen.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(createExercise).toHaveBeenCalled());
    expect(vi.mocked(createExercise).mock.calls[0]?.[1]).toMatchObject({
      instructions: ['Second', 'First'],
    });
  });

  it('clears a field error as soon as the field is edited', async () => {
    const screen = await render(<ExerciseForm mode="create" />);
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect.element(screen.getByText('Pick at least one piece of equipment.')).toBeVisible();

    await screen.getByRole('checkbox', { name: 'Cable' }).click();
    await screen.getByLabelText('Name').fill('Fixed');

    await expect
      .element(screen.getByText('Pick at least one piece of equipment.'))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText('Enter a name.')).not.toBeInTheDocument();
    await expect.element(screen.getByText('Pick at least one primary muscle.')).toBeVisible();
  });

  it('leaves an untouched duplicate without asking', async () => {
    const source = getExerciseMock();
    const screen = await render(<ExerciseForm mode="create" source={source} />);

    await screen.getByRole('button', { name: 'Cancel' }).click();

    expect(push).toHaveBeenCalledWith(`/library/exercises/${source.id}`);
  });

  it('offers Replace and Remove in a menu on the photo', async () => {
    const screen = await render(<ExerciseForm mode="create" source={getExerciseMock()} />);

    await screen.getByRole('button', { name: 'Photo actions, Start position' }).click();
    await screen.getByRole('menuitem', { name: 'Remove photo' }).click();

    expect(
      screen
        .getByRole('group', { name: 'Photos' })
        .getByRole('button', { name: /^Drag to reorder/ })
        .elements(),
    ).toHaveLength(1);
  });

  it('sends each ticked gym item as its own required group (AC11)', async () => {
    vi.mocked(createExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const screen = await render(<ExerciseForm mode="create" />);

    await expect
      .element(gymField(screen).getByText('Leave empty if it needs nothing special.'))
      .toBeVisible();
    expect(gymField(screen).getByRole('button', { name: 'Select all' }).elements()).toHaveLength(0);
    await fillRequired(screen);
    await gymField(screen).getByRole('button', { name: 'Barbell', exact: true }).click();
    await gymField(screen).getByRole('button', { name: 'Flat bench' }).click();
    await screen.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(createExercise).toHaveBeenCalled());
    expect(vi.mocked(createExercise).mock.calls[0]?.[1].gymEquipment).toEqual([
      ['barbell'],
      ['flat_bench'],
    ]);
  });

  it("keeps a duplicate's alternatives as one removable chip (AC11)", async () => {
    vi.mocked(createExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const source = getExerciseMock({
      gymEquipment: [['dumbbells', 'kettlebells'], ['flat_bench']],
    });
    const screen = await render(<ExerciseForm mode="create" source={source} />);

    await expect.element(gymField(screen).getByText('Dumbbells or Kettlebells')).toBeVisible();
    await expect
      .element(gymField(screen).getByRole('button', { name: 'Flat bench' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(gymField(screen).getByRole('button', { name: 'Dumbbells', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');

    await screen.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(createExercise).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createExercise).mock.calls[0]?.[1].gymEquipment).toEqual([
      ['dumbbells', 'kettlebells'],
      ['flat_bench'],
    ]);
  });

  it('removes an alternatives chip and keeps gym equipment on edit (AC11)', async () => {
    vi.mocked(updateExercise).mockImplementation(async (id) =>
      getExerciseMock({ id, isOwn: true }),
    );
    const exercise = getExerciseMock({
      isOwn: true,
      frames: [],
      gymEquipment: [['dumbbells', 'kettlebells']],
    });
    const screen = await render(<ExerciseForm mode="edit" exercise={exercise} />);

    await screen.getByRole('button', { name: 'Remove Dumbbells or Kettlebells' }).click();
    await expect.element(screen.getByText('Dumbbells or Kettlebells')).not.toBeInTheDocument();
    await screen.getByRole('button', { name: 'Save' }).click();

    await vi.waitFor(() => expect(updateExercise).toHaveBeenCalled());
    expect(vi.mocked(updateExercise).mock.calls[0]?.[1]).toMatchObject({ gymEquipment: [] });
  });
});
