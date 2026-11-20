import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_DOWNLOAD_VERSION } from '@/constants/sync';
import { openLocalDb } from '@/services/local-db';
import { readSyncMeta } from '@/services/sync';
import { getProfileMock } from '@/test/mocks';
import { localSession, resetLocalDbs } from '@/test/local-session';
import { render, TEST_USER_ID } from '@/test/render';
import { LocalDataGate } from '../LocalDataGate';

vi.mock('@/api/auth', () => ({ authClient: { signOut: vi.fn() } }));

const totals = {
  workouts: 0,
  scheduleRules: 0,
  exercises: 0,
  lastPerformance: 0,
  sessions: 0,
  setLogs: 0,
  measurements: 0,
};

const page = {
  changes: {
    profile: getProfileMock(),
    gym: null,
    gymChanged: true,
    workouts: [],
    scheduleRules: [],
    exercises: [],
    lastPerformance: [],
    sessions: [],
    setLogs: [],
    measurements: [],
  },
  nextCursor: null,
  cursor: 'next-run',
  totals,
};

const renderGate = () =>
  render(
    <LocalDataGate>
      <p>App content</p>
    </LocalDataGate>,
    { localDb: true },
  );

beforeEach(() => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

describe('LocalDataGate (AC10)', () => {
  it('shows the steps while the first download runs', async () => {
    // `http` retries a GET, so after `fail` every request must fail, not only the pending one.
    let stopped = false;
    let pending: (error: Error) => void = () => {};
    const fail = (error: Error) => {
      stopped = true;
      pending(error);
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        stopped
          ? Promise.reject(new TypeError('stop'))
          : new Promise<Response>((_resolve, reject) => (pending = reject)),
      ),
    );
    const screen = await renderGate();
    await expect
      .element(screen.getByRole('heading', { name: 'Preparing your data for the gym' }))
      .toBeVisible();
    await expect.element(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    await expect
      .element(screen.getByRole('listitem').filter({ hasText: 'Profile and gym' }))
      .toHaveAttribute('aria-current', 'step');
    await expect.element(screen.getByText('History for 30 days')).toBeVisible();
    expect(screen.container.textContent).not.toContain('App content');
    // Ends the pull, so its Web Lock does not outlive the test.
    fail(new TypeError('stop'));
    await expect.element(screen.getByRole('alert')).toBeVisible();
  });

  it('renders the app after the download and remembers it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(page)),
    );
    const screen = await renderGate();
    await expect.element(screen.getByText('App content')).toBeVisible();
    const meta = await readSyncMeta(openLocalDb(TEST_USER_ID));
    expect(meta.download.status).toBe('done');
    expect(meta.downloadVersion).toBe(SYNC_DOWNLOAD_VERSION);
    expect(meta.cursor).toBe('next-run');
  });

  it('shows the error with retry and log out on a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const screen = await renderGate();
    await expect
      .element(screen.getByRole('heading', { name: 'Could not load the profile' }))
      .toBeVisible();
    await expect.element(screen.getByRole('alert')).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
    await expect.element(screen.getByText('Not loaded')).toBeVisible();
  });

  it('shows the offline state with no logout when offline and empty', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    const screen = await renderGate();
    await expect
      .element(screen.getByRole('heading', { name: 'The first start needs internet' }))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it('opens the app during the download when the device already holds sessions (an update offline)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await openLocalDb(TEST_USER_ID).sessions.put(localSession());
    const screen = await renderGate();
    await expect.element(screen.getByText('App content')).toBeVisible();
    expect(screen.container.textContent).not.toContain('The first start needs internet');
  });

  it('shows the fallback while it reads the device state, never a blank screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(page)),
    );
    const screen = await render(
      <LocalDataGate fallback={<p>Loading shell</p>}>
        <p>App content</p>
      </LocalDataGate>,
      { localDb: true },
    );
    await expect.element(screen.getByText('App content')).toBeVisible();
  });
});
