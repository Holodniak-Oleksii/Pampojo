import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/api/auth';
import { render } from '@/test/render';
import { LogOutButton } from '../LogOutButton';

vi.mock('@/api/auth', () => ({ authClient: { signOut: vi.fn() } }));

describe('LogOutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled while signing out', async () => {
    vi.mocked(authClient.signOut).mockImplementation(() => new Promise(() => {}));
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();

    await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeDisabled();
    expect(authClient.signOut).toHaveBeenCalledTimes(1);
  });

  it('stays on the page and can retry after a network failure', async () => {
    let fail: (error: Error) => void = () => {};
    vi.mocked(authClient.signOut).mockImplementationOnce(
      () => new Promise((_, reject) => (fail = reject)),
    );
    const screen = await render(<LogOutButton />);
    const button = screen.getByRole('button', { name: 'Log out' });

    await button.click();
    await expect.element(button).toBeDisabled();
    fail(new TypeError('Failed to fetch'));

    await expect.element(button).toBeEnabled();
    expect(authClient.signOut).toHaveBeenCalledTimes(1);
  });
});
