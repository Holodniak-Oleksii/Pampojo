import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionListItem } from '@/shared/schemas/session';
import { resetLocalDbs } from '@/test/local-session';
import { render } from '@/test/render';
import { HistoryList } from '../HistoryList';

const fetchMock = vi.fn<typeof fetch>();

// Fires at once, as if the end of the list were already on screen.
class VisibleObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
  unobserve() {}
}

const item = (index: number): SessionListItem => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  workoutId: '00000000-0000-4000-8000-00000000a001',
  workoutName: `Workout ${index}`,
  scheduledFor: null,
  status: 'completed',
  startedAt: new Date(Date.UTC(2026, 10, 30, 12) - index * 86_400_000).toISOString(),
  finishedAt: new Date(Date.UTC(2026, 10, 30, 13) - index * 86_400_000).toISOString(),
  setCount: 12,
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('IntersectionObserver', VisibleObserver);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetLocalDbs();
});

describe('HistoryList', () => {
  it('loads the next page at the end of the list (AC5)', async () => {
    const cursors: (string | null)[] = [];
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname !== '/api/v1/sessions') return Response.json({}, { status: 404 });
      cursors.push(url.searchParams.get('cursor'));
      expect(url.searchParams.get('limit')).toBe('20');
      return url.searchParams.get('cursor') === 'page-2'
        ? Response.json({
            items: Array.from({ length: 5 }, (_, i) => item(20 + i)),
            nextCursor: null,
          })
        : Response.json({
            items: Array.from({ length: 20 }, (_, i) => item(i)),
            nextCursor: 'page-2',
          });
    });
    const screen = await render(<HistoryList />);
    await expect.element(screen.getByRole('link', { name: /Workout 24/ })).toBeInTheDocument();
    expect(screen.getByRole('link').elements()).toHaveLength(25);
    expect(cursors).toEqual([null, 'page-2']);
  });

  it('labels late and extra workouts', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({
        items: [
          { ...item(0), workoutName: 'Late one', scheduledFor: '2026-11-26' },
          { ...item(1), workoutName: 'Extra one' },
        ],
        nextCursor: null,
      }),
    );
    const screen = await render(<HistoryList />);
    await expect
      .element(screen.getByRole('link', { name: /Late one.*Done late, for Thursday/ }))
      .toBeVisible();
    await expect.element(screen.getByRole('link', { name: /Extra one.*Extra/ })).toBeVisible();
  });

  it('invites a first workout when there is no history', async () => {
    fetchMock.mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
    const screen = await render(<HistoryList />);
    await expect.element(screen.getByText('Your history will be here')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Start workout' })).toBeVisible();
  });

  it('shows skeleton rows while the first page loads', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const screen = await render(<HistoryList />);
    await expect
      .element(screen.getByRole('region', { name: 'Workout history' }))
      .toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Your history will be here').elements()).toHaveLength(0);
  });

  it('does not claim an empty history offline before anything loaded', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<HistoryList />);
    await expect
      .element(screen.getByText('Older workouts appear when you are online.'))
      .toBeVisible();
    expect(screen.getByText('Your history will be here').elements()).toHaveLength(0);
  });
});
