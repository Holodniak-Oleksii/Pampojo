import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/api/auth';
import { render } from '@/test/render';
import { LogOutButton } from '../LogOutButton';

vi.mock('@/api/auth', () => ({ authClient: { signOut: vi.fn() } }));
vi.mock('@/features/auth/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth/utils')>()),
  navigateAfterAuth: vi.fn(),
}));

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

  it('removes onboarding drafts once the server has signed out', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
    localStorage.setItem('pampojo:onboarding:user-1', '{}');
    localStorage.setItem('other-key', 'kept');
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();

    await expect.poll(() => localStorage.getItem('pampojo:onboarding:user-1')).toBeNull();
    expect(localStorage.getItem('other-key')).toBe('kept');
    localStorage.removeItem('other-key');
  });

  it('keeps the draft when signing out fails on the network', async () => {
    vi.mocked(authClient.signOut).mockRejectedValue(new TypeError('Failed to fetch'));
    localStorage.setItem('pampojo:onboarding:user-1', '{}');
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();

    await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeEnabled();
    expect(localStorage.getItem('pampojo:onboarding:user-1')).toBe('{}');
    localStorage.removeItem('pampojo:onboarding:user-1');
  });
});
