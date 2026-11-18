import { beforeEach, describe, expect, it, vi } from 'vitest';
import { putMeasurement } from '@/api/measurements';
import { getProfileMock } from '@/test/mocks';
import { render } from '@/test/render';
import { AddMeasurementSheet } from '../AddMeasurementSheet/AddMeasurementSheet';

vi.mock('@/api/measurements', async () => (await import('./api-mock')).measurementsApiMock());

const today = '2026-11-16';

async function renderSheet(override: Partial<Parameters<typeof AddMeasurementSheet>[0]> = {}) {
  const onOpenChange = vi.fn();
  const screen = await render(
    <AddMeasurementSheet
      open
      onOpenChange={onOpenChange}
      profile={getProfileMock()}
      today={today}
      latest={new Map()}
      {...override}
    />,
  );
  return { screen, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddMeasurementSheet', () => {
  it('keeps Save disabled while every field is empty (AC8)', async () => {
    const { screen } = await renderSheet();
    await expect.element(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await screen.getByRole('textbox', { name: 'Waist' }).fill('86,5');
    await expect.element(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('sends one PUT per filled field and nothing for empty ones (AC8)', async () => {
    vi.mocked(putMeasurement).mockResolvedValue({} as never);
    const { screen, onOpenChange } = await renderSheet();
    await screen.getByRole('textbox', { name: 'Waist' }).fill('86,5');
    await screen.getByRole('textbox', { name: 'Biceps, left' }).fill('38.25');
    await screen.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(vi.mocked(putMeasurement).mock.calls.map(([, input]) => input)).toEqual([
      { type: 'waist', value: 86.5, measuredOn: today },
      { type: 'biceps_left', value: 38.25, measuredOn: today },
    ]);
  });

  it('shows the limit, the decimals and the future date errors (AC9)', async () => {
    const { screen } = await renderSheet();
    await screen.getByRole('textbox', { name: 'Waist' }).fill('300');
    await screen.getByRole('textbox', { name: 'Weight' }).fill('82,45');
    await screen.getByLabelText('Date').fill('2026-11-20');
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect.element(screen.getByText('From 10 to 250 cm.')).toBeVisible();
    await expect.element(screen.getByText('At most 1 decimal place.')).toBeVisible();
    await expect.element(screen.getByText("The date can't be in the future.")).toBeVisible();
    expect(putMeasurement).not.toHaveBeenCalled();
  });

  it('asks for a date when the date is empty and shows it in the app language', async () => {
    const { screen } = await renderSheet();
    await expect.element(screen.getByText('November 16, 2026')).toBeVisible();
    await screen.getByLabelText('Date').fill('');
    await screen.getByRole('textbox', { name: 'Waist' }).fill('86');
    await screen.getByRole('button', { name: 'Save' }).click();
    await expect.element(screen.getByText('Choose a date.')).toBeVisible();
    expect(putMeasurement).not.toHaveBeenCalled();
  });

  it('converts imperial input before it saves (AC9)', async () => {
    vi.mocked(putMeasurement).mockResolvedValue({} as never);
    const { screen } = await renderSheet({ profile: getProfileMock({ unitSystem: 'imperial' }) });
    await screen.getByRole('textbox', { name: 'Weight' }).fill('176');
    await screen.getByRole('textbox', { name: 'Waist' }).fill('15,25');
    await screen.getByRole('button', { name: 'Save' }).click();
    await vi.waitFor(() => expect(putMeasurement).toHaveBeenCalledTimes(2));
    expect(vi.mocked(putMeasurement).mock.calls.map(([, input]) => input)).toEqual([
      { type: 'weight', value: 79.8, measuredOn: today },
      { type: 'waist', value: 38.74, measuredOn: today },
    ]);
  });

  it('shows the latest values as placeholders and focuses the asked field', async () => {
    const { screen } = await renderSheet({
      focusType: 'hips',
      latest: new Map([
        [
          'hips',
          { id: crypto.randomUUID(), type: 'hips', value: 101.5, measuredOn: today, updatedAt: '' },
        ],
      ]),
    });
    const hips = screen.getByRole('textbox', { name: 'Hips' });
    await expect.element(hips).toHaveAttribute('placeholder', '101.5');
    await expect.element(hips).toHaveFocus();
  });
});
