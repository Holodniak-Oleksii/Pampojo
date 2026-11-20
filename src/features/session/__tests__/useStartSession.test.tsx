import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MakeUpPromptProvider } from '@/features/plan';
import {
  fromWorkoutResponse,
  openLocalDb,
  putLocalProfile,
  putLocalRules,
} from '@/services/local-db';
import { addDays, isoWeekday } from '@/shared/plan/occurrences';
import type { ScheduleRule } from '@/shared/schemas/plan';
import { resetLocalDbs } from '@/test/local-session';
import { deviceToday, getProfileMock, getScheduleRuleMock, getWorkoutMock } from '@/test/mocks';
import { render, TEST_USER_ID } from '@/test/render';
import { useStartSession } from '../hooks/useStartSession';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn<typeof fetch>();
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = deviceToday();
const yesterday = addDays(today, -1);
const workout = getWorkoutMock();

function respond(rules: ScheduleRule[]) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/v1/me/profile')
      return Response.json(getProfileMock({ timeZone: zone }));
    if (url.pathname === '/api/v1/schedule-rules') return Response.json({ items: rules });
    if (url.pathname === `/api/v1/workouts/${workout.id}`) return Response.json(workout);
    if (url.pathname === '/api/v1/calendar') return Response.json({ today, days: [] });
    if (url.pathname === '/api/v1/sessions') return Response.json({ items: [], nextCursor: null });
    if (url.pathname.endsWith('/last-performance')) return Response.json({ item: null });
    return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  });
}

/** Weekly on yesterday's weekday from a week ago: yesterday is missed, today is free. */
const missedYesterday = () =>
  getScheduleRuleMock({ startDate: addDays(today, -7), weekdays: [isoWeekday(yesterday)] });

function Starter() {
  const { start } = useStartSession();
  return (
    <button type="button" onClick={() => void start(workout.id)}>
      Go
    </button>
  );
}

/** The device copy that a pull would have written: the start reads only Dexie. */
async function seedDevice(rules: ScheduleRule[]) {
  const db = openLocalDb(TEST_USER_ID);
  await putLocalProfile(db, getProfileMock({ timeZone: zone }));
  await putLocalRules(db, rules);
  await db.workouts.put(fromWorkoutResponse(workout));
  await db.exercises.bulkPut(
    workout.exercises.map(({ exercise }) => ({
      id: exercise.id,
      isOwn: 0 as const,
      primaryMuscles: exercise.primaryMuscles,
      secondaryMuscles: [],
      equipment: [],
      movementPattern: null,
      mechanic: null,
      laterality: exercise.laterality,
      trackingType: exercise.trackingType,
      difficulty: null,
      popularity: null,
      frames: [],
      gymEquipment: [],
      sourceExerciseId: null,
      updatedAt: workout.updatedAt,
      deletedAt: null,
      translations: [
        {
          locale: 'en' as const,
          name: exercise.name,
          aliases: [],
          description: '',
          instructions: [],
          commonMistakes: [],
          searchName: exercise.name.toLowerCase(),
          searchAliases: '',
        },
      ],
    })),
  );
}

async function setup(rules: ScheduleRule[]) {
  respond(rules);
  await seedDevice(rules);
  return render(
    <MakeUpPromptProvider>
      <Starter />
    </MakeUpPromptProvider>,
  );
}

async function storedSessions() {
  return openLocalDb(TEST_USER_ID).sessions.toArray();
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

describe('useStartSession make-up (AC6)', () => {
  it('offers the missed day and links the session when the user makes it up', async () => {
    const screen = await setup([missedYesterday()]);
    await screen.getByRole('button', { name: 'Go' }).click();
    await expect
      .element(screen.getByRole('dialog', { name: /^Make up .*'s Push Day\?$/ }))
      .toBeVisible();
    await screen.getByRole('button', { name: 'Yes, make it up' }).click();
    await expect.poll(async () => (await storedSessions())[0]?.scheduledFor).toBe(yesterday);
  });

  it('starts a plain workout with no link', async () => {
    const screen = await setup([missedYesterday()]);
    await screen.getByRole('button', { name: 'Go' }).click();
    await screen.getByRole('button', { name: 'No, just a workout' }).click();
    await expect.poll(async () => (await storedSessions()).length).toBe(1);
    expect((await storedSessions())[0]?.scheduledFor).toBeNull();
  });

  it('starts nothing when the dialog is closed', async () => {
    const screen = await setup([missedYesterday()]);
    await screen.getByRole('button', { name: 'Go' }).click();
    await expect.element(screen.getByRole('dialog')).toBeVisible();
    await screen.getByRole('button', { name: 'Close' }).click();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(await storedSessions()).toHaveLength(0);
  });

  it('links to today with no dialog when the workout is planned today', async () => {
    const screen = await setup([getScheduleRuleMock({ startDate: addDays(today, -7) })]);
    await screen.getByRole('button', { name: 'Go' }).click();
    await expect.poll(async () => (await storedSessions())[0]?.scheduledFor).toBe(today);
  });

  it('does not offer a day after its window', async () => {
    // Missed eight days ago, and the window lasts at most seven.
    const old = addDays(today, -8);
    const screen = await setup([
      getScheduleRuleMock({ startDate: old, endDate: old, weekdays: [] }),
    ]);
    await screen.getByRole('button', { name: 'Go' }).click();
    await expect.poll(async () => (await storedSessions()).length).toBe(1);
    expect((await storedSessions())[0]?.scheduledFor).toBeNull();
  });
});
