import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { SegmentedGauge } from '../SegmentedGauge';

// Blocks are decorative (aria-hidden); the meter carries the value, so count them by test id.
const filledCount = (blocks: Element[]) =>
  blocks.filter((block) => block.getAttribute('data-filled') === 'true').length;

describe('SegmentedGauge', () => {
  it('exposes the value as a labelled meter', async () => {
    const screen = await render(<SegmentedGauge value={82} label="Plan adherence" />);
    const meter = screen.getByRole('meter', { name: 'Plan adherence' });

    await expect.element(meter).toHaveAttribute('aria-valuetext', '82%');
    await expect.element(meter).toHaveAttribute('aria-valuenow', '82');
    await expect.element(screen.getByText('82%')).toBeVisible();
  });

  it('fills 8 of 10 blocks at 82%', async () => {
    const screen = await render(<SegmentedGauge value={82} label="Plan adherence" />);
    const blocks = screen.getByTestId('gauge-block').elements();

    expect(blocks).toHaveLength(10);
    expect(filledCount(blocks)).toBe(8);
  });

  it.each([
    [-5, '0%', 0],
    [140, '100%', 10],
  ])('clamps %s to %s', async (value, text, filled) => {
    const screen = await render(<SegmentedGauge value={value} label="Plan adherence" />);

    await expect
      .element(screen.getByRole('meter', { name: 'Plan adherence' }))
      .toHaveAttribute('aria-valuetext', text);
    expect(filledCount(screen.getByTestId('gauge-block').elements())).toBe(filled);
  });
});
