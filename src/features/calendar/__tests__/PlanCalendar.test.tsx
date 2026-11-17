import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayMonth } from '@/features/plan';
import { addDays } from '@/shared/plan/occurrences';
import type { CalendarResponse } from '@/shared/schemas/calendar';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { resetLocalDbs } from '@/test/local-session';
import { todayIn } from '@/lib/dates';
import {
  deviceToday,
  getProfileMock,
  getScheduleRuleMock,
  getWorkoutListItemMock,
} from '@/test/mocks';
import { render } from '@/test/render';
import { PlanCalendar } from '../PlanCalendar';

const navigation = vi.hoisted(() => ({ search: '', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const fetchMock = vi.fn<typeof fetch>();
const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function respond(rules: ScheduleRule[], timeZone?: string, days: CalendarResponse['days'] = []) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/me/profile' && timeZone) {
      return Response.json(getProfileMock({ timeZone }));
    }
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === '/api/v1/workouts') {
      return Response.json({ items: [getWorkoutListItemMock()] });
    }
    if (url.pathname === '/api/v1/sessions') return Response.json({ items: [], nextCursor: null });
    if (url.pathname === '/api/v1/calendar') {
      return Response.json({ today: todayIn(timeZone ?? deviceZone()), days });
    }
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  navigation.search = '';
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await resetLocalDbs();
});

describe('PlanCalendar', () => {
  it('offers Start only on today (AC4)', async () => {
    respond([getScheduleRuleMock()]);
    const screen = await render(<PlanCalendar />);
    const today = deviceToday();
    await expect.element(screen.getByRole('heading', { name: /^Today, / })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

    const tomorrow = addDays(today, 1);
    await screen
      .getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', tomorrow)}, planned`) })
      .click();
    await expect
      .element(screen.getByRole('button', { name: 'Actions for Push Day' }))
      .toBeVisible();
    expect(screen.getByRole('button', { name: 'Start', exact: true }).elements()).toHaveLength(0);
  });

  it('shows the empty day and schedules from it', async () => {
    respond([]);
    const screen = await render(<PlanCalendar />);
    await expect.element(screen.getByText('Nothing planned on this day.')).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Schedule workout' }).first())
      .toBeEnabled();
  });

  it('keeps the plan readable but read-only offline (AC9)', async () => {
    respond([getScheduleRuleMock()]);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(<PlanCalendar />);
    await expect.element(screen.getByText('Needs internet to change the schedule.')).toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Schedule workout' }).first())
      .toBeDisabled();
    await expect
      .element(screen.getByRole('button', { name: 'Actions for Push Day' }))
      .toBeDisabled();
    await expect.element(screen.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  });

  it('shows a past planned day as missed, with no schedule actions', async () => {
    const today = deviceToday();
    respond([getScheduleRuleMock({ startDate: addDays(today, -6), endDate: addDays(today, -1) })]);
    const screen = await render(<PlanCalendar />);
    const yesterday = addDays(today, -1);
    await expect.element(screen.getByText('Nothing planned on this day.')).toBeVisible();
    await screen
      .getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', yesterday)}, missed`) })
      .click();
    await expect.element(screen.getByText('Missed', { exact: true })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Make up' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Actions for Push Day' }).elements()).toHaveLength(0);
  });

  it('names the statuses in the cells and lists each count in the summary (AC2)', async () => {
    const today = deviceToday();
    respond([getScheduleRuleMock({ startDate: addDays(today, -2) })]);
    const screen = await render(<PlanCalendar />);
    const before = addDays(today, -2);
    await expect
      .element(
        screen.getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', before)}, missed$`) }),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByRole('gridcell', {
          name: new RegExp(`^${dayMonth('en', today)}, planned, today$`),
        }),
      )
      .toBeInTheDocument();
    // Both missed days fall in this month unless today is the 1st or 2nd.
    if (Number(today.slice(8)) > 2) {
      await expect
        .element(screen.getByRole('listitem').filter({ hasText: '2 missed' }))
        .toBeVisible();
    }
  });

  it('opens a past day with its finished workouts linked to the summary (AC4)', async () => {
    const today = deviceToday();
    const yesterday = addDays(today, -1);
    const startedAt = new Date(`${yesterday}T12:00:00`).toISOString();
    const session = {
      id: '00000000-0000-4000-8000-00000000d001',
      workoutId: '00000000-0000-4000-8000-00000000a001',
      workoutName: 'Push Day',
      scheduledFor: yesterday,
      status: 'completed' as const,
      startedAt,
      finishedAt: new Date(Date.parse(startedAt) + 52 * 60_000).toISOString(),
      setCount: 16,
      kind: 'on_time' as const,
    };
    respond([getScheduleRuleMock({ startDate: addDays(today, -3) })], undefined, [
      { date: yesterday, occurrences: [], sessions: [session] },
    ]);
    const screen = await render(<PlanCalendar />);
    await screen
      .getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', yesterday)}, on time`) })
      .click();
    const link = screen.getByRole('link', { name: /Push Day.*On time.*52 min, 16 sets/ });
    await expect.element(link).toHaveAttribute('href', `/session/${session.id}`);
  });

  it('lists a make-up finished today under today’s plan', async () => {
    const today = deviceToday();
    const missed = addDays(today, -1);
    const startedAt = new Date(Date.now() - 3_600_000).toISOString();
    respond(
      [getScheduleRuleMock({ startDate: missed, endDate: missed, weekdays: [] })],
      undefined,
      [
        {
          date: today,
          occurrences: [],
          sessions: [
            {
              id: '00000000-0000-4000-8000-00000000d002',
              workoutId: '00000000-0000-4000-8000-00000000a001',
              workoutName: 'Push Day',
              scheduledFor: missed,
              status: 'completed',
              startedAt,
              finishedAt: new Date().toISOString(),
              setCount: 12,
              kind: 'late',
            },
          ],
        },
      ],
    );
    const screen = await render(<PlanCalendar />);
    await expect
      .element(screen.getByRole('link', { name: /Push Day.*Done late, for/ }))
      .toHaveAttribute('href', '/session/00000000-0000-4000-8000-00000000d002');
  });

  it('selects today in the profile zone once the profile loads', async () => {
    // UTC+14: on most test clocks its date differs from the device's for part of the day.
    const zone = 'Pacific/Kiritimati';
    respond([], zone);
    const screen = await render(<PlanCalendar />);
    const label = dayMonth('en', todayIn(zone));
    await expect
      .element(screen.getByRole('heading', { name: new RegExp(`^Today, .*${label}$`) }))
      .toBeVisible();
  });
});
