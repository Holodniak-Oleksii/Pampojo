import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authClient } from '@/api/auth';
import Dexie from 'dexie';
import { openLocalDb } from '@/services/local-db';
import { localSession, resetLocalDbs } from '@/test/local-session';
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

  it('warns about an unsent outbox and deletes the local databases after logging out (spec 10 AC14)', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    const db = openLocalDb('00000000-0000-4000-8000-00000000eeee');
    await db.sessions.put(localSession());
    await db.outbox.add({
      id: crypto.randomUUID(),
      method: 'PUT',
      path: '/api/v1/sets/x',
      body: {},
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Log out?' })
          .getByText('Unsynced workout data will be lost. Connect to the internet so it can sync.'),
      )
      .toBeVisible();
    expect(authClient.signOut).not.toHaveBeenCalled();

    await screen
      .getByRole('dialog', { name: 'Log out?' })
      .getByRole('button', { name: 'Log out' })
      .click();
    await vi.waitFor(() => expect(authClient.signOut).toHaveBeenCalledTimes(1));
    await expect
      .poll(async () =>
        (await Dexie.getDatabaseNames()).filter((name) => name.startsWith('pampojo-')),
      )
      .toEqual([]);
    vi.unstubAllGlobals();
    await resetLocalDbs();
  });
});
