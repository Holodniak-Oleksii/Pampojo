import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '@/api/http';
import { CONNECTIVITY_PING_MS } from '@/constants/sync';
import { isOnline, reportNetworkFailure, resetConnectivity } from '@/services/connectivity';
import { onSyncRequested } from '@/services/sync/request-sync';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetConnectivity();
});

describe('connectivity (spec 17)', () => {
  it('follows navigator.onLine at once (AC1)', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(isOnline()).toBe(false);
  });

  it('goes offline on a failed request while onLine is true, and back online after a ping (AC2)', async () => {
    let up = false;
    fetchMock.mockImplementation(async () => {
      if (!up) throw new TypeError('Failed to fetch');
      return new Response(null, { status: 503 });
    });
    const synced = vi.fn();
    const stop = onSyncRequested(synced);
    vi.useFakeTimers();

    await expect(http('/api/v1/me/profile', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
    expect(isOnline()).toBe(false);

    up = true;
    await vi.advanceTimersByTimeAsync(CONNECTIVITY_PING_MS);
    expect(isOnline()).toBe(true);
    expect(synced).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
    stop();
  });

  it('keeps pinging every 15 s while the ping fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    vi.useFakeTimers();
    reportNetworkFailure();
    await vi.advanceTimersByTimeAsync(0);
    const calls = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CONNECTIVITY_PING_MS);
    expect(fetchMock.mock.calls.length).toBe(calls + 1);
    expect(isOnline()).toBe(false);
  });

  it('goes back online on the browser online event', () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    reportNetworkFailure();
    expect(isOnline()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(isOnline()).toBe(true);
  });
});
