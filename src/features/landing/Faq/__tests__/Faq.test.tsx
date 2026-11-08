import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from '@/test/render';
import { Faq } from '../Faq';

describe('Faq', () => {
  it('starts with every item collapsed', async () => {
    const screen = await render(<Faq />);

    for (const name of [
      'Is Pampojo free?',
      'Does it work without internet?',
      'Can I use it on iPhone?',
      'How do I share a workout?',
    ]) {
      await expect
        .element(screen.getByRole('button', { name }))
        .toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('keeps a single item open and works with the keyboard', async () => {
    const screen = await render(<Faq />);
    const first = screen.getByRole('button', { name: 'Is Pampojo free?' });
    const second = screen.getByRole('button', { name: 'Does it work without internet?' });

    await first.click();
    await expect.element(first).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByText('Yes. Pampojo is free to use.')).toBeVisible();

    await userEvent.keyboard('{Tab}');
    await expect.element(second).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(second).toHaveAttribute('aria-expanded', 'true');
    await expect.element(first).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard(' ');
    await expect.element(second).toHaveAttribute('aria-expanded', 'false');
  });
});
