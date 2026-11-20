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
    // The button turns off at once, but `signOut` runs only after the async outbox flush.
    await expect.poll(() => vi.mocked(authClient.signOut).mock.calls.length).toBe(1);
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
    // `fail` is set only when `signOut` starts, after the async outbox flush.
    await expect.poll(() => vi.mocked(authClient.signOut).mock.calls.length).toBe(1);
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

  it('deletes the cached app pages once the server has signed out (spec 15 AC5)', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
    const cache = await caches.open('pampojo-pages');
    await cache.put('/today', new Response('<html>user 1</html>'));
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();

    await expect.poll(() => caches.has('pampojo-pages')).toBe(false);
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

  async function seedPending() {
    const db = openLocalDb('00000000-0000-4000-8000-00000000eeee');
    await db.sessions.put(localSession());
    const id = crypto.randomUUID();
    await db.outbox.add({
      id,
      type: 'set.put',
      entityId: crypto.randomUUID(),
      payload: {},
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    return id;
  }

  it('asks to sync first and logs out after a sync that empties the outbox (spec 17 AC7)', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({ data: { success: true }, error: null });
    let networkUp = false;
    const mutationId = await seedPending();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (!networkUp) throw new TypeError('Failed to fetch');
        if (String(input).includes('/sync/push')) {
          return Response.json({ results: [{ id: mutationId, status: 'applied' }] });
        }
        return Response.json({ ok: true });
      }),
    );
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Sync your changes first' })
          .getByText(
            '1 change is not on the server yet. Workouts that did not sync will be lost if you log out.',
          ),
      )
      .toBeVisible();
    expect(
      screen
        .getByRole('dialog', { name: 'Sync your changes first' })
        .getByRole('button', { name: /Log out/ })
        .elements(),
    ).toHaveLength(0);
    expect(authClient.signOut).not.toHaveBeenCalled();

    networkUp = true;
    await screen
      .getByRole('dialog', { name: 'Sync your changes first' })
      .getByRole('button', { name: 'Sync now' })
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

  it('keeps the dialog with an error when the sync fails (spec 17 AC7)', async () => {
    await seedPending();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const screen = await render(<LogOutButton />);

    await screen.getByRole('button', { name: 'Log out' }).click();
    await screen
      .getByRole('dialog', { name: 'Sync your changes first' })
      .getByRole('button', { name: 'Sync now' })
      .click();
    await expect
      .element(screen.getByRole('dialog', { name: 'Sync your changes first' }).getByRole('alert'))
      .toHaveTextContent("Couldn't sync. Try again.");
    expect(authClient.signOut).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    await resetLocalDbs();
  });

  it('is blocked offline (spec 17 AC7)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<LogOutButton />);
    const button = screen.getByRole('button', { name: 'Log out. Needs internet' });

    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    // Playwright treats aria-disabled as disabled; a real tap still reaches the button.
    await button.click({ force: true });
    expect(authClient.signOut).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
