import { onlineManager } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseListResponse } from '@/shared/schemas/exercise';
import { getExerciseListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
import { ExerciseCatalog } from '../ExerciseCatalog';

vi.mock('next/navigation', () => ({ useSearchParams: vi.fn() }));

let replace: ReturnType<typeof vi.fn<History['replaceState']>>;
const fetchMock = vi.fn<typeof fetch>();
let observerCallback: IntersectionObserverCallback | undefined;

// next/link uses IntersectionObserver for prefetching too; only the catalog's sentinel is captured.
class ObserverStub {
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    if (options?.rootMargin === '400px') observerCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const item = (id: number, override: Parameters<typeof getExerciseListItemMock>[0] = {}) =>
  getExerciseListItemMock({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    name: `Exercise ${id}`,
    ...override,
  });

const page = (items: ExerciseListResponse['items'], nextCursor: string | null = null) =>
  Response.json({ items, nextCursor } satisfies ExerciseListResponse);

function respond(handler: (url: URL) => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (input) =>
    handler(new URL(String(input), 'http://localhost')),
  );
}

function withUrl(search: string) {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(search) as unknown as ReturnType<typeof useSearchParams>,
  );
}

const requestedUrls = () =>
  fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', ObserverStub);
  replace = vi.fn<History['replaceState']>();
  vi.spyOn(window.history, 'replaceState').mockImplementation(replace);
  withUrl('');
  observerCallback = undefined;
  onlineManager.setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('ExerciseCatalog', () => {
  it('shows a skeleton while the first page loads', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const screen = await render(<ExerciseCatalog />);

    await expect.element(screen.getByRole('searchbox', { name: 'Search exercises' })).toBeVisible();
    await expect.element(screen.getByTestId('exercise-catalog-skeleton')).toBeInTheDocument();
  });

  it('renders section headings before the first item of each section and requests 30', async () => {
    respond(() =>
      page([
        item(1, { name: 'Bench Press', section: 'chest' }),
        item(2, { name: 'Dumbbell Fly', section: 'chest' }),
        item(3, { name: 'Overhead Press', section: 'shoulders', primaryMuscles: ['shoulders'] }),
      ]),
    );
    const screen = await render(<ExerciseCatalog />);

    await expect.element(screen.getByRole('link', { name: /Bench Press/ })).toBeVisible();
    const headings = screen.getByRole('heading', { level: 2 });
    await expect.element(headings.first()).toHaveTextContent('Chest');
    await expect.element(headings.last()).toHaveTextContent('Shoulders');
    expect(headings.elements()).toHaveLength(2);
    expect(requestedUrls()[0]?.searchParams.get('limit')).toBe('30');
  });

  it('shows no headings in search mode', async () => {
    withUrl('q=press');
    respond(() => page([item(1, { name: 'Bench Press', section: null })]));
    const screen = await render(<ExerciseCatalog />);

    await expect.element(screen.getByRole('link', { name: /Bench Press/ })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2 }).elements()).toHaveLength(0);
    await expect.element(screen.getByRole('searchbox')).toHaveValue('press');
  });

  it('restores chips and equipment from repeated URL params and sends them to the API', async () => {
    withUrl('muscle=triceps&muscle=chest&equipment=barbell&muscle=wings');
    respond(() => page([item(1)]));
    const screen = await render(<ExerciseCatalog />);

    await expect
      .element(screen.getByRole('button', { name: 'Chest' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(screen.getByRole('button', { name: 'Triceps' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(screen.getByRole('button', { name: 'Shoulders' }))
      .toHaveAttribute('aria-pressed', 'false');
    await expect.element(screen.getByRole('checkbox', { name: 'Barbell' })).toBeChecked();
    await expect.element(screen.getByRole('button', { name: 'Equipment (1)' })).toBeVisible();

    const params = requestedUrls()[0]?.searchParams;
    expect(params?.getAll('muscle')).toEqual(['chest', 'triceps']);
    expect(params?.getAll('equipment')).toEqual(['barbell']);
  });

  it('puts chip, equipment and search changes into the URL', async () => {
    withUrl('muscle=chest');
    respond(() => page([item(1)]));
    const screen = await render(<ExerciseCatalog />);

    await screen.getByRole('button', { name: 'Triceps' }).click();
    expect(replace).toHaveBeenLastCalledWith(
      null,
      '',
      '/library/exercises?muscle=chest&muscle=triceps',
    );

    await screen.getByRole('button', { name: 'Chest' }).click();
    expect(replace).toHaveBeenLastCalledWith(null, '', '/library/exercises');

    await screen.getByRole('checkbox', { name: 'Dumbbell' }).click();
    expect(replace).toHaveBeenLastCalledWith(
      null,
      '',
      '/library/exercises?muscle=chest&equipment=dumbbell',
    );

    await screen.getByRole('searchbox', { name: 'Search exercises' }).fill('bench');
    await vi.waitFor(() =>
      expect(replace).toHaveBeenLastCalledWith(null, '', '/library/exercises?q=bench&muscle=chest'),
    );
  });

  it('shows the empty state with Clear filters when nothing matches', async () => {
    withUrl('q=zzz&muscle=neck');
    respond(() => page([]));
    const screen = await render(<ExerciseCatalog />);

    await expect.element(screen.getByRole('heading', { name: 'No exercises found' })).toBeVisible();
    await screen.getByRole('button', { name: 'Clear filters' }).click();
    expect(replace).toHaveBeenLastCalledWith(null, '', '/library/exercises');
  });

  it('shows an error with Retry that refetches', async () => {
    respond(() => Response.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 }));
    const screen = await render(<ExerciseCatalog />);

    await expect.element(screen.getByText("Couldn't load exercises.")).toBeVisible();
    respond(() => page([item(1, { name: 'Bench Press' })]));
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByRole('link', { name: /Bench Press/ })).toBeVisible();
  });

  it('shows the offline notice when a request fails on the network', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const screen = await render(<ExerciseCatalog />);

    await expect
      .element(screen.getByText("You're offline. Connect to the internet to load exercises."))
      .toBeVisible();
  });

  it('keeps the list on screen when the connection drops and filters change', async () => {
    respond(() => page([item(1, { name: 'Bench Press' })]));
    const screen = await render(<ExerciseCatalog />);
    await expect.element(screen.getByRole('link', { name: /Bench Press/ })).toBeVisible();

    onlineManager.setOnline(false);
    withUrl('muscle=chest');
    screen.rerender(<ExerciseCatalog />);

    await expect
      .element(screen.getByText("You're offline. Connect to the internet to load exercises."))
      .toBeVisible();
    await expect.element(screen.getByRole('link', { name: /Bench Press/ })).toBeVisible();
  });

  it('loads the next page with Show more and hides it at the end', async () => {
    respond((url) =>
      url.searchParams.get('cursor')
        ? page([item(31, { name: 'Last One' })])
        : page([item(1, { name: 'First One' })], 'next-cursor'),
    );
    const screen = await render(<ExerciseCatalog />);

    await screen.getByRole('button', { name: 'Show more' }).click();

    await expect.element(screen.getByRole('link', { name: /Last One/ })).toBeVisible();
    await expect.element(screen.getByRole('link', { name: /First One/ })).toBeVisible();
    expect(requestedUrls()[1]?.searchParams.get('cursor')).toBe('next-cursor');
    await expect.element(screen.getByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('loads the next page when the sentinel scrolls into view', async () => {
    respond((url) =>
      url.searchParams.get('cursor')
        ? page([item(31, { name: 'Scrolled In' })])
        : page([item(1)], 'next-cursor'),
    );
    const screen = await render(<ExerciseCatalog />);
    await expect.element(screen.getByRole('button', { name: 'Show more' })).toBeVisible();

    observerCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    await expect.element(screen.getByRole('link', { name: /Scrolled In/ })).toBeVisible();
  });
});
