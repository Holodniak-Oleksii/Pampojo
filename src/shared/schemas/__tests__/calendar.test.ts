import { describe, expect, it } from 'vitest';
import { calendarQuerySchema } from '../calendar';
import { sessionListQuerySchema } from '../session';

describe('calendarQuerySchema', () => {
  it('accepts one day and 62 days', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-11-17', to: '2026-11-17' }).success).toBe(
      true,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-11-01', to: '2027-01-01' }).success).toBe(
      true,
    );
  });

  it('rejects 63 days, a reversed range and unreal dates', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-11-01', to: '2027-01-02' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-11-17', to: '2026-11-16' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
  });
});

describe('sessionListQuerySchema paging', () => {
  it('coerces the limit and caps it at 50', () => {
    expect(sessionListQuerySchema.parse({ limit: '20' }).limit).toBe(20);
    expect(sessionListQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(sessionListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
