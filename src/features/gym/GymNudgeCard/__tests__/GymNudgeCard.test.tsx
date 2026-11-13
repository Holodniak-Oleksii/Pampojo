import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { getGymMock } from '@/test/mocks';
import { render } from '@/test/render';
import { GymNudgeCard } from '../GymNudgeCard';

vi.mock('@/api/gym', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  const fetchGym = vi.fn(() => new Promise(() => {}));
  return {
    fetchGym,
    useGymQuery: ({ initialData }: { initialData?: unknown } = {}) =>
      useQuery({ queryKey: ['gym', 'me'], queryFn: fetchGym, initialData }),
  };
});

function SaveGymButton() {
  const client = useQueryClient();
  return (
    <button type="button" onClick={() => client.setQueryData(['gym', 'me'], getGymMock())}>
      Save fake gym
    </button>
  );
}

describe('GymNudgeCard', () => {
  it('links to the gym page before the first save', async () => {
    const screen = await render(<GymNudgeCard initialGym={null} />);

    await expect.element(screen.getByRole('heading', { name: 'Set up your gym' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Set up' }))
      .toHaveAttribute('href', '/profile/gym');
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing once a gym is saved', async () => {
    const screen = await render(<GymNudgeCard initialGym={getGymMock()} />);
    await expect.element(screen.getByText('Set up your gym')).not.toBeInTheDocument();
  });

  it('disappears when the gym is saved during the visit', async () => {
    const screen = await render(
      <>
        <GymNudgeCard initialGym={null} />
        <SaveGymButton />
      </>,
    );
    await expect.element(screen.getByText('Set up your gym')).toBeVisible();
    await screen.getByRole('button', { name: 'Save fake gym' }).click();
    await expect.element(screen.getByText('Set up your gym')).not.toBeInTheDocument();
  });
});
