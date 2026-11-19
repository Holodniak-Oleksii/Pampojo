import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMeasurements, putMeasurement } from '@/api/measurements';
import { todayIn } from '@/lib/dates';
import { addDays } from '@/shared/plan/occurrences';
import type { Measurement } from '@/shared/schemas/measurement';
import type { Profile } from '@/shared/schemas/profile';
import { getProfileMock } from '@/test/mocks';
import { render } from '@/test/render';
import { useProfileMeasurements } from '../MeasurementsSection/MeasurementsSection';

vi.mock('@/api/measurements', async () => (await import('./api-mock')).measurementsApiMock());

const today = todayIn('Europe/Kyiv');
const row = (type: Measurement['type'], value: number, daysAgo = 0): Measurement => ({
  id: crypto.randomUUID(),
  type,
  value,
  measuredOn: addDays(today, -daysAgo),
  updatedAt: '2026-11-16T10:00:00Z',
});

function Harness({ profile }: { profile: Profile }) {
  const { bmi, measurements } = useProfileMeasurements(profile);
  return (
    <div>
      {bmi}
      {measurements}
    </div>
  );
}

const profile = getProfileMock({ heightCm: 183 });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useProfileMeasurements', () => {
  it('shows the BMI, the category and the weight trend (AC1, AC11)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([
      row('weight', 82.4),
      row('weight', 83, 30),
      row('weight', 84.1, 60),
      row('weight', 90, 100),
    ]);
    const screen = await render(<Harness profile={profile} />);
    await expect.element(screen.getByText('24.6')).toBeVisible();
    await expect.element(screen.getByText('Normal')).toBeVisible();
    await expect
      .element(screen.getByRole('img', { name: 'Weight over 90 days: from 84.1 kg to 82.4 kg' }))
      .toBeVisible();
  });

  it('hides the trend with one weight in 90 days (AC11)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('weight', 82.4), row('weight', 85, 120)]);
    const screen = await render(<Harness profile={profile} />);
    await expect.element(screen.getByText('24.6')).toBeVisible();
    await expect
      .element(screen.getByRole('img', { name: /Weight over 90 days/ }))
      .not.toBeInTheDocument();
  });

  it('shows the skeletons while the measurements load', async () => {
    vi.mocked(fetchMeasurements).mockImplementation(() => new Promise(() => {}));
    const screen = await render(<Harness profile={profile} />);
    await expect
      .element(screen.getByLabelText('Measurements'))
      .toHaveAttribute('aria-busy', 'true');
  });

  it('asks for a weight when there is none (AC5)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('waist', 86.5)]);
    const screen = await render(<Harness profile={profile} />);
    await expect.element(screen.getByText('Add your weight to see your BMI.')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Add weight' })).toBeVisible();
  });

  it('shows 13 figure labels and the two rows, with "—" for missing values (AC10, AC19)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([
      row('biceps_right', 38.75),
      row('shoulders', 122.25),
      row('weight', 82.4),
      row('weight', 83, 7),
    ]);
    const screen = await render(<Harness profile={profile} />);
    const biceps = screen.getByRole('link', { name: 'Biceps, right: 38.75 cm' });
    await expect.element(biceps).toHaveAttribute('href', '/profile/measurements/biceps_right');
    await expect.element(screen.getByRole('link', { name: 'Shoulders: 122.25 cm' })).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Calf, left: —' })).toBeVisible();
    const links = screen.getByRole('link').elements();
    expect(links).toHaveLength(15);
    await expect
      .element(screen.getByRole('link', { name: /Body fat/ }).getByText('—'))
      .toBeVisible();
    expect(document.querySelector('[data-figure="male"]')).not.toBeNull();
  });

  it('shows the change in the rows but not on the chips (AC3)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([
      row('weight', 82.4),
      row('weight', 83, 7),
      row('chest', 104.25),
      row('chest', 103, 7),
    ]);
    const screen = await render(<Harness profile={profile} />);
    await expect
      .element(screen.getByRole('link', { name: /^Weight/ }).getByText('−0.6 kg'))
      .toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Chest: 104.25 cm' })).toBeVisible();
    await expect.element(screen.getByText('+1.25 cm')).not.toBeInTheDocument();
  });

  it('shows the female figure (AC19)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('waist', 68.5)]);
    const screen = await render(<Harness profile={getProfileMock({ sex: 'female' })} />);
    await expect.element(screen.getByRole('link', { name: 'Waist: 68.5 cm' })).toBeVisible();
    expect(document.querySelector('[data-figure="female"]')).not.toBeNull();
  });

  it('shows the empty state with no girths', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('weight', 82.4)]);
    const screen = await render(<Harness profile={profile} />);
    await expect
      .element(screen.getByRole('heading', { name: 'No measurements yet' }))
      .toBeVisible();
  });

  it('updates the BMI after a saved weight (AC1)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('weight', 82.4), row('waist', 86)]);
    vi.mocked(putMeasurement).mockResolvedValue(row('weight', 90));
    const screen = await render(<Harness profile={profile} />);
    await expect.element(screen.getByText('24.6')).toBeVisible();
    vi.mocked(fetchMeasurements).mockResolvedValue([row('weight', 90), row('waist', 86)]);
    await screen.getByRole('button', { name: 'Add measurement' }).first().click();
    await screen.getByRole('textbox', { name: 'Weight' }).fill('90');
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect.element(screen.getByText('26.9')).toBeVisible();
    expect(vi.mocked(putMeasurement)).toHaveBeenCalledWith(expect.any(String), {
      type: 'weight',
      value: 90,
      measuredOn: today,
    });
  });

  it('disables writes offline (AC13)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row('weight', 82.4)]);
    const screen = await render(<Harness profile={profile} />);
    await expect.element(screen.getByText('24.6')).toBeVisible();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await expect
      .element(screen.getByRole('button', { name: 'Add measurement' }).first())
      .toBeDisabled();
    await expect.element(screen.getByText('Needs internet').first()).toBeVisible();
    await expect.element(screen.getByText('24.6')).toBeVisible();
  });
});
