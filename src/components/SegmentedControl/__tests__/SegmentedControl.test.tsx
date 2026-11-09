import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { SegmentedControl } from '../SegmentedControl';

function Harness() {
  const [value, setValue] = useState<'metric' | 'imperial' | null>(null);
  return (
    <SegmentedControl
      name="units"
      legend="Units"
      options={[
        { value: 'metric', label: 'Metric' },
        { value: 'imperial', label: 'Imperial' },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a labelled radio group with nothing selected by default', async () => {
    const screen = await render(<Harness />);

    await expect.element(screen.getByRole('group', { name: 'Units' })).toBeVisible();
    await expect.element(screen.getByRole('radio', { name: 'Metric' })).not.toBeChecked();
    await expect.element(screen.getByRole('radio', { name: 'Imperial' })).not.toBeChecked();
  });

  it('selects an option on click', async () => {
    const screen = await render(<Harness />);

    await screen.getByText('Imperial').click();

    await expect.element(screen.getByRole('radio', { name: 'Imperial' })).toBeChecked();
  });
});
