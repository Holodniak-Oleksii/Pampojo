import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  computeCalendar,
  findMakeUpDate,
  lateWindowEnd,
  summarize,
  type CalendarDay,
  type StatusRule,
  type StatusSession,
} from '../statuses';

const PUSH = '00000000-0000-4000-8000-000000000001';
const LEGS = '00000000-0000-4000-8000-000000000002';

const rule = (overrides: Partial<StatusRule> = {}): StatusRule => ({
  id: 'rule-push',
  workoutId: PUSH,
  workoutName: 'Push Day',
  startDate: '2026-11-02',
  endDate: null,
  weekdays: [1, 4],
  intervalWeeks: 1,
  ...overrides,
});

let seq = 0;
const session = (overrides: Partial<StatusSession> = {}): StatusSession => ({
  id: `session-${(seq += 1)}`,
  workoutId: PUSH,
  workoutName: 'Push Day',
  scheduledFor: null,
  status: 'completed',
  startedAt: '2026-11-02T17:00:00Z',
  finishedAt: '2026-11-02T18:00:00Z',
  setCount: 16,
  ...overrides,
});

const byDate = (days: CalendarDay[]) => new Map(days.map((day) => [day.date, day]));

function run(
  sessions: StatusSession[],
  {
    rules = [rule()],
    from = '2026-11-01',
    to = '2026-11-30',
    today = '2026-11-17',
    timeZone = 'UTC',
  } = {},
) {
  return byDate(computeCalendar({ rules, sessions, from, to, today, timeZone }));
}

describe('lateWindowEnd', () => {
  it('ends the day before the next occurrence of the same workout', () => {
    // Monday 16 → next Push Day is Thursday 19.
    expect(lateWindowEnd([rule()], PUSH, '2026-11-16')).toBe('2026-11-18');
  });

  it('is at most 7 days', () => {
    expect(lateWindowEnd([rule({ weekdays: [1] })], PUSH, '2026-11-02')).toBe('2026-11-08');
    expect(lateWindowEnd([rule({ weekdays: [], endDate: '2026-11-02' })], PUSH, '2026-11-02')).toBe(
      '2026-11-09',
    );
  });

  it('is empty when the next occurrence is the next day', () => {
    expect(lateWindowEnd([rule({ weekdays: [1, 2] })], PUSH, '2026-11-02')).toBeNull();
  });

  it('looks at every rule of the workout, and only that workout', () => {
    const rules = [
      rule({ weekdays: [1] }),
      rule({ id: 'one-off', weekdays: [], startDate: '2026-11-05', endDate: '2026-11-05' }),
      rule({ id: 'legs', workoutId: LEGS, workoutName: 'Legs', weekdays: [2] }),
    ];
    expect(lateWindowEnd(rules, PUSH, '2026-11-02')).toBe('2026-11-04');
  });
});

describe('computeCalendar', () => {
  it('marks an occurrence done on time when the session starts on its date', () => {
    const done = session({ scheduledFor: '2026-11-02' });
    const days = run([done]);
    expect(days.get('2026-11-02')?.occurrences[0]).toMatchObject({
      status: 'on_time',
      sessionId: done.id,
    });
    expect(days.get('2026-11-02')?.sessions[0]?.kind).toBe('on_time');
  });

  it('marks an occurrence done late when the session starts later in the window', () => {
    const late = session({ scheduledFor: '2026-11-05', startedAt: '2026-11-06T17:00:00Z' });
    const days = run([late]);
    expect(days.get('2026-11-05')?.occurrences[0]?.status).toBe('late');
    expect(days.get('2026-11-05')?.sessions).toHaveLength(0);
    expect(days.get('2026-11-06')?.sessions[0]).toMatchObject({ id: late.id, kind: 'late' });
  });

  it('does not count a session after the window, and it shows as extra', () => {
    // Thursday 5's window ends on Sunday 8 (next Push Day is Monday 9).
    const tooLate = session({ scheduledFor: '2026-11-05', startedAt: '2026-11-09T17:00:00Z' });
    const days = run([tooLate]);
    expect(days.get('2026-11-05')?.occurrences[0]?.status).toBe('missed');
    expect(days.get('2026-11-09')?.sessions[0]?.kind).toBe('extra');
  });

  it('marks past occurrences with no session missed, and today and later planned', () => {
    const days = run([]);
    expect(days.get('2026-11-16')?.occurrences[0]?.status).toBe('missed');
    expect(days.get('2026-11-19')?.occurrences[0]?.status).toBe('planned');
    const today = run([], { rules: [rule({ weekdays: [2] })] });
    expect(today.get('2026-11-17')?.occurrences[0]?.status).toBe('planned');
  });

  it('lets the session that started first fulfil the occurrence', () => {
    const first = session({ scheduledFor: '2026-11-02', startedAt: '2026-11-02T08:00:00Z' });
    const second = session({ scheduledFor: '2026-11-02', startedAt: '2026-11-02T19:00:00Z' });
    const days = run([second, first]);
    expect(days.get('2026-11-02')?.occurrences[0]?.sessionId).toBe(first.id);
    const kinds = Object.fromEntries(
      (days.get('2026-11-02')?.sessions ?? []).map((item) => [item.id, item.kind]),
    );
    expect(kinds).toEqual({ [first.id]: 'on_time', [second.id]: 'extra' });
  });

  it('ignores in-progress and abandoned sessions', () => {
    const days = run([
      session({
        scheduledFor: '2026-11-16',
        startedAt: '2026-11-16T17:00:00Z',
        status: 'in_progress',
      }),
      session({
        scheduledFor: '2026-11-12',
        startedAt: '2026-11-12T17:00:00Z',
        status: 'abandoned',
      }),
    ]);
    expect(days.get('2026-11-16')?.occurrences[0]?.status).toBe('missed');
    expect(days.get('2026-11-12')?.occurrences[0]?.status).toBe('missed');
    expect(days.get('2026-11-16')?.sessions).toHaveLength(0);
  });

  it('puts a session with no plan link on its start date as extra', () => {
    const extra = session({ workoutName: 'Arms', startedAt: '2026-11-14T10:00:00Z' });
    const days = run([extra]);
    expect(days.get('2026-11-14')?.sessions[0]).toMatchObject({ id: extra.id, kind: 'extra' });
    expect(days.get('2026-11-14')?.occurrences).toHaveLength(0);
  });

  it('gives each occurrence its late window end', () => {
    const days = run([]);
    expect(days.get('2026-11-16')?.occurrences[0]?.lateWindowEnd).toBe('2026-11-18');
  });

  for (const zone of ['Europe/Kyiv', 'America/New_York']) {
    describe(`in ${zone}`, () => {
      const saved = process.env.TZ;
      beforeAll(() => {
        process.env.TZ = zone;
      });
      afterAll(() => {
        process.env.TZ = saved;
      });

      it('uses the start date in the profile zone, across a DST change', () => {
        // 23:30 local on the Saturday before the change; the session is late for Thursday.
        const saturday = zone === 'Europe/Kyiv' ? '2027-03-27T21:30:00Z' : '2027-03-14T04:30:00Z';
        const date = zone === 'Europe/Kyiv' ? '2027-03-27' : '2027-03-13';
        const thursday = zone === 'Europe/Kyiv' ? '2027-03-25' : '2027-03-11';
        const late = session({ scheduledFor: thursday, startedAt: saturday });
        const days = run([late], {
          rules: [rule({ startDate: '2027-03-01' })],
          from: '2027-03-01',
          to: '2027-03-31',
          today: '2027-03-31',
          timeZone: zone,
        });
        expect(days.get(thursday)?.occurrences[0]?.status).toBe('late');
        expect(days.get(date)?.sessions[0]?.id).toBe(late.id);
      });

      it('counts a 23:30 start as on time for that date', () => {
        const startedAt = zone === 'Europe/Kyiv' ? '2027-03-25T21:30:00Z' : '2027-03-12T03:30:00Z';
        const date = zone === 'Europe/Kyiv' ? '2027-03-25' : '2027-03-11';
        const days = run([session({ scheduledFor: date, startedAt })], {
          rules: [rule({ startDate: '2027-03-01' })],
          from: '2027-03-01',
          to: '2027-03-31',
          today: '2027-03-31',
          timeZone: zone,
        });
        expect(days.get(date)?.occurrences[0]?.status).toBe('on_time');
      });
    });
  }
});

