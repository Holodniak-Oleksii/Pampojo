import { describe, expect, it } from 'vitest';
import { render } from '@/test/render';
import { PasswordInput } from '../PasswordInput';

describe('PasswordInput', () => {
  it('toggles visibility with an accessible button', async () => {
    const screen = await render(
      <>
        <label htmlFor="password">Password</label>
        <PasswordInput id="password" showLabel="Show password" hideLabel="Hide password" />
      </>,
    );
    const input = screen.getByLabelText('Password', { exact: true });

    await expect.element(input).toHaveAttribute('type', 'password');
    await screen.getByRole('button', { name: 'Show password' }).click();
    await expect.element(input).toHaveAttribute('type', 'text');
    await expect
      .element(screen.getByRole('button', { name: 'Hide password' }))
      .toHaveAttribute('aria-pressed', 'true');
  });
});
