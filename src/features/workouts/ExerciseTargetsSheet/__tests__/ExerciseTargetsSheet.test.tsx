import { describe, expect, it, vi } from 'vitest';
import type { TrackingType } from '@/constants/exercise';
import { render } from '@/test/render';
import { ExerciseTargetsSheet } from '..';
import type { DraftItem } from '../../types';
import { defaultTargets } from '../../utils';

const item = (
  trackingType: TrackingType,
  laterality: 'bilateral' | 'unilateral' = 'bilateral',
): DraftItem => ({
  key: 'k1',
  notes: '',
  exercise: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Fixture',
    trackingType,
    laterality,
    primaryMuscles: ['chest'],
    thumbnailUrl: null,
    isOwn: false,
  },
  targets: defaultTargets(trackingType),
});

const handlers = () => ({
  onOpenChange: vi.fn(),
  onTargets: vi.fn(),
  onNotes: vi.fn(),
  onRemove: vi.fn(),
});

async function fieldLabels(entry: DraftItem) {
  const screen = await render(
    <ExerciseTargetsSheet item={entry} readOnly={false} {...handlers()} />,
  );
  await expect.element(screen.getByRole('dialog', { name: 'Fixture' })).toBeVisible();
  const labels = screen
    .getByRole('textbox')
    .elements()
    .map((node) => (node as HTMLInputElement).labels?.[0]?.textContent);
  await screen.unmount();
  return labels;
}

describe('ExerciseTargetsSheet', () => {
  it('shows the fields of each tracking type and never a rest field (AC3)', async () => {
    expect(await fieldLabels(item('weight_reps'))).toEqual([
      'Sets',
      'Weight, kg',
      'From',
      'To',
      'Note',
    ]);
    expect(await fieldLabels(item('reps'))).toEqual(['Sets', 'From', 'To', 'Note']);
    expect(await fieldLabels(item('time'))).toEqual(['Sets', 'Duration, s', 'Note']);
    expect(await fieldLabels(item('distance'))).toEqual(['Sets', 'Distance, m', 'Note']);
  });

  it('clears a target, rejects values out of range and removes the exercise', async () => {
    const spies = handlers();
    const screen = await render(
      <ExerciseTargetsSheet item={item('weight_reps')} readOnly={false} {...spies} />,
    );
    await screen.getByRole('textbox', { name: 'Sets' }).fill('');
    expect(spies.onTargets).toHaveBeenLastCalledWith('k1', { targetSets: null });

    await screen.getByRole('textbox', { name: 'Weight, kg' }).fill('82,5');
    expect(spies.onTargets).toHaveBeenLastCalledWith('k1', { targetWeightKg: 82.5 });

    await screen.getByRole('textbox', { name: 'Sets' }).fill('25');
    await expect.element(screen.getByText('From 1 to 20')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Done' })).toBeDisabled();

    await screen.getByRole('textbox', { name: 'Note' }).fill('Slow');
    expect(spies.onNotes).toHaveBeenLastCalledWith('k1', 'Slow');
    await expect.element(screen.getByText('All fields are optional.')).toBeVisible();

    await screen.getByRole('button', { name: 'Remove from workout' }).click();
    expect(spies.onRemove).toHaveBeenCalledWith('k1');
  });

  it('hints per side for one-sided exercises', async () => {
    const screen = await render(
      <ExerciseTargetsSheet item={item('time', 'unilateral')} readOnly={false} {...handlers()} />,
    );
    await expect.element(screen.getByText('per side')).toBeVisible();
  });

  it('is read-only offline', async () => {
    const screen = await render(
      <ExerciseTargetsSheet item={item('reps')} readOnly {...handlers()} />,
    );
    await expect.element(screen.getByRole('textbox', { name: 'Sets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from workout' }).elements()).toHaveLength(0);
  });
});
