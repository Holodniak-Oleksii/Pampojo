import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { localSession, localSet, resetLocalDbs, seedLocal } from '@/test/local-session';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { getScheduleRuleMock, getWorkoutListItemMock } from '@/test/mocks';
import { render } from '@/test/render';
import { StartWorkoutSheet } from '..';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<typeof fetch>();

function respond(
  workouts = [getWorkoutListItemMock({ name: 'Push Day', exerciseCount: 5 })],
  rules: ScheduleRule[] = [],
) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/workouts') return Response.json({ items: workouts });
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === '/api/v1/sessions') return Response.json({ items: [], nextCursor: null });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
}

const sheet = () => <StartWorkoutSheet open onOpenChange={() => {}} returnFocusRef={createRef()} />;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  respond();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  await resetLocalDbs();
});

describe('StartWorkoutSheet', () => {
  it('lists workouts to start, with a 0-exercise workout disabled (AC10)', async () => {
    respond([
      getWorkoutListItemMock({ name: 'Push Day', exerciseCount: 5 }),
      getWorkoutListItemMock({
        id: '00000000-0000-4000-8000-00000000a009',
        name: 'Legs',
        exerciseCount: 0,
      }),
    ]);
    const screen = await render(sheet());
    await expect.element(screen.getByRole('dialog', { name: 'Choose workout' })).toBeVisible();
    await expect.element(screen.getByRole('button', { name: /Push Day/ })).toBeEnabled();
    await expect.element(screen.getByRole('button', { name: /Legs/ })).toBeDisabled();
    await expect.element(screen.getByText('0 exercises. Add exercises to start.')).toBeVisible();
  });

  it('disables a workout that is not cached when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const screen = await render(sheet());
    await expect.element(screen.getByRole('button', { name: /Push Day/ })).toBeDisabled();
    await expect.element(screen.getByText('Needs internet')).toBeVisible();
  });

  it('only offers to continue a session in progress (AC10)', async () => {
    await seedLocal(localSession(), [localSet()]);
    const screen = await render(sheet());
    await expect.element(screen.getByRole('dialog', { name: 'Workout in progress' })).toBeVisible();
    await expect.element(screen.getByText('10 min in. 1 of 6 sets')).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Continue Push Day' }))
      .toHaveAttribute('href', `/session/${localSession().id}`);
    await expect
      .element(screen.getByText('To start another workout, finish or discard this one first.'))
      .toBeVisible();
    expect(screen.getByRole('button', { name: /Push Day/ }).elements()).toHaveLength(0);
  });

  it('asks about a forgotten session (AC10)', async () => {
    await seedLocal(
      localSession({ startedAt: new Date(Date.now() - 13 * 3_600_000).toISOString() }),
    );
    const screen = await render(sheet());
    await expect.element(screen.getByText(/Unfinished workout from/)).toBeVisible();
  });

  it('shows the workouts planned for today first, without repeating them (spec 11 AC6)', async () => {
    respond(
      [
        getWorkoutListItemMock({ name: 'Push Day', exerciseCount: 5 }),
        getWorkoutListItemMock({
          id: '00000000-0000-4000-8000-00000000a009',
          name: 'Legs',
          exerciseCount: 6,
        }),
      ],
      [getScheduleRuleMock()],
    );
    const screen = await render(sheet());
    await expect.element(screen.getByRole('heading', { name: 'Planned for today' })).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'All workouts' })).toBeVisible();
    const lists = screen.getByRole('list').elements();
    expect(lists).toHaveLength(2);
    expect(lists[0]?.textContent).toContain('Push Day');
    expect(lists[0]?.textContent).not.toContain('Legs');
    expect(lists[1]?.textContent).toContain('Legs');
    expect(lists[1]?.textContent).not.toContain('Push Day');
  });
});
