import { describe, expect, it, vi } from 'vitest';
import { getGymMock } from '@/test/mocks';
import { render } from '@/test/render';
import { GymProfileRow } from '../GymProfileRow';

vi.mock('@/api/gym', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  const fetchGym = vi.fn(() => new Promise(() => {}));
  return {
    fetchGym,
    useGymQuery: ({ initialData }: { initialData?: unknown } = {}) =>
      useQuery({ queryKey: ['gym', 'me'], queryFn: fetchGym, initialData }),
  };
});

describe('GymProfileRow', () => {
  it('says "Not set up" before the first save and links to the gym page', async () => {
    const screen = await render(<GymProfileRow initialGym={null} />);
    await expect
      .element(screen.getByRole('link', { name: /Gym equipment/ }))
      .toHaveAttribute('href', '/profile/gym');
    await expect
      .element(screen.getByRole('link', { name: /Gym equipment/ }).getByText('Not set up'))
      .toBeVisible();
  });

  it('counts the saved items out of 38', async () => {
    const five = getGymMock({
      equipment: ['barbell', 'dumbbells', 'flat_bench', 'squat_rack', 'cable_station'],
    });
    const screen = await render(<GymProfileRow initialGym={five} />);
    await expect.element(screen.getByText('5 of 38')).toBeVisible();
  });

  it('counts an empty gym as 0 of 38', async () => {
    const screen = await render(<GymProfileRow initialGym={getGymMock({ equipment: [] })} />);
    await expect.element(screen.getByText('0 of 38')).toBeVisible();
  });
});
