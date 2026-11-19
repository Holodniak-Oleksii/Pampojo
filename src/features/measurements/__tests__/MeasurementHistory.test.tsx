import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteMeasurement, fetchMeasurements, putMeasurement } from '@/api/measurements';
import { dayMonth } from '@/features/plan/formatPlanDate';
import { todayIn } from '@/lib/dates';
import { addDays } from '@/shared/plan/occurrences';
import type { Measurement } from '@/shared/schemas/measurement';
import { getProfileMock } from '@/test/mocks';
import { render } from '@/test/render';
import { MeasurementHistory } from '../MeasurementHistory/MeasurementHistory';

vi.mock('@/api/measurements', async () => (await import('./api-mock')).measurementsApiMock());

const today = todayIn('Europe/Kyiv');
const row = (value: number, daysAgo: number): Measurement => ({
  id: crypto.randomUUID(),
  type: 'waist',
  value,
  measuredOn: addDays(today, -daysAgo),
  updatedAt: '2026-11-16T10:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MeasurementHistory', () => {
  it('shows the latest value, the list with changes and 3M by default (AC3, AC12)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row(85.75, 0), row(86.5, 14), row(88, 50)]);
    const screen = await render(
      <MeasurementHistory type="waist" initialProfile={getProfileMock()} />,
    );
    await expect.element(screen.getByRole('heading', { name: 'Waist', level: 1 })).toBeVisible();
    await expect.element(screen.getByText('Waist now')).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: '3M' })).toBeChecked();
    await expect.element(screen.getByText('−0.75 cm')).toBeVisible();
    await expect.element(screen.getByText('−1.5 cm')).toBeVisible();
    await expect
      .element(screen.getByRole('img', { name: /3 measurements/ }))
      .toHaveAttribute(
        'aria-label',
        `Waist: 85.75 cm ${dayMonth('en', today)}, −2.25 cm over 3 months, 3 measurements`,
      );
  });

  it('shows the empty text for a range with no points (AC12)', async () => {
    vi.mocked(fetchMeasurements).mockResolvedValue([row(88, 60)]);
    const screen = await render(
      <MeasurementHistory type="waist" initialProfile={getProfileMock()} />,
    );
    await screen.getByText('1M').click();
    await expect.element(screen.getByText('No measurements in this period.')).toBeVisible();
  });

  it('edits and deletes a measurement, and the list follows (AC4)', async () => {
    const first = row(85.75, 0);
    const older = row(86.5, 14);
    vi.mocked(fetchMeasurements).mockResolvedValue([first, older]);
    vi.mocked(putMeasurement).mockResolvedValue({ ...first, value: 85 });
    const screen = await render(
      <MeasurementHistory type="waist" initialProfile={getProfileMock()} />,
    );

    vi.mocked(fetchMeasurements).mockResolvedValue([{ ...first, value: 85 }, older]);
    await screen.getByRole('button', { name: /85\.75 cm/ }).click();
    const value = screen.getByRole('dialog').getByRole('textbox', { name: 'Waist' });
    await value.fill('85');
    await screen.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect.element(screen.getByRole('button', { name: /85\.0 cm/ })).toBeVisible();
    expect(putMeasurement).toHaveBeenCalledWith(first.id, {
      type: 'waist',
      value: 85,
      measuredOn: first.measuredOn,
    });

    vi.mocked(deleteMeasurement).mockResolvedValue(undefined);
    vi.mocked(fetchMeasurements).mockResolvedValue([older]);
    await screen.getByRole('button', { name: /85\.0 cm/ }).click();
    await screen
      .getByRole('dialog', { name: 'Edit measurement' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await screen
      .getByRole('dialog', { name: 'Delete this measurement?' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await expect.element(screen.getByRole('button', { name: /85\.0 cm/ })).not.toBeInTheDocument();
    expect(deleteMeasurement).toHaveBeenCalledWith(first.id);
  });
});
