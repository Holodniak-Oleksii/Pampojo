import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, isoWeekday } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { localSession, resetLocalDbs, seedLocal, WORKOUT_ID } from '@/test/local-session';
import { deviceToday, getScheduleRuleMock, getWorkoutListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
import { TodayPlan } from '..';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn<typeof fetch>();

function respond(rules: ScheduleRule[]) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === '/api/v1/workouts') {
      return Response.json({
        items: [
          getWorkoutListItemMock(),
          getWorkoutListItemMock({ id: WORKOUT_ID, name: 'Legs', exerciseCount: 6 }),
        ],
      });
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
  await resetLocalDbs();
});

const legs = (override: Partial<ScheduleRule> = {}) =>
  getScheduleRuleMock({
    id: '00000000-0000-4000-8000-00000000b002',
    workoutId: WORKOUT_ID,
    workout: { id: WORKOUT_ID, name: 'Legs', exerciseCount: 6, deleted: false },
    ...override,
  });

describe('TodayPlan (spec 11 AC6)', () => {
  it("lists today's workouts, to do first, and a done one with its summary link", async () => {
    respond([getScheduleRuleMock(), legs()]);
    await seedLocal(
      localSession({
        status: 'completed',
        scheduledFor: deviceToday(),
        finishedAt: new Date().toISOString(),
      }),
    );
    const screen = await render(<TodayPlan hasWorkouts />);
    await expect.element(screen.getByRole('heading', { name: 'Planned for today' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    await expect.element(screen.getByText('Done')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'View summary' }))
      .toHaveAttribute('href', `/session/${localSession().id}`);
    const names = screen.getByRole('heading', { level: 2 }).elements();
    expect(names.map((node) => node.textContent)).toEqual(['Push Day', 'Legs']);
  });

  it('shows the next planned workout when today is free', async () => {
    const tomorrow = addDays(deviceToday(), 1);
    respond([getScheduleRuleMock({ startDate: tomorrow, weekdays: [isoWeekday(tomorrow)] })]);
    const screen = await render(<TodayPlan hasWorkouts />);
    await expect
      .element(screen.getByRole('heading', { name: 'Nothing planned for today' }))
      .toBeVisible();
    await expect.element(screen.getByText('Next workout')).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'Push Day' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Open calendar' }))
      .toHaveAttribute('href', '/calendar');
  });

  it('keeps the getting-started card with no rules', async () => {
    respond([]);
    const screen = await render(<TodayPlan hasWorkouts />);
    await expect.element(screen.getByRole('heading', { name: 'Workout ready' })).toBeVisible();
  });
});
