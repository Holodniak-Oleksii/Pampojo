import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { StepList } from '..';

describe('StepList', () => {
  it('numbers open steps and marks done ones for screen readers', async () => {
    const screen = await render(
      <StepList
        doneLabel="Done: "
        steps={[{ label: 'Pick', done: true }, { label: 'Set', done: true }, { label: 'Plan' }]}
      />,
    );
    const items = screen.getByRole('listitem').elements();
    expect(items.map((item) => item.textContent)).toEqual(['Done: Pick', 'Done: Set', '3Plan']);
  });
});
