import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, mondayOf } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import type { SessionListItem } from '@/shared/schemas/session';
import { resetLocalDbs } from '@/test/local-session';
import { deviceToday, getScheduleRuleMock } from '@/test/mocks';
import { render } from '@/test/render';
import { LastSessionCard, TodayProgress } from '..';

const fetchMock = vi.fn<typeof fetch>();

function respond(rules: ScheduleRule[], last: SessionListItem[] = []) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === '/api/v1/calendar')
      return Response.json({ today: deviceToday(), days: [] });
    if (url.pathname === '/api/v1/sessions')
      return Response.json({ items: last, nextCursor: null });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

describe('TodayProgress', () => {
  it('shows the week with links to the calendar, without the plan adherence', async () => {
    respond([getScheduleRuleMock()]);
    const screen = await render(<TodayProgress />);
    await expect.element(screen.getByRole('heading', { name: 'This week' })).toBeVisible();
    const monday = mondayOf(deviceToday());
    await expect
      .element(screen.getByRole('link').first())
      .toHaveAttribute('href', `/calendar?date=${monday}`);
    expect(screen.getByRole('link').elements()).toHaveLength(7);
    await expect.element(screen.getByText(/^0 of \d done$/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Plan adherence' }).elements()).toHaveLength(0);
  });

  it('is hidden with no plan', async () => {
    respond([]);
    const screen = await render(<TodayProgress />);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByRole('heading', { name: 'This week' }).elements()).toHaveLength(0);
  });
});

describe('LastSessionCard', () => {
  it('shows the latest finished workout with a link to its summary', async () => {
    const yesterday = addDays(deviceToday(), -1);
    respond(
      [],
      [
        {
          id: '00000000-0000-4000-8000-00000000d001',
          workoutId: '00000000-0000-4000-8000-00000000a001',
          workoutName: 'Legs',
          scheduledFor: null,
          status: 'completed',
          startedAt: `${yesterday}T10:00:00.000Z`,
          finishedAt: `${yesterday}T11:05:00.000Z`,
          setCount: 18,
        },
      ],
    );
    const screen = await render(<LastSessionCard />);
    await expect.element(screen.getByText('Legs')).toBeVisible();
    await expect.element(screen.getByText(/1 h 05 min, 18 sets$/)).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'View summary' }))
      .toHaveAttribute('href', '/session/00000000-0000-4000-8000-00000000d001');
  });

  it('is hidden with no finished workout', async () => {
    respond([]);
    const screen = await render(<LastSessionCard />);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByRole('heading', { name: 'Last workout' }).elements()).toHaveLength(0);
  });
});
