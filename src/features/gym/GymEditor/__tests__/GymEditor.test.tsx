import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGym, saveGym } from '@/api/gym';
import { Toaster } from '@/components/ui/sonner';
import { GYM_EQUIPMENT_KEYS } from '@/constants/gym';
import type { Gym } from '@/shared/schemas/gym';
import { getGymMock } from '@/test/mocks';
import { render } from '@/test/render';
import { GymEditor } from '../GymEditor';

vi.mock('@/api/gym', async () => {
  const { useMutation, useQuery, useQueryClient } = await import('@tanstack/react-query');
  const fetchGym = vi.fn();
  const saveGym = vi.fn();
  return {
    fetchGym,
    saveGym,
    useGymQuery: () => useQuery({ queryKey: ['gym', 'me'], queryFn: fetchGym }),
    useSaveGymMutation: () => {
      const client = useQueryClient();
      return useMutation({
        mutationFn: saveGym,
        onSuccess: (gym) => client.setQueryData(['gym', 'me'], gym),
      });
    },
  };
});

const gymWith = (equipment: string[]) => ({ equipment, updatedAt: '2026-11-12T10:00:00Z' }) as Gym;

// Echoes the saved list, like the server.
const echo = (input: { equipment: string[] }) => Promise.resolve(gymWith(input.equipment));

const renderEditor = () =>
  render(
    <>
      <GymEditor />
      <Toaster />
    </>,
  );

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveGym).mockImplementation(echo);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GymEditor first visit', () => {
  it('starts with every item on and saves only on "Save my gym"', async () => {
    vi.mocked(fetchGym).mockResolvedValue(null);
    const screen = await renderEditor();

    await expect.element(screen.getByRole('heading', { name: 'My gym' })).toBeVisible();
    const barbell = screen.getByRole('button', { name: 'Barbell', exact: true });
    await expect.element(barbell).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { pressed: true }).elements()).toHaveLength(
      GYM_EQUIPMENT_KEYS.length,
    );

    await barbell.click();
    await expect.element(barbell).toHaveAttribute('aria-pressed', 'false');
    await wait(500);
    expect(saveGym).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: 'Save my gym' }).click();
    await expect.element(screen.getByText('Gym saved')).toBeVisible();
    expect(vi.mocked(saveGym).mock.calls[0]?.[0]).toEqual({
      equipment: GYM_EQUIPMENT_KEYS.filter((key) => key !== 'barbell'),
    });
    await expect
      .element(screen.getByRole('button', { name: 'Save my gym' }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole('button', { name: 'Barbell', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the error toast and keeps the selection when the first save fails', async () => {
    vi.mocked(fetchGym).mockResolvedValue(null);
    vi.mocked(saveGym).mockRejectedValue(new Error('boom'));
    const screen = await renderEditor();

    await screen.getByRole('button', { name: 'Save my gym' }).click();
    await expect.element(screen.getByText("Couldn't save your gym. Try again.")).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Save my gym' })).toBeVisible();
  });
});

