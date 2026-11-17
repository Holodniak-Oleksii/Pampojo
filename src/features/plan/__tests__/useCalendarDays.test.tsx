import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays } from '@/shared/plan/occurrences';
import { localSession, resetLocalDbs, seedLocal, WORKOUT_ID } from '@/test/local-session';
import { deviceToday, getScheduleRuleMock } from '@/test/mocks';
import { render } from '@/test/render';
import { useCalendarDays } from '../hooks/useCalendarDays';

const fetchMock = vi.fn<typeof fetch>();
const today = deviceToday();
const yesterday = addDays(today, -1);

function Probe() {
  const { days } = useCalendarDays(addDays(today, -3), today);
  const status = days.get(yesterday)?.occurrences[0]?.status ?? 'none';
  return <p>status: {status}</p>;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/schedule-rules') {
      return Response.json({
        items: [getScheduleRuleMock({ workoutId: WORKOUT_ID, startDate: addDays(today, -3) })],
      });
    }
    if (url.pathname === '/api/v1/calendar') return Response.json({ today, days: [] });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

describe('useCalendarDays', () => {
  it('counts a session finished on this device before it syncs (AC11)', async () => {
    const screen = await render(<Probe />);
    await expect.element(screen.getByText('status: missed')).toBeVisible();
    const startedAt = new Date(`${yesterday}T12:00:00`).toISOString();
    await seedLocal(
      localSession({
        scheduledFor: yesterday,
        status: 'completed',
        startedAt,
        finishedAt: new Date(Date.parse(startedAt) + 3_600_000).toISOString(),
      }),
    );
    await expect.element(screen.getByText('status: on_time')).toBeVisible();
  });
});
