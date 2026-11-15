import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayMonth } from '@/features/plan';
import { addDays } from '@/shared/plan/occurrences';
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

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn<typeof fetch>();

function respond(rules: ScheduleRule[], timeZone?: string) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/me/profile' && timeZone) {
      return Response.json(getProfileMock({ timeZone }));
    }
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === '/api/v1/workouts') {
      return Response.json({ items: [getWorkoutListItemMock()] });
    }
    if (url.pathname === '/api/v1/sessions') return Response.json({ items: [] });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
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
    await expect
      .element(screen.getByRole('heading', { name: /^Today, / }))
      .toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Start', exact: true })).toBeVisible();

    const tomorrow = addDays(today, 1);
    await screen
      .getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', tomorrow)}, 1 planned`) })
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

  it('hides the menu of an ended rule', async () => {
    const today = deviceToday();
    respond([
      getScheduleRuleMock({ startDate: addDays(today, -6), endDate: addDays(today, -1) }),
    ]);
    const screen = await render(<PlanCalendar />);
    const yesterday = addDays(today, -1);
    await expect.element(screen.getByText('Nothing planned on this day.')).toBeVisible();
    await screen
      .getByRole('gridcell', { name: new RegExp(`^${dayMonth('en', yesterday)}, 1 planned`) })
      .click();
    await expect.element(screen.getByText('Every day')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Actions for Push Day' }).elements()).toHaveLength(0);
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
