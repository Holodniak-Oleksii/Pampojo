import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileKeys } from '@/api/profile';
import { todayIn } from '@/lib/dates';
import { getProfileMock } from '@/test/mocks';
import { planTodayForStart } from '../hooks/usePlanToday';

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A zone far from any test machine, so a device-zone guess would show up as a different date.
const AT = new Date('2026-11-15T23:30:00Z');
const ZONE = 'Pacific/Kiritimati';

describe('planTodayForStart', () => {
  it('uses the cached profile zone', async () => {
    const client = new QueryClient();
    client.setQueryData(profileKeys.me(), getProfileMock({ timeZone: ZONE }));
    expect(await planTodayForStart(client, AT)).toBe(todayIn(ZONE, AT));
  });

  it('loads the profile when it is not cached', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(Response.json(getProfileMock({ timeZone: ZONE })));
    expect(await planTodayForStart(new QueryClient(), AT)).toBe('2026-11-16');
  });

  it('gives no date rather than guessing from the device zone', async () => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await planTodayForStart(new QueryClient(), AT)).toBeNull();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await planTodayForStart(new QueryClient(), AT)).toBeNull();
  });
});
