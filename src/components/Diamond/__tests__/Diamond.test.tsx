import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { Diamond } from '..';

describe('Diamond', () => {
  it('is decorative and marks its muscle family', async () => {
    const screen = await render(
      <div data-testid="host">
        <Diamond tone="muscle" family="back" size="md" />
      </div>,
    );
    const node = screen.getByTestId('host').element().firstElementChild;
    expect(node?.getAttribute('aria-hidden')).toBe('true');
    expect(node?.getAttribute('data-family')).toBe('back');
  });

  it('draws an outline variant without a family', async () => {
    const screen = await render(
      <div data-testid="host">
        <Diamond tone="accent" variant="outline" />
      </div>,
    );
    const node = screen.getByTestId('host').element().firstElementChild;
    expect(node?.hasAttribute('data-family')).toBe(false);
    expect(node?.getAttribute('data-variant')).toBe('outline');
  });
});
