import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartSheetContext } from '@/features/app-shell/StartSheetContext';
import type {
  ExerciseProgressResponse,
  ProgressExerciseItem,
  ProgressExercisesResponse,
} from '@/shared/schemas/progress';
import { render } from '@/test/render';
import { ProgressScreen } from '../ProgressScreen';

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/progress',
  useSearchParams: () => new URLSearchParams(search),
}));

const BENCH = '00000000-0000-4000-8000-0000000000a1';
const PLANK = '00000000-0000-4000-8000-0000000000a2';
const SESSION = '00000000-0000-4000-8000-0000000000c1';

const bench: ProgressExerciseItem = {
  exerciseId: BENCH,
  name: 'Bench Press',
  trackingType: 'weight_reps',
  thumbnailUrl: null,
  lastTrainedAt: '2026-11-16T16:00:00.000Z',
};
const plank: ProgressExerciseItem = {
  exerciseId: PLANK,
  name: 'Plank',
  trackingType: 'time',
  thumbnailUrl: null,
  lastTrainedAt: '2026-11-10T16:00:00.000Z',
};

const point = (date: string, e1rmKg: number) => ({
  sessionId: SESSION,
  date,
  topWeightKg: 80,
  e1rmKg,
  volumeKg: 2000,
  reps: 8,
  durationSec: null,
  distanceM: null,
});

const benchProgress: ExerciseProgressResponse = {
  trackingType: 'weight_reps',
  points: [point('2026-11-02', 92), point('2026-11-09', 96.5), point('2026-11-16', 102.08)],
  records: [
    {
      type: 'heaviest_weight',
      value: 95,
      weightKg: null,
      reps: null,
      sessionId: SESSION,
      date: '2026-11-09',
    },
    {
      type: 'best_e1rm',
      value: 102.08,
      weightKg: 87.5,
      reps: 5,
      sessionId: SESSION,
      date: '2026-11-16',
    },
    {
      type: 'most_reps',
      value: 12,
      weightKg: 60,
      reps: null,
      sessionId: SESSION,
      date: '2026-09-21',
    },
    {
      type: 'best_volume',
      value: 3480,
      weightKg: null,
      reps: null,
      sessionId: SESSION,
      date: '2026-11-02',
    },
  ],
};

const plankProgress: ExerciseProgressResponse = {
  trackingType: 'time',
  points: [
    {
      ...point('2026-11-10', 0),
      e1rmKg: null,
      topWeightKg: null,
      volumeKg: null,
      reps: null,
      durationSec: 75,
    },
  ],
  records: [
    {
      type: 'longest_duration',
      value: 75,
      weightKg: null,
      reps: null,
      sessionId: SESSION,
      date: '2026-11-10',
    },
  ],
};

let list: ProgressExercisesResponse;
const fetchMock = vi.fn<typeof fetch>();
const detailCalls = () =>
  fetchMock.mock.calls.filter(([input]) => /\/progress\/exercises\/[^?]+\?/.test(String(input)));

beforeEach(() => {
  search = '';
  replace.mockReset();
  list = { items: [bench, plank], month: { workouts: 7, volumeKg: 21340 } };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/progress/exercises') return Response.json(list);
    if (url.pathname === `/api/v1/progress/exercises/${BENCH}`) return Response.json(benchProgress);
    if (url.pathname === `/api/v1/progress/exercises/${PLANK}`) return Response.json(plankProgress);
    return Response.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // The online state is shared, so a test that went offline must not leak it.
  window.dispatchEvent(new Event('online'));
});

