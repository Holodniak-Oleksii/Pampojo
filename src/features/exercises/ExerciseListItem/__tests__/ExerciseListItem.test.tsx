import { afterEach, describe, expect, it, vi } from 'vitest';
import { getExerciseListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
import { ExerciseListItem } from '../ExerciseListItem';

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

// Real image data, so the <img> loads instead of falling back to the name tile.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
const frame = (n: number) => ({
  id: null,
  thumbUrl: `${PIXEL}#${n}-thumb`,
  fullUrl: `${PIXEL}#${n}-full`,
});
const item = () =>
  getExerciseListItemMock({
    thumbnailUrl: frame(0).thumbUrl,
    imageUrl: frame(0).fullUrl,
    frames: [frame(0), frame(1)],
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ExerciseListItem', () => {
  it('alternates the frames while hovered and returns to the start frame on leave', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseListItem item={item()} />);
    const image = screen.getByRole('presentation');
    await expect.element(image).toHaveAttribute('src', frame(0).thumbUrl);

    vi.useFakeTimers();
    await screen.getByRole('link').hover();
    await vi.advanceTimersByTimeAsync(1000);
    await expect.element(image).toHaveAttribute('src', frame(1).thumbUrl);

    await screen.getByRole('link').unhover();
    await expect.element(image).toHaveAttribute('src', frame(0).thumbUrl);
  });

  it('does not animate with reduced motion', async () => {
    mockReducedMotion(true);
    const screen = await render(<ExerciseListItem item={item()} />);
    await expect.element(screen.getByRole('presentation')).toBeInTheDocument();
    vi.useFakeTimers();
    await screen.getByRole('link').hover();
    await vi.advanceTimersByTimeAsync(3000);

    await expect
      .element(screen.getByRole('presentation'))
      .toHaveAttribute('src', frame(0).thumbUrl);
  });

  it('shows the Mine badge on own exercises', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseListItem item={{ ...item(), isOwn: true }} />);
    await expect.element(screen.getByText('Mine', { exact: true })).toBeVisible();
  });

  it('shows no badge on system exercises', async () => {
    mockReducedMotion(false);
    const screen = await render(<ExerciseListItem item={item()} />);
    await expect.element(screen.getByRole('link')).toBeVisible();
    expect(screen.getByText('Mine', { exact: true }).elements()).toHaveLength(0);
  });

  it('cycles every frame on hover, not just two', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseListItem item={{ ...item(), frames: [frame(0), frame(1), frame(2)] }} />,
    );
    const image = screen.getByRole('presentation');
    await expect.element(image).toHaveAttribute('src', frame(0).thumbUrl);

    vi.useFakeTimers();
    await screen.getByRole('link').hover();
    await vi.advanceTimersByTimeAsync(2000);
    await expect.element(image).toHaveAttribute('src', frame(2).thumbUrl);
  });

  it('lists muscles with commas and no family colour', async () => {
    mockReducedMotion(false);
    const screen = await render(
      <ExerciseListItem item={getExerciseListItemMock({ primaryMuscles: ['chest', 'triceps'] })} />,
    );

    await expect.element(screen.getByText('Chest, Triceps')).toBeVisible();
    expect(screen.getByRole('link').element().querySelectorAll('[data-family]')).toHaveLength(0);
  });
});
