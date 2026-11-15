import { describe, expect, it } from 'vitest';
import { patchScheduleRuleInputSchema, putScheduleRuleInputSchema } from '../plan';
import { calendarDateSchema } from '../utils';

const WORKOUT = '00000000-0000-4000-8000-0000000000bb';
const NEW_ID = '00000000-0000-4000-8000-0000000000cc';

const weekly = {
  workoutId: WORKOUT,
  startDate: '2026-11-16',
  weekdays: [4, 1],
  intervalWeeks: 1,
  endDate: null,
};

describe('calendarDateSchema', () => {
  it('accepts real dates only', () => {
    expect(calendarDateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(calendarDateSchema.safeParse('2027-02-29').success).toBe(false);
    expect(calendarDateSchema.safeParse('2027-2-1').success).toBe(false);
  });
});

describe('putScheduleRuleInputSchema', () => {
  it('sorts weekdays', () => {
    expect(putScheduleRuleInputSchema.parse(weekly).weekdays).toEqual([1, 4]);
  });

  it('accepts endAfter with no end date', () => {
    expect(putScheduleRuleInputSchema.safeParse({ ...weekly, endAfter: 5 }).success).toBe(true);
  });

  it('rejects endAfter together with an end date', () => {
    const result = putScheduleRuleInputSchema.safeParse({
      ...weekly,
      endDate: '2026-12-01',
      endAfter: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an interval outside 1–4 and duplicate weekdays', () => {
    expect(putScheduleRuleInputSchema.safeParse({ ...weekly, intervalWeeks: 5 }).success).toBe(
      false,
    );
    expect(putScheduleRuleInputSchema.safeParse({ ...weekly, weekdays: [1, 1] }).success).toBe(
      false,
    );
  });

  it('requires a one-off to end on its start', () => {
    expect(putScheduleRuleInputSchema.safeParse({ ...weekly, weekdays: [] }).success).toBe(false);
    expect(
      putScheduleRuleInputSchema.safeParse({ ...weekly, weekdays: [], endDate: '2026-11-16' })
        .success,
    ).toBe(true);
  });

  it('rejects an end before the start', () => {
    expect(
      putScheduleRuleInputSchema.safeParse({ ...weekly, endDate: '2026-11-15' }).success,
    ).toBe(false);
  });
});

describe('patchScheduleRuleInputSchema', () => {
  it('needs newId', () => {
    expect(patchScheduleRuleInputSchema.safeParse(weekly).success).toBe(false);
    expect(patchScheduleRuleInputSchema.safeParse({ ...weekly, newId: NEW_ID }).success).toBe(
      true,
    );
  });
});
