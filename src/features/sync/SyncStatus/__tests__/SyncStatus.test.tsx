import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { SYNC_MUTATION_TYPE } from '@/constants/sync';
import { openLocalDb } from '@/services/local-db';
import { enqueue } from '@/services/local-db/outbox';
import { updateSyncMeta } from '@/services/sync';
import { resetLocalDbs } from '@/test/local-session';
import { render, TEST_USER_ID } from '@/test/render';
import { SyncStatus } from '..';

const db = () => openLocalDb(TEST_USER_ID);

beforeEach(async () => {
  await page.viewport(390, 844);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetLocalDbs();
});

describe('SyncStatus (spec 17)', () => {
  it('shows the pending count on the pill, online and offline (AC1)', async () => {
    const screen = await render(<SyncStatus />, { localDb: true });
    await expect.element(screen.getByRole('status')).toHaveTextContent('Online');
    await enqueue(db(), { type: SYNC_MUTATION_TYPE.SET_DELETE, entityId: crypto.randomUUID() });
    await expect.element(screen.getByTestId('pending-badge')).toHaveTextContent('1');
    await expect
      .element(screen.getByRole('button', { name: 'Online. 1 change waiting to sync. Open sync' }))
      .toBeVisible();
  });

  it('opens the sheet with the rows, a blocked Sync now and the offline sentence (AC3)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await updateSyncMeta(db(), { lastSyncAt: new Date().toISOString() });
    await enqueue(db(), { type: SYNC_MUTATION_TYPE.SET_DELETE, entityId: crypto.randomUUID() });
    await enqueue(db(), { type: SYNC_MUTATION_TYPE.SET_DELETE, entityId: crypto.randomUUID() });
    const screen = await render(<SyncStatus />, { localDb: true });

    await screen.getByRole('button', { name: /Open sync/ }).click();
    await expect
      .element(screen.getByRole('dialog', { name: 'Sync' }).getByText('2 changes'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('dialog', { name: 'Sync' }).getByText('just now'))
      .toBeVisible();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Sync' })
          .getByText('Sets and measurements are saved on this phone.', { exact: false }),
      )
      .toBeVisible();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Sync' })
          .getByRole('button', { name: 'Sync now. Needs internet' }),
      )
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the last error with its reason and syncs online (AC3)', async () => {
    await updateSyncMeta(db(), {
      lastError: { code: 'SESSION_NOT_FOUND', at: new Date().toISOString() },
    });
    const fetchMock = vi.fn(async () => Response.json({ changes: {}, cursor: null }));
    vi.stubGlobal('fetch', fetchMock);
    const screen = await render(<SyncStatus />, { localDb: true });

    await screen.getByRole('button', { name: /Open sync/ }).click();
    await expect
      .element(screen.getByRole('dialog', { name: 'Sync' }).getByText('Everything is synced'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('dialog', { name: 'Sync' }).getByText('One change was not saved'))
      .toBeVisible();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Sync' })
          .getByText(
            'The workout was deleted on another device, so the server did not accept the change.',
            { exact: false },
          ),
      )
      .toBeVisible();
    await screen
      .getByRole('dialog', { name: 'Sync' })
      .getByRole('button', { name: 'Sync now' })
      .click();
    await expect.poll(() => fetchMock.mock.calls.length).toBeGreaterThan(0);
  });
});
