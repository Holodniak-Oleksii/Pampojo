import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { FilterSheet } from '../FilterSheet';

function props(activeCount = 0) {
  return {
    muscles: [] as const,
    equipment: [] as const,
    activeCount,
    scopeChips: <button type="button">Mine</button>,
    onToggleMuscle: vi.fn(),
    onEquipmentChange: vi.fn(),
    onClear: vi.fn(),
  };
}

describe('FilterSheet', () => {
  it('names the trigger with the active filter count', async () => {
    const screen = await render(<FilterSheet {...props(3)} />);
    await expect.element(screen.getByRole('button', { name: 'Filters (3)' })).toBeVisible();
  });

  it('holds the scope chips, the muscles and the equipment, and applies taps at once', async () => {
    const handlers = props();
    const screen = await render(<FilterSheet {...handlers} />);
    await screen.getByRole('button', { name: 'Filters' }).click();
    await expect.element(screen.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Mine' })).toBeVisible();
    await screen.getByRole('button', { name: 'Triceps', exact: true }).click();
    expect(handlers.onToggleMuscle).toHaveBeenCalledWith('triceps');
    await screen.getByRole('checkbox', { name: 'Cable' }).click();
    expect(handlers.onEquipmentChange).toHaveBeenCalledWith(['cable']);
    await expect.element(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();

    await screen.getByRole('button', { name: 'Show exercises' }).click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('resets the filters', async () => {
    const handlers = props(2);
    const screen = await render(<FilterSheet {...handlers} />);
    await screen.getByRole('button', { name: 'Filters (2)' }).click();
    await screen.getByRole('button', { name: 'Reset' }).click();
    expect(handlers.onClear).toHaveBeenCalledOnce();
  });
});
