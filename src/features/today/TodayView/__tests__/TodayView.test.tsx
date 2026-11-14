import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGymMock } from '@/test/mocks';
import { render } from '@/test/render';
import { TodayView } from '../TodayView';

vi.mock('@/api/gym', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  const fetchGym = vi.fn(() => new Promise(() => {}));
  return {
    fetchGym,
    useGymQuery: ({ initialData }: { initialData?: unknown } = {}) =>
      useQuery({ queryKey: ['gym', 'me'], queryFn: fetchGym, initialData }),
  };
});

const PROPS = { displayName: 'John Smith', initialGym: getGymMock() } as const;

afterEach(() => {
  vi.useRealTimers();
});

describe('TodayView', () => {
  it('shows the gym nudge card under the greeting until a gym is saved', async () => {
    const screen = await render(<TodayView {...PROPS} initialGym={null} />);
    await expect.element(screen.getByRole('heading', { name: 'Set up your gym' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Set up' }))
      .toHaveAttribute('href', '/profile/gym');
  });

  it('hides the gym nudge card once a gym is saved', async () => {
    const screen = await render(<TodayView {...PROPS} />);
    await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.element(screen.getByText('Set up your gym')).not.toBeInTheDocument();
  });

  it('greets in one quiet line with the date, without an avatar, above the empty state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 9, 0));
    const screen = await render(<TodayView {...PROPS} />);

    await expect
      .element(screen.getByText('Good morning, John Smith. Friday, November 13'))
      .toBeVisible();
    expect(screen.getByRole('heading', { name: /Good morning/ }).elements()).toHaveLength(0);
    expect(screen.getByRole('img').elements()).toHaveLength(0);
    await expect
      .element(screen.getByRole('heading', { level: 1, name: 'No workouts yet' }))
      .toBeVisible();
    await expect
      .element(screen.getByText('Create your first workout to start training.'))
      .toBeVisible();
    const steps = screen.getByRole('list').getByRole('listitem').elements();
    expect(steps.map((step) => step.textContent)).toEqual([
      '1Pick exercises from the catalog',
      '2Set sets, reps and weight',
      '3Put it on your calendar and train',
    ]);
    await expect
      .element(screen.getByRole('link', { name: 'Browse exercises' }))
      .toHaveAttribute('href', '/library/exercises');
    await expect
      .element(screen.getByRole('link', { name: 'Create your first workout' }))
      .toHaveAttribute('href', '/library/workouts');
  });

  it('greets in the afternoon', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 14, 0));
    const screen = await render(<TodayView {...PROPS} />);

    await expect.element(screen.getByText(/^Good afternoon, John Smith\./)).toBeVisible();
  });

  it('greets in Ukrainian in the evening', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 13, 20, 0));
    const screen = await render(<TodayView {...PROPS} />, { locale: 'uk' });

    await expect
      .element(screen.getByText('Доброго вечора, John Smith. Пʼятниця, 13 листопада'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Створити перше тренування' }))
      .toBeVisible();
  });
});