describe('ProgressScreen', () => {
  it('shows the empty state with Start when nothing was trained (AC5)', async () => {
    list = { items: [], month: { workouts: 0, volumeKg: 0 } };
    const openStart = vi.fn();
    const screen = await render(
      <StartSheetContext.Provider value={openStart}>
        <ProgressScreen />
      </StartSheetContext.Provider>,
    );
    await expect.element(screen.getByRole('heading', { name: 'No progress yet' })).toBeVisible();
    await screen.getByRole('button', { name: 'Start workout' }).click();
    expect(openStart).toHaveBeenCalledOnce();
  });

  it('shows the month, the latest exercise, the chart summary and linked records (AC2, AC8, AC10)', async () => {
    const screen = await render(<ProgressScreen />);
    await expect.element(screen.getByText('21,340 kg')).toBeVisible();
    await expect.element(screen.getByText('Workouts this month')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /Bench Press/ })).toBeVisible();
    await expect
      .element(screen.getByRole('img', { name: /^Estimated 1RM, Bench Press: 102\.1 kg/ }))
      .toHaveAccessibleName(/\+10\.1 kg over 3 months, 3 workouts\.?$/);
    const record = screen.getByRole('link', { name: /Heaviest weight/ });
    await expect.element(record).toHaveAttribute('href', `/session/${SESSION}`);
    await expect.element(screen.getByText('November 16, 87.5 kg × 5')).toBeVisible();
    await expect.element(screen.getByText('12 × 60 kg')).toBeVisible();
  });

  it('lists the trained exercises in the sheet and selects one (AC5, AC6)', async () => {
    const screen = await render(<ProgressScreen />);
    await screen.getByRole('button', { name: /Bench Press/ }).click();
    const sheet = () => screen.getByRole('dialog', { name: 'Exercise' });
    const options = sheet().getByRole('button', { pressed: undefined, name: /Bench Press|Plank/ });
    await expect.element(options.nth(0)).toHaveAccessibleName(/Bench Press/);
    await expect.element(options.nth(1)).toHaveAccessibleName(/Plank/);
    await sheet().getByRole('searchbox').fill('zzz');
    await expect.element(sheet().getByText('Nothing found')).toBeVisible();
    await sheet().getByRole('searchbox').fill('pla');
    await sheet().getByRole('button', { name: /Plank/ }).click();
    expect(replace).toHaveBeenCalledWith(`/progress?exercise=${PLANK}`, { scroll: false });
  });

  it('shows one metric and one record for a time exercise (AC6)', async () => {
    search = `exercise=${PLANK}`;
    const screen = await render(<ProgressScreen />);
    await expect.element(screen.getByRole('link', { name: /Longest time/ })).toBeVisible();
    await expect.element(screen.getByText('Time now')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Metric' }).elements()).toHaveLength(0);
    expect(screen.getByRole('link').elements()).toHaveLength(1);
  });

  // Browser tests load no Tailwind CSS, so the plot has no height: assert the chart by its name.
  it('keeps ranges it loaded and shows them offline (AC9)', async () => {
    const screen = await render(<ProgressScreen />);
    await expect.element(screen.getByRole('img', { name: /Estimated 1RM/ })).toBeInTheDocument();
    await screen.getByText('6M').click();
    await expect.element(screen.getByRole('img', { name: /over 6 months/ })).toBeInTheDocument();
    await screen.getByText('3M').click();
    await expect.element(screen.getByRole('img', { name: /over 3 months/ })).toBeInTheDocument();
    expect(detailCalls()).toHaveLength(2);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await screen.getByText('6M').click();
    await expect.element(screen.getByRole('img', { name: /over 6 months/ })).toBeInTheDocument();
    await screen.getByText('1Y').click();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
    // Records are all-time, so a range with no cache still shows them.
    await expect.element(screen.getByRole('link', { name: /Heaviest weight/ })).toBeVisible();
    expect(detailCalls()).toHaveLength(2);
  });

  it('keeps the records while another range loads', async () => {
    const screen = await render(<ProgressScreen />);
    await expect.element(screen.getByRole('link', { name: /Heaviest weight/ })).toBeVisible();
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    await screen.getByText('1Y').click();
    await expect
      .element(screen.getByRole('img', { name: /Estimated 1RM/ }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: /Heaviest weight/ })).toBeVisible();
  });
});
