import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_SHELL_ID } from '@/features/pwa/constants';
import { openLocalDb } from '@/services/local-db';
import {
  BENCH_ID,
  benchEntry,
  localSession,
  localSet,
  plankEntry,
  resetLocalDbs,
  seedLocal,
} from '@/test/local-session';
import { render, TEST_USER_ID } from '@/test/render';
import { ActiveSession } from '..';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const SESSION = localSession().id;
const db = () => openLocalDb(TEST_USER_ID);
// The summary shows before `finish` stores the last performance.
// Wait for it, or the teardown closes the database during the write.
const finishSettled = () =>
  expect.poll(async () => db().lastPerformance.count()).toBeGreaterThan(0);
const outboxMethods = async () =>
  (await db().outbox.orderBy('seq').toArray()).map((entry) => entry.type);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ item: null })),
  );
  localStorage.clear();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetLocalDbs();
});

describe('ActiveSession', () => {
  it('marks a finished session that waits to sync, until the push (spec 17 AC8)', async () => {
    const finished = localSession({ status: 'completed', finishedAt: new Date().toISOString() });
    await seedLocal(finished, [localSet()]);
    const entry = {
      id: crypto.randomUUID(),
      type: 'session.patch' as const,
      entityId: finished.id,
      payload: { status: 'completed' },
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await db().outbox.add(entry);
    const screen = await render(<ActiveSession sessionId={finished.id} />, { localDb: true });
    const line = screen.getByText('Saved on this device. Will sync when online.');
    await expect.element(line).toBeVisible();

    await db().outbox.clear();
    await expect.element(line).not.toBeInTheDocument();
  });

  it('reads the session id from the address on the shared offline page (spec 16 AC1)', async () => {
    await seedLocal(localSession());
    const before = window.location.pathname;
    window.history.replaceState(null, '', `/session/${SESSION}`);
    try {
      const screen = await render(<ActiveSession sessionId={SESSION_SHELL_ID} />);
      await expect.element(screen.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
    } finally {
      window.history.replaceState(null, '', before);
    }
  });

  it('logs a prefilled set with one tap and starts a 90 s rest (AC2)', async () => {
    await seedLocal(localSession());
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect.element(screen.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'Set 1, reps' })).toHaveValue('8');

    await screen.getByRole('button', { name: 'Check set 1' }).click();
    await expect
      .element(screen.getByRole('button', { name: 'Set 1 done, uncheck' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect.element(screen.getByRole('region', { name: 'Rest' }).first()).toBeVisible();
    await expect.element(screen.getByText('Rest 1:30')).toBeVisible();
    expect(await outboxMethods()).toEqual(['set.put']);
    const set = (await db().setLogs.toArray())[0];
    expect(set).toMatchObject({ reps: 8, weightKg: null, setIndex: 0 });
  });

  it('uses the rest length set last time for the exercise (AC2)', async () => {
    localStorage.setItem(`pampojo:rest:${BENCH_ID}`, '120');
    await seedLocal(localSession());
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await screen.getByRole('button', { name: 'Check set 1' }).click();
    await expect.element(screen.getByText('Rest 2:00')).toBeVisible();
    await screen.getByRole('button', { name: 'Plus 15 seconds' }).first().click();
    await expect.element(screen.getByText('Rest 2:15')).toBeVisible();
    expect(localStorage.getItem(`pampojo:rest:${BENCH_ID}`)).toBe('135');
  });

  it('computes the rest from restEndsAt and counts up past zero (AC3)', async () => {
    const set = localSet();
    await seedLocal(
      localSession({
        restEndsAt: new Date(Date.now() - 10_000).toISOString(),
        restDurationSec: 90,
        restSetId: set.id,
      }),
      [set],
    );
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect.element(screen.getByText('+0:10')).toBeVisible();
    await expect.element(screen.getByText('Time for set 2')).toBeVisible();
  });

  it('prefills from last time and shows it (AC4)', async () => {
    await seedLocal(localSession());
    await db().lastPerformance.put({
      exerciseId: BENCH_ID,
      sessionId: crypto.randomUUID(),
      finishedAt: '2026-11-10T10:00:00.000Z',
      fetchedAt: '2026-11-10T10:00:00.000Z',
      sets: [{ setIndex: 0, weightKg: 80, reps: 6, durationSec: null, distanceM: null }],
      bests: null,
    });
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect.element(screen.getByText('Last time: 80 kg × 6')).toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'Set 1, weight' })).toHaveValue('80');
    await expect.element(screen.getByRole('textbox', { name: 'Set 2, reps' })).toHaveValue('8');
  });

  it('keeps the check disabled until reps are entered; unchecking keeps values and stops the rest (AC11)', async () => {
    const set = localSet();
    await seedLocal(
      localSession({
        exercises: [benchEntry({ targetRepsMin: null, targetRepsMax: null }), plankEntry()],
        restEndsAt: new Date(Date.now() + 60_000).toISOString(),
        restSetId: set.id,
      }),
      [set],
    );
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    const check2 = screen.getByRole('button', { name: 'Check set 2: enter the reps first' });
    await expect.element(check2).toBeDisabled();
    await expect
      .element(screen.getByText('Weight is optional. To check a set, enter the reps.'))
      .toBeVisible();
    await screen.getByRole('textbox', { name: 'Set 2, reps' }).fill('10');
    await expect.element(screen.getByRole('button', { name: 'Check set 2' })).toBeEnabled();

    await screen.getByRole('button', { name: 'Set 1 done, uncheck' }).click();
    await expect.element(screen.getByRole('button', { name: 'Check set 1' })).toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'Set 1, weight' })).toHaveValue('80');
    await expect.element(screen.getByRole('region', { name: 'Rest' })).not.toBeInTheDocument();
    expect(await outboxMethods()).toEqual(['set.delete']);
  });

  it('adds sets up to 20 and removes the last unlogged one (AC12)', async () => {
    await seedLocal(localSession({ exercises: [benchEntry({ plannedSets: 19 }), plankEntry()] }));
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    const add = screen.getByRole('button', { name: 'Add set' });
    await add.click();
    await expect.element(screen.getByRole('textbox', { name: 'Set 20, reps' })).toBeVisible();
    await expect.element(add).toBeDisabled();
    await screen.getByRole('button', { name: 'Remove set' }).click();
    await expect
      .element(screen.getByRole('textbox', { name: 'Set 20, reps' }))
      .not.toBeInTheDocument();
    expect(await outboxMethods()).toEqual(['session.patch', 'session.patch']);
  });

  it('links the current exercise to its details page (spec 14 AC14)', async () => {
    await seedLocal(localSession());
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect
      .element(screen.getByRole('link', { name: 'How to do Bench Press' }))
      .toHaveAttribute('href', `/library/exercises/${BENCH_ID}`);
  });

  it('makes a list row current without leaving the session (spec 14 AC15)', async () => {
    await seedLocal(localSession());
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await screen.getByRole('button', { name: 'All exercises, exercise 1 of 2' }).click();
    await screen
      .getByRole('button', { name: /^Plank/ })
      .first()
      .click();
    await expect.element(screen.getByRole('heading', { name: 'Plank', level: 1 })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'How to do Plank' }))
      .toHaveAttribute('href', expect.stringContaining('/library/exercises/'));
    expect(push).not.toHaveBeenCalled();
  });

  it('removes only exercises without logged sets (AC12)', async () => {
    await seedLocal(localSession(), [localSet()]);
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await screen.getByRole('button', { name: 'All exercises, exercise 1 of 2' }).click();
    await expect
      .element(screen.getByRole('button', { name: 'Remove Plank' }).first())
      .toBeVisible();
    await expect
      .element(screen.getByRole('button', { name: 'Remove Bench Press' }))
      .not.toBeInTheDocument();
    await screen.getByRole('button', { name: 'Remove Plank' }).first().click();
    await expect
      .element(screen.getByRole('button', { name: 'Remove Plank' }))
      .not.toBeInTheDocument();
    expect((await db().sessions.get(SESSION))?.exercises.map((item) => item.exercise.name)).toEqual(
      ['Bench Press'],
    );
  });

  it('asks before finishing with unchecked sets, then shows the summary (AC8)', async () => {
    await seedLocal(localSession(), [
      localSet(),
      localSet({ setIndex: 1, weightKg: 77.5, reps: 6 }),
    ]);
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await screen.getByRole('button', { name: 'Finish' }).click();
    await expect
      .element(
        screen
          .getByRole('dialog', { name: 'Finish the workout?' })
          .getByText("4 sets are not checked. They won't be saved."),
      )
      .toBeVisible();
    await screen
      .getByRole('dialog', { name: 'Finish the workout?' })
      .getByRole('button', { name: 'Finish' })
      .click();
    await expect.element(screen.getByRole('heading', { name: 'Workout finished' })).toBeVisible();
    await expect.element(screen.getByText('1,105 kg')).toBeVisible();
    await expect.element(screen.getByText('2 × 80 kg')).toBeVisible();
    expect((await db().sessions.get(SESSION))?.status).toBe('completed');
    await finishSettled();
  });

  it('offers to discard when nothing is checked, and discarding goes to Today (AC8, AC9)', async () => {
    await seedLocal(localSession());
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await screen.getByRole('button', { name: 'Finish' }).click();
    await screen
      .getByRole('dialog', { name: 'No sets checked' })
      .getByRole('button', { name: 'Discard workout' })
      .click();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/today'));
    expect((await db().sessions.get(SESSION))?.status).toBe('abandoned');
  });

  it('shows the forgotten-session dialog after 12 hours and finishes at the last set (AC10)', async () => {
    const startedAt = new Date(Date.now() - 13 * 3_600_000).toISOString();
    const set = localSet({ completedAt: new Date(Date.now() - 12.5 * 3_600_000).toISOString() });
    await seedLocal(localSession({ startedAt }), [set]);
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect
      .element(
        screen
          .getByRole('dialog', { name: /Unfinished workout from/ })
          .getByText(/Finish it at the time/),
      )
      .toBeVisible();
    await screen
      .getByRole('dialog', { name: /Unfinished workout from/ })
      .getByRole('button', { name: 'Finish' })
      .click();
    await expect.element(screen.getByRole('heading', { name: 'Workout finished' })).toBeVisible();
    expect((await db().sessions.get(SESSION))?.finishedAt).toBe(set.completedAt);
    await finishSettled();
  });

  it('lists the new records in the summary, and hides the row without them (spec 13 AC2)', async () => {
    const finishedAt = new Date().toISOString();
    await seedLocal(
      localSession({
        status: 'completed',
        finishedAt,
        newRecords: [
          { exerciseId: BENCH_ID, type: 'heaviest_weight', value: 90, weightKg: null, reps: null },
          { exerciseId: BENCH_ID, type: 'most_reps', value: 12, weightKg: 80, reps: null },
        ],
      }),
      [localSet({ completedAt: finishedAt })],
    );
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    const records = () => screen.getByRole('region', { name: 'New records' });
    await expect.element(records()).toBeVisible();
    await expect.element(records().getByText('Heaviest weight')).toBeVisible();
    await expect.element(records().getByText('90 kg')).toBeVisible();
    await expect.element(records().getByText('12 × 80 kg')).toBeVisible();
  });

  it('hides the records row when the session has none', async () => {
    const finishedAt = new Date().toISOString();
    await seedLocal(localSession({ status: 'completed', finishedAt, newRecords: [] }), [
      localSet({ completedAt: finishedAt }),
    ]);
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect.element(screen.getByRole('heading', { name: 'Workout finished' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'New records' }).elements()).toHaveLength(0);
  });

  it('shows not found for a session the device and the server do not have', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 })),
    );
    const screen = await render(<ActiveSession sessionId={SESSION} />);
    await expect.element(screen.getByRole('heading', { name: 'Workout not found' })).toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: 'Go to Today' }))
      .toHaveAttribute('href', '/today');
  });
});