describe('GymEditor autosave', () => {
  it('sends one request with the final list after quick taps and shows the status', async () => {
    vi.mocked(fetchGym).mockResolvedValue(getGymMock({ equipment: ['dumbbells'] }));
    const screen = await renderEditor();

    await screen.getByRole('button', { name: 'Barbell', exact: true }).click();
    await screen.getByRole('button', { name: 'Flat bench' }).click();
    await screen.getByRole('button', { name: 'Kettlebells' }).click();
    await expect.element(screen.getByText('Saving…')).toBeVisible();
    await expect.element(screen.getByText('Saved')).toBeVisible();
    await wait(500);

    expect(saveGym).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveGym).mock.calls[0]?.[0]).toEqual({
      equipment: ['barbell', 'dumbbells', 'kettlebells', 'flat_bench'],
    });
    await expect
      .element(screen.getByRole('button', { name: 'Save my gym' }))
      .not.toBeInTheDocument();
  });

  it('counts "Clear all" and "Select all" as one change', async () => {
    vi.mocked(fetchGym).mockResolvedValue(getGymMock({ equipment: [...GYM_EQUIPMENT_KEYS] }));
    const screen = await renderEditor();
    await screen
      .getByRole('region', { name: 'Free weights' })
      .getByRole('button', { name: 'Clear all' })
      .click();
    await expect.poll(() => vi.mocked(saveGym).mock.calls.length).toBe(1);
    expect(vi.mocked(saveGym).mock.calls[0]?.[0].equipment).toEqual(GYM_EQUIPMENT_KEYS.slice(6));

    await screen
      .getByRole('region', { name: 'Free weights' })
      .getByRole('button', { name: 'Select all' })
      .click();
    await expect.poll(() => vi.mocked(saveGym).mock.calls.length).toBe(2);
    expect(vi.mocked(saveGym).mock.calls[1]?.[0].equipment).toEqual([...GYM_EQUIPMENT_KEYS]);
  });

  it('never sends two requests at once and sends a change made during a flight afterwards', async () => {
    vi.mocked(fetchGym).mockResolvedValue(getGymMock({ equipment: [] }));
    let release: () => void = () => {};
    vi.mocked(saveGym).mockImplementationOnce(
      (input) =>
        new Promise((resolve) => {
          release = () => resolve(gymWith(input.equipment));
        }),
    );
    const screen = await renderEditor();

    await screen.getByRole('button', { name: 'Barbell', exact: true }).click();
    await expect.poll(() => vi.mocked(saveGym).mock.calls.length).toBe(1);
    await screen.getByRole('button', { name: 'Dumbbells' }).click();
    await wait(600);
    expect(saveGym).toHaveBeenCalledTimes(1);

    release();
    await expect.poll(() => vi.mocked(saveGym).mock.calls.length).toBe(2);
    expect(vi.mocked(saveGym).mock.calls[1]?.[0]).toEqual({ equipment: ['barbell', 'dumbbells'] });
    await expect.element(screen.getByText('Saved')).toBeVisible();
  });

  it('restores the saved state and shows the error toast when a save fails', async () => {
    vi.mocked(fetchGym).mockResolvedValue(getGymMock({ equipment: ['barbell'] }));
    vi.mocked(saveGym).mockRejectedValue(new Error('boom'));
    const screen = await renderEditor();
    const barbell = screen.getByRole('button', { name: 'Barbell', exact: true });

    await barbell.click();
    await expect.element(barbell).toHaveAttribute('aria-pressed', 'false');
    await expect.element(screen.getByText("Couldn't save your gym. Try again.")).toBeVisible();
    await expect.element(barbell).toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByText('Saved')).not.toBeInTheDocument();
  });
});

describe('GymEditor states', () => {
  it('shows the load error with Retry', async () => {
    vi.mocked(fetchGym).mockRejectedValueOnce(new Error('boom'));
    const screen = await renderEditor();

    await expect.element(screen.getByText("Couldn't load your gym.")).toBeVisible();
    vi.mocked(fetchGym).mockResolvedValue(null);
    await screen.getByRole('button', { name: 'Retry' }).click();
    await expect.element(screen.getByRole('button', { name: 'Save my gym' })).toBeVisible();
  });

  it('disables every control offline with "Needs internet"', async () => {
    vi.mocked(fetchGym).mockResolvedValue(null);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<GymEditor />);

    await expect.element(screen.getByText('Needs internet').first()).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Save my gym' })).toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Barbell', exact: true }))
      .toBeDisabled();
    await expect
      .element(
        screen.getByRole('region', { name: 'Cables' }).getByRole('button', { name: 'Clear all' }),
      )
      .toBeDisabled();
  });

  it('exposes chips as toggle buttons', async () => {
    vi.mocked(fetchGym).mockResolvedValue(getGymMock({ equipment: ['dumbbells'] }));
    const screen = await renderEditor();

    await expect
      .element(screen.getByRole('button', { name: 'Dumbbells' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(screen.getByRole('button', { name: 'Barbell', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
    await expect
      .element(
        screen
          .getByRole('region', { name: 'Machines' })
          .getByRole('button', { name: 'Select all' }),
      )
      .toBeVisible();
  });
});