describe('summarize', () => {
  const day = (date: string, statuses: string[], extras = 0): CalendarDay => ({
    date,
    occurrences: statuses.map((status, index) => ({
      ruleId: `r${index}`,
      workoutId: PUSH,
      workoutName: 'Push Day',
      status: status as CalendarDay['occurrences'][number]['status'],
      sessionId: null,
      lateWindowEnd: null,
    })),
    sessions: Array.from({ length: extras }, () => ({ ...session(), kind: 'extra' as const })),
  });

  it('gives 75% for 8 due with 5 on time and 1 late', () => {
    const days = [
      day('2026-11-02', ['on_time', 'on_time']),
      day('2026-11-04', ['on_time', 'late']),
      day('2026-11-08', ['on_time', 'missed']),
      day('2026-11-12', ['on_time', 'missed']),
      day('2026-11-17', ['planned']),
      day('2026-11-20', ['planned']),
      day('2026-11-14', [], 2),
    ];
    const summary = summarize(days, '2026-11-01', '2026-11-30', '2026-11-17');
    expect(summary).toMatchObject({
      onTime: 5,
      late: 1,
      missed: 2,
      planned: 2,
      extra: 2,
      due: 8,
      done: 6,
      percent: 75,
    });
    expect(summary.dueRow).toHaveLength(8);
  });

  it('counts today only once it is done', () => {
    const summary = summarize(
      [day('2026-11-17', ['on_time'])],
      '2026-11-17',
      '2026-11-17',
      '2026-11-17',
    );
    expect(summary).toMatchObject({ due: 1, percent: 100 });
  });

  it('has no percent when nothing is due', () => {
    const summary = summarize(
      [day('2026-11-20', ['planned'])],
      '2026-11-01',
      '2026-11-30',
      '2026-11-17',
    );
    expect(summary).toMatchObject({ due: 0, percent: null, dueRow: [] });
  });

  it('counts only the days in the range', () => {
    const summary = summarize(
      [day('2026-10-30', ['missed']), day('2026-11-02', ['on_time'])],
      '2026-11-01',
      '2026-11-30',
      '2026-11-17',
    );
    expect(summary).toMatchObject({ due: 1, missed: 0 });
  });
});

describe('findMakeUpDate', () => {
  it('returns the latest missed occurrence whose window includes today', () => {
    const days = run([], { from: '2026-11-09', to: '2026-11-16' });
    expect(findMakeUpDate({ days: days.values(), workoutId: PUSH, today: '2026-11-17' })).toBe(
      '2026-11-16',
    );
  });

  it('returns null after the window', () => {
    const days = run([], { from: '2026-11-09', to: '2026-11-16', today: '2026-11-19' });
    expect(
      findMakeUpDate({ days: days.values(), workoutId: PUSH, today: '2026-11-19' }),
    ).toBeNull();
  });

  it('returns null for another workout', () => {
    const days = run([], { from: '2026-11-09', to: '2026-11-16' });
    expect(
      findMakeUpDate({ days: days.values(), workoutId: LEGS, today: '2026-11-17' }),
    ).toBeNull();
  });
});
